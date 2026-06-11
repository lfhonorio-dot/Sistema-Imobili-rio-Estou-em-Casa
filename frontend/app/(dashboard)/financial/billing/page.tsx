'use client';
import { useState, useEffect } from 'react';
import { useBilling } from '@/hooks/use-billing';

type Boleto = {
  id: string;
  amount: number;
  dueDate: string;
  status: string;
  nossoNumero: string;
  linhaDigitavel?: string;
  paidAt?: string;
  paidAmount?: number;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente', REGISTERED: 'Registrado', PAID: 'Pago',
  OVERDUE: 'Vencido', CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  REGISTERED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function BillingPage() {
  const { findBoletos, confirmPayment, loading } = useBilling();
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [total, setTotal] = useState(0);

  const load = async () => {
    const data = await findBoletos({ page: 1, limit: 20 });
    if (data) { setBoletos(data.items); setTotal(data.meta.total); }
  };

  useEffect(() => { load(); }, []);

  const handleConfirm = async (id: string) => {
    if (!confirm('Confirmar pagamento deste boleto?')) return;
    await confirmPayment(id);
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Boletos</h1>
          <p className="text-sm text-gray-500 mt-1">{total} boleto(s) no total</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : boletos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhum boleto encontrado</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Nosso Número</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Valor</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Vencimento</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {boletos.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{b.nossoNumero}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {b.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(b.dueDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status] ?? 'bg-gray-100'}`}>
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {['PENDING', 'REGISTERED', 'OVERDUE'].includes(b.status) && (
                      <button
                        onClick={() => handleConfirm(b.id)}
                        className="text-xs text-green-600 hover:underline"
                      >
                        Confirmar Pag.
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
