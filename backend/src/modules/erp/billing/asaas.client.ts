// Cliente HTTP para a API do Asaas (boleto/PIX/split/transferências).
// Env-gated: só é usado quando existe um PaymentGatewayConfig ASAAS ativo com
// apiKey. Sem gateway, a emissão é recusada com mensagem clara (sem simulação).
// Docs: https://docs.asaas.com — sandbox: https://api-sandbox.asaas.com

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { EncryptionService } from '../../../security/encryption.service';

export interface AsaasCredentials {
  apiKey: string; // já descriptografada
  environment: string; // SANDBOX | PRODUCTION
}

export interface AsaasSplitEntry {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
}

@Injectable()
export class AsaasClient {
  private readonly logger = new Logger(AsaasClient.name);

  constructor(private encryption: EncryptionService) {}

  /**
   * Cifra a apiKey para gravar no banco (Fase 5: AES-256-GCM com IV
   * aleatório, chave ENCRYPTION_KEY). Antes era AES-CBC com IV fixo e uma
   * chave padrão escrita no código.
   */
  encryptApiKey(plain: string): string {
    return this.encryption.encrypt(plain);
  }

  /** Descriptografa a apiKey (formato novo GCM, ou o antigo CBC para chaves já gravadas). */
  decryptApiKey(encrypted: string): string {
    if (encrypted.split(':').length === 3) return this.encryption.decrypt(encrypted);
    // formato legado (antes da Fase 5): AES-256-CBC com IV zero e HMAC_SECRET
    const key = process.env.HMAC_SECRET;
    if (!key || key.length < 32) {
      throw new BadRequestException('A chave do gateway foi gravada num formato antigo. Edite o gateway e informe a chave de API novamente.');
    }
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), Buffer.alloc(16, 0));
      return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
    } catch {
      throw new BadRequestException('Não foi possível ler a chave do gateway. Edite o gateway e informe a chave de API novamente.');
    }
  }

  private baseUrl(environment: string): string {
    // Só para testes automatizados (servidor Asaas simulado). Ignorado em produção.
    const override = process.env.ASAAS_API_URL_TEST_OVERRIDE;
    if (override && process.env.NODE_ENV !== 'production') return override;
    return environment === 'PRODUCTION'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3';
  }

  private async request<T = any>(
    creds: AsaasCredentials,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl(creds.environment)}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        access_token: creds.apiKey,
        'User-Agent': 'EstouEmCasa/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      const msg =
        json?.errors?.[0]?.description || json?.message || `Asaas HTTP ${res.status}`;
      this.logger.error(`Asaas ${method} ${path} falhou: ${msg}`);
      throw new BadRequestException(`Gateway Asaas: ${msg}`);
    }
    return json as T;
  }

  // Busca ou cria o cliente (pagador) no Asaas pelo CPF/CNPJ
  async ensureCustomer(
    creds: AsaasCredentials,
    data: { name: string; cpfCnpj: string; email?: string | null },
  ): Promise<string> {
    const doc = data.cpfCnpj.replace(/\D/g, '');
    const found = await this.request<any>(creds, 'GET', `/customers?cpfCnpj=${doc}`);
    if (found?.data?.length) return found.data[0].id;
    const created = await this.request<any>(creds, 'POST', '/customers', {
      name: data.name,
      cpfCnpj: doc,
      email: data.email ?? undefined,
    });
    return created.id;
  }

  /**
   * Cria a cobrança no Asaas. BOLETO: linha digitável + PDF (o Asaas também
   * gera um PIX no boleto). PIX: QR Code e copia-e-cola.
   */
  async createPayment(
    creds: AsaasCredentials,
    data: {
      billingType: 'BOLETO' | 'PIX';
      customerId: string;
      value: number;
      dueDate: string; // YYYY-MM-DD
      description?: string;
      externalReference?: string;
      fine?: number; // % multa
      interest?: number; // % juros a.m.
      split?: AsaasSplitEntry[];
    },
  ) {
    const payment = await this.request<any>(creds, 'POST', '/payments', {
      customer: data.customerId,
      billingType: data.billingType,
      value: data.value,
      dueDate: data.dueDate,
      description: data.description,
      externalReference: data.externalReference,
      fine: data.fine ? { value: data.fine } : undefined,
      interest: data.interest ? { value: data.interest } : undefined,
      split: data.split?.length ? data.split : undefined,
    });

    const [ident, pix] = await Promise.all([
      data.billingType === 'BOLETO'
        ? this.request<any>(creds, 'GET', `/payments/${payment.id}/identificationField`).catch(() => null)
        : Promise.resolve(null),
      this.request<any>(creds, 'GET', `/payments/${payment.id}/pixQrCode`).catch(() => null),
    ]);
    if (data.billingType === 'PIX' && !pix?.payload) {
      // sem QR Code o pagador não consegue pagar: desfaz no gateway e avisa
      await this.cancelPayment(creds, payment.id).catch(() => undefined);
      throw new BadRequestException('Gateway Asaas: não foi possível gerar o QR Code PIX (verifique se a conta Asaas tem chave PIX cadastrada).');
    }

    return {
      paymentId: payment.id as string,
      status: payment.status as string,
      bankSlipUrl: (payment.bankSlipUrl ?? payment.invoiceUrl) as string | undefined,
      invoiceUrl: payment.invoiceUrl as string | undefined,
      nossoNumero: (payment.nossoNumero ?? payment.id) as string,
      linhaDigitavel: ident?.identificationField as string | undefined,
      codigoBarras: ident?.barCode as string | undefined,
      pixQrCode: pix?.encodedImage as string | undefined,
      pixCopiaECola: pix?.payload as string | undefined,
    };
  }

  /** Mantido por compatibilidade: cobrança boleto. */
  createBoletoPayment(creds: AsaasCredentials, data: Omit<Parameters<AsaasClient['createPayment']>[1], 'billingType'>) {
    return this.createPayment(creds, { ...data, billingType: 'BOLETO' });
  }

  /** Testa a chave de API (lança erro do gateway se inválida). */
  async ping(creds: AsaasCredentials): Promise<void> {
    await this.request<any>(creds, 'GET', '/customers?limit=1');
  }

  /** Cancela (remove) a cobrança no Asaas. Erro do gateway é propagado. */
  async cancelPayment(creds: AsaasCredentials, paymentId: string): Promise<void> {
    await this.request<any>(creds, 'DELETE', `/payments/${paymentId}`);
  }

  // Transferência PIX para um recebedor (repasse de comissão)
  async transferPix(
    creds: AsaasCredentials,
    data: {
      value: number;
      pixKey: string;
      pixKeyType: string; // CPF, CNPJ, EMAIL, PHONE, EVP
      description?: string;
      externalReference?: string; // chave de idempotência
    },
  ) {
    const typeMap: Record<string, string> = {
      CPF: 'CPF', CNPJ: 'CNPJ', EMAIL: 'EMAIL', PHONE: 'PHONE', RANDOM: 'EVP',
    };
    const transfer = await this.request<any>(creds, 'POST', '/transfers', {
      value: data.value,
      pixAddressKey: data.pixKey,
      pixAddressKeyType: typeMap[data.pixKeyType] ?? 'EVP',
      description: data.description,
      externalReference: data.externalReference,
    });
    return {
      transferId: transfer.id as string,
      status: transfer.status as string,
    };
  }
}
