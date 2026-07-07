// Cliente HTTP para a API do Asaas (boleto/PIX/split/transferências).
// Env-gated: só é usado quando existe um PaymentGatewayConfig ASAAS ativo com
// apiKey. Sem credenciais, o sistema segue no modo simulado/manual.
// Docs: https://docs.asaas.com — sandbox: https://api-sandbox.asaas.com

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

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

  // Descriptografa a apiKey armazenada (inverso do encrypt do BillingService)
  decryptApiKey(encrypted: string): string {
    const key = process.env.HMAC_SECRET || 'homolog-secret-32-chars-here----';
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(key.slice(0, 32)),
      Buffer.alloc(16, 0),
    );
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  }

  private baseUrl(environment: string): string {
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

  // Cria cobrança boleto (com PIX embutido) e retorna dados bancários reais
  async createBoletoPayment(
    creds: AsaasCredentials,
    data: {
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
      billingType: 'BOLETO',
      value: data.value,
      dueDate: data.dueDate,
      description: data.description,
      externalReference: data.externalReference,
      fine: data.fine ? { value: data.fine } : undefined,
      interest: data.interest ? { value: data.interest } : undefined,
      split: data.split?.length ? data.split : undefined,
    });

    const [ident, pix] = await Promise.all([
      this.request<any>(creds, 'GET', `/payments/${payment.id}/identificationField`).catch(() => null),
      this.request<any>(creds, 'GET', `/payments/${payment.id}/pixQrCode`).catch(() => null),
    ]);

    return {
      paymentId: payment.id as string,
      status: payment.status as string,
      bankSlipUrl: (payment.bankSlipUrl ?? payment.invoiceUrl) as string | undefined,
      nossoNumero: (payment.nossoNumero ?? payment.id) as string,
      linhaDigitavel: ident?.identificationField as string | undefined,
      codigoBarras: ident?.barCode as string | undefined,
      pixQrCode: pix?.encodedImage as string | undefined,
      pixCopiaECola: pix?.payload as string | undefined,
    };
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
