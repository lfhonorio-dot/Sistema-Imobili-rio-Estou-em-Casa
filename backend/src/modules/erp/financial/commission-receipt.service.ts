// Gerador de recibo de comissão em HTML — mesmo padrão do contrato
// (contract-template.service.ts), usado para dar rastreabilidade ao
// pagamento de comissões de corretores (antes disso não existia nenhum
// documento/registro de recibo no sistema).

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommissionReceiptService {
  constructor(private prisma: PrismaService) {}

  private fmtCurrency(value: unknown): string {
    if (value === null || value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
  }

  private fmtDate(d: unknown): string {
    if (!d) return '______________';
    return new Date(d as string).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  }

  // Busca todos os dados necessários para montar o recibo
  private async getCommissionData(workspaceId: string, commissionId: string) {
    const commission = await this.prisma.commission.findFirst({
      where: { id: commissionId, workspaceId },
      include: {
        contract: {
          include: {
            property: true,
            owner: { select: { id: true, name: true } },
            tenant: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!commission) throw new NotFoundException('Comissão não encontrada');

    const workspaceUser = await this.prisma.workspaceUser.findFirst({
      where: { id: commission.userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return { commission, broker: workspaceUser?.user ?? null };
  }

  // Gera o HTML do recibo (visualização/download/anexo de e-mail)
  async generateReceipt(workspaceId: string, commissionId: string): Promise<string> {
    const { commission, broker } = await this.getCommissionData(workspaceId, commissionId);
    const contract = commission.contract as any;
    const property = contract?.property;
    const propAddress = property
      ? [property.street, property.number].filter(Boolean).join(', ') || property.code
      : '______________';

    const typeLabel: Record<string, string> = {
      SALE: 'Compra e Venda',
      RENTAL_RESIDENTIAL: 'Locação Residencial',
      RENTAL_COMMERCIAL: 'Locação Comercial',
      BROKERAGE: 'Intermediação',
    };

    const receiptNumber = commission.id.slice(0, 8).toUpperCase();
    const issuedAt = commission.paidAt ?? new Date();

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo de Comissão ${receiptNumber}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; max-width: 720px; margin: 0 auto; padding: 40px 32px; line-height: 1.6; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #64748b; font-size: 13px; margin-bottom: 32px; }
  .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
  .label { color: #64748b; }
  .value { font-weight: 600; }
  .amount { font-size: 28px; text-align: center; margin: 24px 0; font-weight: 700; color: #0f172a; }
  .signature { margin-top: 64px; text-align: center; }
  .signature .line { border-top: 1px solid #94a3b8; width: 320px; margin: 0 auto 6px; }
  .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
</style>
</head>
<body>
  <h1>RECIBO DE COMISSÃO</h1>
  <p class="subtitle">Nº ${receiptNumber} — Emitido em ${this.fmtDate(issuedAt)}</p>

  <div class="box">
    <div class="row"><span class="label">Corretor(a)</span><span class="value">${broker?.name ?? '______________'}</span></div>
    <div class="row"><span class="label">Contrato</span><span class="value">${typeLabel[contract?.type] ?? contract?.type ?? '-'}</span></div>
    <div class="row"><span class="label">Imóvel</span><span class="value">${propAddress}${property?.city ? ', ' + property.city : ''}</span></div>
    <div class="row"><span class="label">Vendedor/Locador</span><span class="value">${contract?.owner?.name ?? '-'}</span></div>
    <div class="row"><span class="label">Comprador/Locatário</span><span class="value">${contract?.tenant?.name ?? '-'}</span></div>
    <div class="row"><span class="label">Taxa de comissão</span><span class="value">${Number(commission.rate).toLocaleString('pt-BR')}%</span></div>
    <div class="row"><span class="label">Status</span><span class="value">${commission.status === 'PAID' ? 'Pago' : 'Pendente'}</span></div>
    ${commission.paidAt ? `<div class="row"><span class="label">Data do pagamento</span><span class="value">${this.fmtDate(commission.paidAt)}</span></div>` : ''}
  </div>

  <p style="text-align:center;color:#64748b;font-size:13px;">Valor recebido a título de comissão</p>
  <div class="amount">${this.fmtCurrency(commission.amount)}</div>

  <p style="font-size:13px;">
    Eu, <strong>${broker?.name ?? '______________'}</strong>, declaro ter recebido o valor acima
    referente à comissão pela intermediação do contrato de ${typeLabel[contract?.type] ?? contract?.type}
    do imóvel ${propAddress}, dando plena e geral quitação.
  </p>

  <div class="signature">
    <div class="line"></div>
    ${broker?.name ?? '______________'}${broker?.email ? `<br><span style="font-size:12px;color:#64748b;">${broker.email}</span>` : ''}
  </div>

  <div class="footer">
    Documento gerado automaticamente pelo Sistema Imobiliário Estou em Casa em ${new Date().toLocaleString('pt-BR')}.
  </div>
</body>
</html>`;
  }
}
