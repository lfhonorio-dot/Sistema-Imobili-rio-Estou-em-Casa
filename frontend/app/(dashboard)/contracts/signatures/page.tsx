'use client';
import { useState, useEffect } from 'react';
import { useEsignature } from '@/hooks/use-esignature';

type Envelope = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  deadline?: string;
  signatories?: Array<{ id: string; name: string; role: string; status: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho', SENT: 'Enviado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function SignaturesPage() {
  const { findAll, send, cancel, loading } = useEsignature();
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (p = page) => {
    const data = await findAll({ page: p, limit: 20 });
    if (data) {
      setEnvelopes(data.items);
      setTotal(data.meta.total);
    }
  };

  useEffect(() => { load(1); }, []);

  const handleSend = async (id: string) => {
    if (!confirm('Enviar envelope para assinatura?')) return;
    await send(id);
    load();
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancelar envelope?')) return;
    await cancel(id);
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assinaturas Eletrônicas</h1>
          <p className="text-sm text-gray-500 mt-1">{total} envelopes no total</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : envelopes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhum envelope encontrado</div>
      ) : (
        <div className="space-y-4">
          {envelopes.map((env) => (
            <div key={env.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{env.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[env.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[env.status] ?? env.status}
                    </span>
                  </div>
                  {env.deadline && (
                    <p className="text-xs text-gray-500 mt-1">
                      Prazo: {new Date(env.deadline).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {env.signatories && env.signatories.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {env.signatories.map((s) => (
                        <span key={s.id} className="text-xs bg-gray-50 border rounded px-2 py-0.5 text-gray-600">
                          {s.name} ({s.role}) — {s.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  {env.status === 'DRAFT' && (
                    <button
                      onClick={() => handleSend(env.id)}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                    >
                      Enviar
                    </button>
                  )}
                  {['DRAFT', 'SENT'].includes(env.status) && (
                    <button
                      onClick={() => handleCancel(env.id)}
                      className="text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded hover:bg-red-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
