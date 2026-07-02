// Interface plugável para o provedor de split de pagamento (Bacen-regulado).
// Permite trocar de instituição (EFÍ, ASAAS, Iugu, etc.) sem reescrever a regra
// de negócio. Toda instrução carrega uma chave de idempotência por operação.

export interface SplitBeneficiary {
  recipientId: string;
  name: string;
  document: string; // CPF/CNPJ
  pixKey?: string | null;
  bankCode?: string | null;
  agency?: string | null;
  accountNumber?: string | null;
  amount: number; // valor destinado a este beneficiário
}

export interface SplitInstruction {
  idempotencyKey: string; // único por operação — evita duplicidade em reenvio
  totalAmount: number;
  beneficiaries: SplitBeneficiary[];
  reference?: string; // ex.: contractId / financialEntryId
}

export interface SplitResult {
  accepted: boolean;
  providerId: string; // identificador da instituição
  externalId?: string; // id retornado pela instituição
  status: 'CONFIRMED' | 'PENDING' | 'FAILED';
  message?: string;
  raw?: unknown; // resposta bruta (auditável)
}

export interface PaymentSplitProvider {
  readonly providerId: string;
  send(instruction: SplitInstruction): Promise<SplitResult>;
}

// Provedor MANUAL/SIMULADO padrão: não movimenta dinheiro; apenas confirma o
// comando para controle interno enquanto uma instituição real não é plugada.
export class ManualSplitProvider implements PaymentSplitProvider {
  readonly providerId = 'MANUAL';

  async send(instruction: SplitInstruction): Promise<SplitResult> {
    const total = instruction.beneficiaries.reduce((s, b) => s + b.amount, 0);
    const accepted = Math.abs(total - instruction.totalAmount) < 0.01;
    return {
      accepted,
      providerId: this.providerId,
      externalId: `manual-${instruction.idempotencyKey}`,
      status: accepted ? 'CONFIRMED' : 'FAILED',
      message: accepted ? 'Split registrado (modo manual)' : 'Soma dos beneficiários difere do total',
      raw: { simulated: true },
    };
  }
}

export const PAYMENT_SPLIT_PROVIDER = Symbol('PAYMENT_SPLIT_PROVIDER');
