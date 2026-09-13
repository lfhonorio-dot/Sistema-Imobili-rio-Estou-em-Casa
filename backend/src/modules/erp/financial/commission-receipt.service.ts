// Gera o recibo de comissão em HTML — mesmo padrão do gerador de contrato
// (contract-template.service.ts). Antes disso não existia nenhum documento
// comprovando o pagamento de comissão ao corretor.
//
// @lgpd-purpose: identificação do corretor beneficiário no recibo de comissão
// @lgpd-retention: 5 anos (comprovação fiscal/trabalhista)
// @lgpd-basis: execução de contrato (Art. 7º, V)

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommissionReceiptService {
  constructor(private prisma: PrismaService) {}

  private fmtCurrency(value: unknown): string {
    if (value === null || value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value));
  }

  private fmtDate(d: unknown): string {
    if (!d) return '______________';
    return new Date(d as string).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  // Escapa texto vindo do banco antes de interpolar no HTML
  private esc(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private async getData(workspaceId: string, commissionId: string) {
    const commission = await this.prisma.commission.findFirst({
      where: { id: commissionId, workspaceId },
      include: {
        contract: {
          include: {
            property: {
              select: {
                code: true,
                street: true,
                number: true,
                neighborhood: true,
                city: true,
              },
            },
            owner: { select: { name: true } },
            tenant: { select: { name: true } },
          },
        },
      },
    });
    if (!commission) throw new NotFoundException('Comissão não encontrada');

    // O corretor é um WorkspaceUser; o nome/e-mail vêm do User vinculado
    const workspaceUser = await this.prisma.workspaceUser.findFirst({
      where: { id: commission.userId, workspaceId },
      include: { user: { select: { name: true, email: true } } },
    });

    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId },
      select: { name: true, cnpj: true },
    });

    return { commission, broker: workspaceUser?.user ?? null, workspace };
  }

  async generateReceipt(workspaceId: string, commissionId: string): Promise<string> {
    const { commission, broker, workspace } = await this.getData(workspaceId, commissionId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contract = commission.contract as any;
    const property = contract?.property;
    const address = property
      ? [property.street, property.number].filter(Boolean).join(', ') || property.code
      : '______________';
    const city = property?.city ? `, ${property.city}` : '';

    const typeLabel: Record<string, string> = {
      SALE: 'Compra e Venda',
      BROKERAGE: 'Intermediação',
      RENTAL_RESIDENTIAL: 'Locação Residencial',
      RENTAL_COMMERCIAL: 'Locação Comercial',
    };
    const contractLabel = typeLabel[contract?.type] ?? contract?.type ?? '-';

    // Valor efetivamente recebido quando houver; senão o valor calculado
    const paidValue = commission.receivedValue ?? commission.amount;
    const isSettled = commission.status === 'RECEIVED' || commission.status === 'PAID';
    const receiptNumber = commission.id.slice(0, 8).toUpperCase();
    const issuedAt = commission.paidAt ?? new Date();
    const brokerName = broker?.name ?? '______________';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo de Comissão ${this.esc(receiptNumber)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; max-width: 720px; margin: 0 auto; padding: 40px 32px; line-height: 1.6; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; letter-spacing: 1px; }
  .subtitle { text-align: center; color: #64748b; font-size: 13px; margin-bottom: 32px; }
  .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; }
  .row { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 8px; font-size: 14px; }
  .label { color: #64748b; }
  .value { font-weight: 600; text-align: right; }
  .amount { font-size: 28px; text-align: center; margin: 24px 0; font-weight: 700; color: #0f172a; }
  .pendente { text-align: center; color: #b45309; font-size: 13px; margin-bottom: 16px; }
  .signature { margin-top: 64px; text-align: center; }
  .signature .line { border-top: 1px solid #94a3b8; width: 320px; margin: 0 auto 6px; }
  .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <h1>RECIBO DE COMISSÃO</h1>
  <p class="subtitle">
    Nº ${this.esc(receiptNumber)} — ${isSettled ? `Emitido em ${this.fmtDate(issuedAt)}` : 'Prévia — comissão ainda não recebida'}
  </p>

  ${isSettled ? '' : '<p class="pendente">Este documento é uma prévia: a comissão ainda consta como pendente.</p>'}

  <div class="box">
    <div class="row"><span class="label">Corretor(a)</span><span class="value">${this.esc(brokerName)}</span></div>
    ${broker?.email ? `<div class="row"><span class="label">E-mail</span><span class="value">${this.esc(broker.email)}</span></div>` : ''}
    <div class="row"><span class="label">Contrato</span><span class="value">${this.esc(contractLabel)}${contract?.code ? ` (${this.esc(contract.code)})` : ''}</span></div>
    <div class="row"><span class="label">Imóvel</span><span class="value">${this.esc(address)}${this.esc(city)}</span></div>
    <div class="row"><span class="label">Vendedor/Locador</span><span class="value">${this.esc(contract?.owner?.name ?? '-')}</span></div>
    <div class="row"><span class="label">Comprador/Locatário</span><span class="value">${this.esc(contract?.tenant?.name ?? '-')}</span></div>
    <div class="row"><span class="label">Taxa de comissão</span><span class="value">${this.esc(Number(commission.rate).toLocaleString('pt-BR'))}%</span></div>
    <div class="row"><span class="label">Situação</span><span class="value">${isSettled ? 'Recebida' : 'Pendente'}</span></div>
    ${commission.paymentMethod ? `<div class="row"><span class="label">Forma de pagamento</span><span class="value">${this.esc(commission.paymentMethod)}</span></div>` : ''}
    ${commission.paidAt ? `<div class="row"><span class="label">Data do recebimento</span><span class="value">${this.fmtDate(commission.paidAt)}</span></div>` : ''}
  </div>

  <p style="text-align:center;color:#64748b;font-size:13px;">Valor da comissão</p>
  <div class="amount">${this.fmtCurrency(paidValue)}</div>

  <p style="font-size:13px;">
    Eu, <strong>${this.esc(brokerName)}</strong>, declaro ter recebido de
    <strong>${this.esc(workspace?.name ?? 'a imobiliária')}</strong> a importância de
    <strong>${this.fmtCurrency(paidValue)}</strong>, referente à comissão pela intermediação
    do contrato de ${this.esc(contractLabel)} do imóvel ${this.esc(address)}${this.esc(city)},
    dando plena e geral quitação.
  </p>

  <div class="signature">
    <div class="line"></div>
    ${this.esc(brokerName)}
  </div>

  <div class="footer">
    ${this.esc(workspace?.name ?? '')}${workspace?.cnpj ? ` — CNPJ ${this.esc(workspace.cnpj)}` : ''}<br>
    Documento gerado automaticamente pelo Sistema Imobiliário Estou em Casa em ${new Date().toLocaleString('pt-BR')}.
  </div>
</body>
</html>`;
  }
}
