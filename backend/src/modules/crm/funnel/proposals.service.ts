// Fase 3 — propostas de compra, contrapropostas e histórico.
// Regras: uma proposta em aberto por negócio; contraproposta encerra a
// anterior (COUNTERED) e abre outra; aceitar define o valor do negócio e
// avança para Documentação; recusar exige motivo.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { advanceDealToStage } from '../pipelines/funnel-stages';
import { proposalSituation, validatePaymentTerms } from './funnel-rules';
import { CreateProposalDto, DecideProposalDto, ProposalTermsDto } from './funnel.dto';
import { dealScope, proposalScope } from '../../../common/access/access';

export const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'À vista', FINANCING: 'Financiamento bancário', FGTS: 'Com uso de FGTS', PERMUTA: 'Permuta', MIXED: 'Misto',
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Em aberto', EXPIRED: 'Vencida', ACCEPTED: 'Aceita', REJECTED: 'Recusada', COUNTERED: 'Respondida com contraproposta', WITHDRAWN: 'Retirada',
};

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const brl = (v: unknown) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (v: Date | string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

@Injectable()
export class ProposalsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private decorate<T extends { status: string; validUntil: Date }>(p: T) {
    return { ...p, situation: proposalSituation(p) };
  }

  private terms(dto: ProposalTermsDto) {
    const err = validatePaymentTerms(dto);
    if (err) throw new BadRequestException(err);
    const validUntil = new Date(dto.validUntil);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (validUntil < today) throw new BadRequestException('A validade da proposta não pode ser uma data passada.');
    return {
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      downPayment: dto.downPayment ?? null,
      financedAmount: dto.financedAmount ?? null,
      fgtsAmount: dto.fgtsAmount ?? null,
      exchangeDescription: dto.exchangeDescription?.trim() || null,
      conditions: dto.conditions?.trim() || null,
      validUntil,
    };
  }

  private async findOrThrow(workspaceId: string, id: string) {
    const p = await this.prisma.proposal.findFirst({ where: { id, workspaceId, deletedAt: null, AND: [proposalScope()] } });
    if (!p) throw new NotFoundException('Proposta não encontrada.');
    return p;
  }

  async listByDeal(workspaceId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, workspaceId, deletedAt: null, ...dealScope() }, select: { id: true } });
    if (!deal) throw new NotFoundException('Negócio não encontrado.');
    const items = await this.prisma.proposal.findMany({
      where: { workspaceId, dealId, deletedAt: null },
      include: { property: { select: { id: true, code: true, street: true, number: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((p) => this.decorate(p));
  }

  async create(workspaceId: string, userId: string, dto: CreateProposalDto) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dto.dealId, workspaceId, deletedAt: null, ...dealScope() },
      include: { stage: true, properties: { select: { propertyId: true } } },
    });
    if (!deal) throw new BadRequestException('Negócio não encontrado neste workspace.');
    if (deal.stage.isWon || deal.stage.isLost) {
      throw new BadRequestException('Este negócio já foi encerrado (ganho ou perdido).');
    }
    let propertyId = dto.propertyId;
    if (!propertyId) {
      if (deal.properties.length !== 1) {
        throw new BadRequestException('Informe o imóvel da proposta (o negócio tem nenhum ou mais de um imóvel).');
      }
      propertyId = deal.properties[0].propertyId;
    }
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, workspaceId, deletedAt: null }, select: { id: true, status: true },
    });
    if (!property) throw new BadRequestException('Imóvel não encontrado neste workspace.');
    if (property.status === 'SOLD') throw new BadRequestException('Este imóvel já foi vendido.');

    const open = await this.prisma.proposal.findFirst({
      where: { workspaceId, dealId: deal.id, status: 'OPEN', deletedAt: null }, select: { id: true },
    });
    if (open) {
      throw new BadRequestException('Já existe uma proposta em aberto neste negócio. Responda com contraproposta, aceite, recuse ou retire a atual.');
    }
    const data = this.terms(dto);

    const result = await this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.create({
        data: { workspaceId, dealId: deal.id, contactId: deal.contactId, propertyId: property.id, kind: 'OFFER', createdById: userId, ...data },
      });
      const link = await tx.dealProperty.findFirst({ where: { dealId: deal.id, propertyId: property.id } });
      if (!link) await tx.dealProperty.create({ data: { dealId: deal.id, propertyId: property.id } });
      const movedTo = await advanceDealToStage(tx, workspaceId, deal.id, 'PROPOSAL', userId);
      return { proposal, movedTo };
    });
    await this.audit.log({ workspaceId, userId, action: 'PROPOSAL_CREATED', entity: 'Proposal', entityId: result.proposal.id });
    return { ...this.decorate(result.proposal), dealMovedTo: result.movedTo };
  }

  private assertOpen(p: { status: string; validUntil: Date }, action: string) {
    const s = proposalSituation(p);
    if (s === 'EXPIRED' && action === 'aceitar') {
      throw new BadRequestException('Esta proposta está vencida. Registre uma nova proposta ou contraproposta.');
    }
    if (p.status !== 'OPEN') throw new BadRequestException(`Só é possível ${action} uma proposta em aberto.`);
  }

  async counter(workspaceId: string, userId: string, id: string, dto: ProposalTermsDto) {
    const parent = await this.findOrThrow(workspaceId, id);
    this.assertOpen(parent, 'responder');
    const data = this.terms(dto);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.proposal.update({ where: { id }, data: { status: 'COUNTERED', decidedAt: new Date() } });
      const proposal = await tx.proposal.create({
        data: {
          workspaceId, dealId: parent.dealId, contactId: parent.contactId, propertyId: parent.propertyId,
          parentId: parent.id, kind: parent.kind === 'OFFER' ? 'COUNTER' : 'OFFER', createdById: userId, ...data,
        },
      });
      const movedTo = await advanceDealToStage(tx, workspaceId, parent.dealId, 'NEGOTIATION', userId);
      return { proposal, movedTo };
    });
    await this.audit.log({ workspaceId, userId, action: 'PROPOSAL_COUNTERED', entity: 'Proposal', entityId: result.proposal.id });
    return { ...this.decorate(result.proposal), dealMovedTo: result.movedTo };
  }

  async accept(workspaceId: string, userId: string, id: string, dto: DecideProposalDto) {
    const p = await this.findOrThrow(workspaceId, id);
    this.assertOpen(p, 'aceitar');
    const result = await this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.update({
        where: { id }, data: { status: 'ACCEPTED', decidedAt: new Date(), decisionNote: dto.note?.trim() || null },
      });
      // o valor do negócio passa a ser o valor aceito (entra no VGV)
      await tx.deal.update({ where: { id: p.dealId }, data: { value: p.amount, lastActivityAt: new Date() } });
      const movedTo = await advanceDealToStage(tx, workspaceId, p.dealId, 'DOCUMENTATION', userId);
      return { proposal, movedTo };
    });
    await this.audit.log({ workspaceId, userId, action: 'PROPOSAL_ACCEPTED', entity: 'Proposal', entityId: id });
    return { ...this.decorate(result.proposal), dealMovedTo: result.movedTo };
  }

  async reject(workspaceId: string, userId: string, id: string, dto: DecideProposalDto) {
    const p = await this.findOrThrow(workspaceId, id);
    this.assertOpen(p, 'recusar');
    if (!dto.note?.trim()) throw new BadRequestException('Informe o motivo da recusa.');
    const updated = await this.prisma.proposal.update({
      where: { id }, data: { status: 'REJECTED', decidedAt: new Date(), decisionNote: dto.note.trim() },
    });
    await this.audit.log({ workspaceId, userId, action: 'PROPOSAL_REJECTED', entity: 'Proposal', entityId: id });
    return this.decorate(updated);
  }

  async withdraw(workspaceId: string, userId: string, id: string, dto: DecideProposalDto) {
    const p = await this.findOrThrow(workspaceId, id);
    this.assertOpen(p, 'retirar');
    const updated = await this.prisma.proposal.update({
      where: { id }, data: { status: 'WITHDRAWN', decidedAt: new Date(), decisionNote: dto.note?.trim() || null },
    });
    await this.audit.log({ workspaceId, userId, action: 'PROPOSAL_WITHDRAWN', entity: 'Proposal', entityId: id });
    return this.decorate(updated);
  }

  /** Documento da proposta em HTML pronto para imprimir / salvar em PDF. */
  async document(workspaceId: string, id: string): Promise<string> {
    const p = await this.prisma.proposal.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        contact: { select: { name: true, cpf: true, cnpj: true, maritalStatus: true } },
        property: {
          select: {
            code: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true,
            registrationNumber: true,
            coOwners: { where: { deletedAt: null }, include: { contact: { select: { name: true } } } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Proposta não encontrada.');
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, cnpj: true } });
    const situation = proposalSituation(p);
    const addr = [p.property.street, p.property.number, p.property.complement, p.property.neighborhood, p.property.city, p.property.state]
      .filter(Boolean).join(', ');
    const sellers = p.property.coOwners.map((o) => o.contact.name).join(', ') || '—';
    const doc = p.contact.cpf ?? p.contact.cnpj;
    const rows: Array<[string, string]> = [
      ['Valor oferecido', brl(p.amount)],
      ['Forma de pagamento', PAYMENT_LABEL[p.paymentMethod] ?? p.paymentMethod],
      ...(p.downPayment != null ? [['Entrada / sinal', brl(p.downPayment)] as [string, string]] : []),
      ...(p.financedAmount != null ? [['Valor financiado', brl(p.financedAmount)] as [string, string]] : []),
      ...(p.fgtsAmount != null ? [['Valor com FGTS', brl(p.fgtsAmount)] as [string, string]] : []),
      ...(p.exchangeDescription ? [['Bem dado em permuta', p.exchangeDescription] as [string, string]] : []),
      ['Validade da proposta', dt(p.validUntil)],
      ['Situação', STATUS_LABEL[situation] ?? situation],
    ];
    const title = p.kind === 'COUNTER' ? 'Contraproposta de venda' : 'Proposta de compra de imóvel';
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)} — ${esc(p.property.code)}</title>
<style>
 body{font-family:Arial,Helvetica,sans-serif;color:#111;max-width:760px;margin:24px auto;padding:0 24px;font-size:14px;line-height:1.5}
 h1{font-size:20px;margin:0 0 4px} .muted{color:#555;font-size:12px}
 table{width:100%;border-collapse:collapse;margin:16px 0} td{border:1px solid #ccc;padding:8px;vertical-align:top} td:first-child{width:35%;background:#f6f6f6;font-weight:bold}
 .sign{display:flex;gap:32px;margin-top:64px} .sign div{flex:1;border-top:1px solid #111;padding-top:6px;text-align:center;font-size:12px}
 .toolbar{margin:16px 0} @media print{.toolbar{display:none}}
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Imprimir / salvar em PDF</button></div>
<h1>${esc(title)}</h1>
<p class="muted">${esc(ws?.name ?? '')}${ws?.cnpj ? ` — CNPJ ${esc(ws.cnpj)}` : ''} · emitida em ${dt(p.createdAt)}</p>
<table>
<tr><td>Comprador (proponente)</td><td>${esc(p.contact.name)}${doc ? ` — ${esc(doc)}` : ''}</td></tr>
<tr><td>Vendedor(es)</td><td>${esc(sellers)}</td></tr>
<tr><td>Imóvel</td><td>${esc(p.property.code)} — ${esc(addr)}${p.property.registrationNumber ? `<br>Matrícula ${esc(p.property.registrationNumber)}` : ''}</td></tr>
${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('\n')}
${p.conditions ? `<tr><td>Condições</td><td>${esc(p.conditions).replace(/\n/g, '<br>')}</td></tr>` : ''}
</table>
<p>Esta proposta não substitui o contrato de compra e venda. Aceita, as partes formalizarão o negócio por instrumento próprio.</p>
<div class="sign"><div>Comprador</div><div>Vendedor</div><div>${esc(ws?.name ?? 'Imobiliária')}</div></div>
</body></html>`;
  }
}
