'use client';
import { useEffect, useState } from 'react';
import { useAutomation } from '@/hooks/use-automation';

const TRIGGERS = [
  'DEAL_CREATED', 'DEAL_STAGE_CHANGED', 'DEAL_WON', 'DEAL_LOST',
  'TAG_ADDED', 'TAG_REMOVED', 'LEAD_META_ADS', 'LEAD_GOOGLE_ADS',
  'LEAD_PORTAL', 'CONTRACT_CREATED', 'CONTRACT_EXPIRING',
  'BOLETO_OVERDUE', 'BOLETO_PAID', 'MAINTENANCE_OPENED',
  'WHATSAPP_RECEIVED', 'WEBHOOK_RECEIVED', 'INACTIVITY', 'SCHEDULED',
];

interface Automation {
  id: string;
  name: string;
  trigger: string;
  status: string;
  executions: number;
  successes: number;
  failures: number;
  lastRunAt: string | null;
  _count?: { logs: number };
}

export default function AutomationPage() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '';
  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspaceId') ?? '' : '';
  const { loading, listAutomations, createAutomation, updateAutomation, deleteAutomation } = useAutomation(token, workspaceId);

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', trigger: 'DEAL_CREATED', description: '' });

  const load = async () => {
    const res = await listAutomations();
    if (res) setAutomations(res.items ?? []);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAutomation({ ...form, steps: [] });
    setShowForm(false);
    setForm({ name: '', trigger: 'DEAL_CREATED', description: '' });
    load();
  };

  const toggleStatus = async (a: Automation) => {
    await updateAutomation(a.id, { status: a.status !== 'ACTIVE' });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir automação?')) return;
    await deleteAutomation(id);
    load();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Automações</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Nova Automação
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-lg p-4 mb-6 space-y-3">
          <h2 className="font-semibold text-lg">Nova Automação</h2>
          <input
            required
            placeholder="Nome"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border rounded px-3 py-2"
          />
          <input
            placeholder="Descrição (opcional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full border rounded px-3 py-2"
          />
          <select
            value={form.trigger}
            onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
            className="w-full border rounded px-3 py-2"
          >
            {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Criar
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-gray-500">Carregando...</p>}

      <div className="space-y-3">
        {automations.map(a => (
          <div key={a.id} className="bg-white border rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{a.name}</p>
              <p className="text-sm text-gray-500">{a.trigger}</p>
              <div className="flex gap-4 text-xs text-gray-400 mt-1">
                <span>Execuções: {a.executions}</span>
                <span className="text-green-600">Sucesso: {a.successes}</span>
                <span className="text-red-500">Falha: {a.failures}</span>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <span className={`text-xs px-2 py-1 rounded-full ${a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {a.status}
              </span>
              <button onClick={() => toggleStatus(a)} className="text-xs border px-2 py-1 rounded hover:bg-gray-50">
                {a.status === 'ACTIVE' ? 'Pausar' : 'Ativar'}
              </button>
              <button onClick={() => remove(a.id)} className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50">
                Excluir
              </button>
            </div>
          </div>
        ))}
        {!loading && automations.length === 0 && (
          <p className="text-gray-400 text-center py-10">Nenhuma automação configurada</p>
        )}
      </div>
    </div>
  );
}
