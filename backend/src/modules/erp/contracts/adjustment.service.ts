// Reajuste automático de aluguel por índice (IGP-M/IPCA).
// - Índices: API pública do Banco Central (SGS): IGP-M = série 189, IPCA = 433
//   (variação % mensal; acumulado 12m = produto composto).
// - Cron mensal (dia 1, 06h): reajusta contratos de locação ATIVOS no mês de
//   aniversário (adjustmentMonth ou mês do startDate), no máximo 1x a cada
//   11 meses (lastAdjustedAt).
// - Fallback: se a API do BCB estiver indisponível, o job pula o contrato e
//   registra alerta; o disparo manual aceita uma taxa informada (manualRate).

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

const SGS_SERIES: Record<string, number> = { IGPM: 189, IPCA: 433 };

@Injectable()
export class AdjustmentService {
  private readonly logger = new Logger(AdjustmentService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // Acumulado 12 meses do índice (fração; ex.: 0.045 = 4,5%)
  async fetchIndex12m(index: string): Promise<number> {
    const serie = SGS_SERIES[index?.toUpperCase() ?? ''];
    if (!serie) throw new BadRequestException(`Índice não suportado: ${index}`);
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/12?formato=json`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`BCB SGS HTTP ${res.status}`);
    const rows = (await res.json()) as Array<{ data: string; valor: string }>;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('BCB SGS sem dados');
    const acc = rows.reduce((f, r) => f * (1 + Number(r.valor) / 100), 1) - 1;
    return acc;
  }

  // Dia 1 de cada mês, 06:00
  @Cron('0 6 1 * *')
  async runMonthly() {
    return this.run();
  }

  // Lista contratos elegíveis no mês corrente
  async preview() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const elevenMonthsAgo = new Date(now);
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);

    const contracts = await this.prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        type: { in: ['RENTAL_RESIDENTIAL', 'RENTAL_COMMERCIAL'] },
        adjustmentIndex: { not: null },
        rentalValue: { not: null },
        OR: [{ lastAdjustedAt: null }, { lastAdjustedAt: { lt: elevenMonthsAgo } }],
      },
      select: {
        id: true, code: true, workspaceId: true, rentalValue: true,
        adjustmentIndex: true, adjustmentMonth: true, startDate: true, lastAdjustedAt: true,
      },
    });

    return contracts.filter((c) => {
      const anniversary = c.adjustmentMonth ?? (c.startDate ? new Date(c.startDate).getMonth() + 1 : null);
      if (!anniversary || anniversary !== month) return false;
      // exige ao menos ~11 meses de vigência para o primeiro reajuste
      if (!c.lastAdjustedAt && c.startDate) {
        const months = (now.getTime() - new Date(c.startDate).getTime()) / (30.44 * 86_400_000);
        if (months < 11) return false;
      }
      return true;
    });
  }

  // Executa os reajustes (manualRate: fração p/ quando a API BCB não responder)
  async run(manualRate?: number) {
    const eligible = await this.preview();
    const rateCache: Record<string, number> = {};
    const results: Array<Record<string, unknown>> = [];
    let adjusted = 0;
    let skipped = 0;

    for (const c of eligible) {
      const idx = (c.adjustmentIndex ?? 'IGPM').toUpperCase();
      let rate = manualRate;
      if (rate === undefined) {
        try {
          rateCache[idx] = rateCache[idx] ?? (await this.fetchIndex12m(idx));
          rate = rateCache[idx];
        } catch (e) {
          this.logger.warn(`Índice ${idx} indisponível (${(e as Error).message}); contrato ${c.code} pulado.`);
          results.push({ contract: c.code, status: 'SKIPPED', reason: `índice ${idx} indisponível` });
          skipped++;
          continue;
        }
      }

      const oldValue = Number(c.rentalValue);
      const newValue = Math.round(oldValue * (1 + rate) * 100) / 100;

      await this.prisma.contract.update({
        where: { id: c.id },
        data: { rentalValue: newValue, lastAdjustedAt: new Date() },
      });
      await this.auditService.log({
        workspaceId: c.workspaceId,
        action: 'CONTRACT_RENT_ADJUSTED',
        entity: 'Contract',
        entityId: c.id,
        before: { rentalValue: oldValue },
        after: { rentalValue: newValue, index: idx, rate },
      });

      results.push({ contract: c.code, status: 'ADJUSTED', index: idx, rate, oldValue, newValue });
      adjusted++;
    }

    const summary = { eligible: eligible.length, adjusted, skipped, results };
    this.logger.log(`Reajuste de aluguéis: ${JSON.stringify({ eligible: eligible.length, adjusted, skipped })}`);
    return summary;
  }
}
