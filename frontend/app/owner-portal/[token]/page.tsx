// Portal do Proprietário — extrato público de repasse (acesso por token, sem login)
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Building2, Loader2, XCircle } from 'lucide-react';

const API_BASE =
  process.env.NODE_ENV === 'production'
    ? '/api-proxy'
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface PortalData {
  property?: { code?: string; street?: string | null; city?: string | null } | null;
  owner?: { name?: string } | null;
  summary: { totalReceived: number; totalCommissions: number; totalExpenses: number; repasse: number };
  entries: Array<{ description?: string; category?: string; type: string; amount: number; dueDate: string; status: string; paidAt?: string | null }>;
  commissions: Array<{ rate: number; amount: number; status: string }>;
}

function brl(v: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));
}
function dt(v?: string | null) {
  return v ? new Date(v).toLocaleDateString('pt-BR') : '—';
}

const STATUS_PT: Record<string, string> = {
  PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Em atraso', CANCELLED: 'Cancelado', EXEMPT: 'Isento',
};

export default function OwnerPortalPage() {
  const params = useParams();
  const token = String(params.token);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/contracts/owner-portal/${token}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.message || 'Link inválido ou expirado.');
          return;
        }
        setData(json.data ?? json);
      } catch {
        setError('Não foi possível carregar o extrato. Tente novamente.');
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Extrato do Proprietário</h1>
            {data?.property && (
              <p className="text-sm text-gray-500">
                {data.property.code} — {data.property.street ?? ''}{data.property.city ? `, ${data.property.city}` : ''}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-10 text-center shadow">
            <XCircle className="h-10 w-10 text-red-500" />
            <p className="text-gray-700">{error}</p>
          </div>
        )}

        {!data && !error && (
          <div className="flex items-center justify-center rounded-xl bg-white p-10 shadow">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {data && (
          <>
            {data.owner?.name && (
              <p className="mb-4 text-sm text-gray-600">Proprietário: <strong>{data.owner.name}</strong></p>
            )}

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Recebido', value: data.summary.totalReceived, color: 'text-blue-600' },
                { label: 'Comissões', value: data.summary.totalCommissions, color: 'text-amber-600' },
                { label: 'Despesas', value: data.summary.totalExpenses, color: 'text-red-500' },
                { label: 'Repasse', value: data.summary.repasse, color: 'text-green-600' },
              ].map((k) => (
                <div key={k.label} className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-lg font-bold ${k.color}`}>{brl(k.value)}</p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="border-b px-4 py-3 font-semibold text-gray-900">Lançamentos</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Descrição</th>
                      <th className="px-4 py-2">Vencimento</th>
                      <th className="px-4 py-2">Valor</th>
                      <th className="px-4 py-2">Situação</th>
                      <th className="px-4 py-2">Pago em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2">{e.description ?? e.category}</td>
                        <td className="px-4 py-2">{dt(e.dueDate)}</td>
                        <td className="px-4 py-2 font-medium">{brl(e.amount)}</td>
                        <td className="px-4 py-2">{STATUS_PT[e.status] ?? e.status}</td>
                        <td className="px-4 py-2">{dt(e.paidAt)}</td>
                      </tr>
                    ))}
                    {data.entries.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sem lançamentos.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              Documento informativo gerado eletronicamente. Em caso de dúvidas, contate sua imobiliária.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
