'use client';

// Quadro do cálculo da comissão de um contrato de venda/intermediação e do
// repasse aos corretores parceiros. Os números vêm prontos do backend
// (contracts.service → calcCommissionBreakdown), em centavos exatos.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));
}

export interface CommissionBreakdown {
  baseValue: number;
  commissionRate: number;
  commissionTotal: number;
  splitBase: number;
  splitBaseSource: 'PREVISTO' | 'RECEBIDO';
  partners: Array<{ recipientId: string; name: string; type: string; percentage: number | null; amount: number }>;
  partnersTotal: number;
  agencyAmount: number;
  agencyPercentage: number;
}

function pct(v: number) {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

export function CommissionBreakdownCard({ data }: { data: CommissionBreakdown }) {
  const received = data.splitBaseSource === 'RECEBIDO';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cálculo da comissão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md bg-muted/50 p-3 space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor da negociação</span>
            <span>{formatCurrency(data.baseValue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxa de comissão</span>
            <span>{pct(data.commissionRate)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Comissão total (prevista)</span>
            <span>{formatCurrency(data.commissionTotal)}</span>
          </div>
          {received && (
            <div className="flex justify-between font-medium text-emerald-700">
              <span>Comissão efetivamente recebida</span>
              <span>{formatCurrency(data.splitBase)}</span>
            </div>
          )}
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-medium">Quem recebe</th>
              <th className="py-1 font-medium text-right">Regra</th>
              <th className="py-1 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.partners.map((p) => (
              <tr key={p.recipientId}>
                <td className="py-1.5">{p.name} <span className="text-xs text-muted-foreground">(parceiro)</span></td>
                <td className="py-1.5 text-right">
                  {p.percentage != null ? `${pct(p.percentage)} da comissão` : 'valor fixo'}
                </td>
                <td className="py-1.5 text-right">{formatCurrency(p.amount)}</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="py-1.5">Imobiliária</td>
              <td className="py-1.5 text-right">{pct(data.agencyPercentage)} da comissão</td>
              <td className="py-1.5 text-right">{formatCurrency(data.agencyAmount)}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs text-muted-foreground">
          {received
            ? 'O repasse foi calculado sobre o valor efetivamente recebido.'
            : 'Valores previstos. Quando a comissão for recebida, o repasse é recalculado sobre o valor recebido.'}
          {data.partners.length === 0 && ' Este contrato não tem corretores parceiros.'}
        </p>
      </CardContent>
    </Card>
  );
}
