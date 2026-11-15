// Fase 3 — etapas padrão do funil de venda (decisão do dono) e avanço
// automático do negócio. O avanço só anda PARA FRENTE: um negócio já em
// "Proposta" não volta para "Visita realizada" porque uma visita foi feita.

import { Prisma } from '@prisma/client';

export type StageKey =
  | 'NEW_LEAD' | 'ATTENDANCE' | 'VISIT_SCHEDULED' | 'VISIT_DONE'
  | 'PROPOSAL' | 'NEGOTIATION' | 'DOCUMENTATION' | 'WON' | 'LOST';

export const SALES_FUNNEL_NAME = 'Funil de Venda';

export const DEFAULT_SALES_FUNNEL: Array<{
  name: string; color: string; order: number; isWon: boolean; isLost: boolean; stageKey: StageKey;
}> = [
  { name: 'Novo lead', color: '#6366f1', order: 0, isWon: false, isLost: false, stageKey: 'NEW_LEAD' },
  { name: 'Atendimento', color: '#8b5cf6', order: 1, isWon: false, isLost: false, stageKey: 'ATTENDANCE' },
  { name: 'Visita agendada', color: '#f59e0b', order: 2, isWon: false, isLost: false, stageKey: 'VISIT_SCHEDULED' },
  { name: 'Visita realizada', color: '#eab308', order: 3, isWon: false, isLost: false, stageKey: 'VISIT_DONE' },
  { name: 'Proposta', color: '#3b82f6', order: 4, isWon: false, isLost: false, stageKey: 'PROPOSAL' },
  { name: 'Negociação', color: '#0ea5e9', order: 5, isWon: false, isLost: false, stageKey: 'NEGOTIATION' },
  { name: 'Documentação', color: '#10b981', order: 6, isWon: false, isLost: false, stageKey: 'DOCUMENTATION' },
  { name: 'Ganho', color: '#22c55e', order: 7, isWon: true, isLost: false, stageKey: 'WON' },
  { name: 'Perdido', color: '#ef4444', order: 8, isWon: false, isLost: true, stageKey: 'LOST' },
];

/** Motivos de perda padronizados (o motivo é obrigatório ao perder). */
export const LOST_REASONS = [
  'PRECO', 'FINANCIAMENTO_NEGADO', 'COMPROU_OUTRO_IMOVEL', 'DESISTIU', 'SEM_RETORNO',
  'IMOVEL_VENDIDO', 'DOCUMENTACAO', 'LOCALIZACAO', 'OUTRO',
] as const;

/** Decide se o negócio deve avançar: só para frente e nunca saindo de ganho/perdido. */
export function shouldAdvance(
  current: { order: number; isWon: boolean; isLost: boolean },
  target: { order: number },
): boolean {
  if (current.isWon || current.isLost) return false;
  return target.order > current.order;
}

/**
 * Avança o negócio para a etapa com a chave informada (se o funil dele a
 * tiver e se for para frente). Registra o histórico. Use dentro de transação.
 * Devolve o nome da etapa quando avançou; null quando não precisou.
 */
export async function advanceDealToStage(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  dealId: string,
  key: StageKey,
  userId?: string,
): Promise<string | null> {
  const deal = await tx.deal.findFirst({
    where: { id: dealId, workspaceId, deletedAt: null },
    include: { stage: true },
  });
  if (!deal) return null;
  const target = await tx.pipelineStage.findFirst({
    where: { pipelineId: deal.pipelineId, stageKey: key },
  });
  if (!target || !shouldAdvance(deal.stage, target)) return null;

  const last = await tx.dealStageHistory.findFirst({ where: { dealId }, orderBy: { movedAt: 'desc' } });
  if (last) {
    const days = Math.floor((Date.now() - last.movedAt.getTime()) / 86_400_000);
    await tx.dealStageHistory.update({ where: { id: last.id }, data: { daysInStage: days } });
  }
  await tx.deal.update({
    where: { id: dealId },
    data: { stageId: target.id, lastActivityAt: new Date(), ...(target.isWon && { closedAt: new Date() }) },
  });
  await tx.dealStageHistory.create({ data: { dealId, stageId: target.id, userId, daysInStage: 0 } });
  return target.name;
}
