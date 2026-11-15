// Fase 7 — Corretor só vê contratos dos negócios dele (Contract.dealId).
import type { PrismaService } from '../../prisma/prisma.service';
import { brokerMemberId } from '../../../common/access/access';

export async function contractScope(prisma: PrismaService, workspaceId: string): Promise<Record<string, unknown>> {
  const b = brokerMemberId();
  if (!b) return {};
  const deals = await prisma.deal.findMany({ where: { workspaceId, assigneeId: b }, select: { id: true } });
  return { dealId: { in: deals.map((d) => d.id) } };
}
