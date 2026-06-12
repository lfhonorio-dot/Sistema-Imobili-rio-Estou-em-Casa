'use client';
import { useEffect, useState } from 'react';
import { useAdmin } from '@/hooks/use-admin';

const TABS = ['Visão Geral', 'Feature Flags', 'Onboarding'] as const;
type Tab = typeof TABS[number];

interface Stats { workspaces: number; users: number; properties: number; contacts: number; }
interface Flag { key: string; enabled: boolean; description?: string; }
interface Step { step: string; completed: boolean; }

export default function AdminPage() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '';
  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspaceId') ?? '' : '';
  const admin = useAdmin(token, workspaceId);

  const [tab, setTab] = useState<Tab>('Visão Geral');
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<string>('...');
  const [flags, setFlags] = useState<Flag[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [newFlag, setNewFlag] = useState({ key: '', enabled: true, description: '' });

  useEffect(() => {
    admin.getPlatformHealth().then((h: { status: string }) => setHealth(h?.status ?? 'error'));
    admin.getPlatformStats().then(s => s && setStats(s));
    admin.getFeatureFlags().then(f => f && setFlags(f));
    admin.getOnboardingSteps().then(s => s && setSteps(s));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFlag = async (flag: Flag) => {
    await admin.setFeatureFlag({ key: flag.key, enabled: !flag.enabled, description: flag.description });
    admin.getFeatureFlags().then(f => f && setFlags(f));
  };

  const createFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    await admin.setFeatureFlag(newFlag);
    setNewFlag({ key: '', enabled: true, description: '' });
    admin.getFeatureFlags().then(f => f && setFlags(f));
  };

  const completeStep = async (step: string) => {
    const res = await admin.completeOnboardingStep(step);
    if (res) setSteps(res);
  };

  const completed = steps.filter(s => s.completed).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Administração</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${health === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          Sistema: {health}
        </span>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Visão Geral' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Workspaces', value: stats?.workspaces ?? '-' },
              { label: 'Usuários', value: stats?.users ?? '-' },
              { label: 'Imóveis', value: stats?.properties ?? '-' },
              { label: 'Contatos', value: stats?.contacts ?? '-' },
            ].map(c => (
              <div key={c.label} className="bg-white border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{c.value}</p>
                <p className="text-sm text-gray-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Feature Flags' && (
        <div className="space-y-4">
          <form onSubmit={createFlag} className="bg-white border rounded-lg p-4 flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Chave</label>
              <input required placeholder="ex: nova_funcionalidade" value={newFlag.key}
                onChange={e => setNewFlag(f => ({ ...f, key: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Descrição</label>
              <input placeholder="opcional" value={newFlag.description}
                onChange={e => setNewFlag(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Criar
            </button>
          </form>

          {flags.map(flag => (
            <div key={flag.key} className="bg-white border rounded-lg p-4 flex justify-between items-center">
              <div>
                <p className="font-mono font-medium">{flag.key}</p>
                {flag.description && <p className="text-sm text-gray-500">{flag.description}</p>}
              </div>
              <button onClick={() => toggleFlag(flag)}
                className={`px-4 py-2 rounded text-sm font-medium ${flag.enabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {flag.enabled ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          ))}
          {flags.length === 0 && <p className="text-gray-400 text-center py-8">Nenhuma feature flag configurada</p>}
        </div>
      )}

      {tab === 'Onboarding' && (
        <div>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progresso</span>
              <span>{completed}/{steps.length} concluídos</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${steps.length ? (completed / steps.length) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="space-y-2">
            {steps.map(s => (
              <div key={s.step} className="bg-white border rounded-lg p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${s.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {s.completed ? '✓' : '○'}
                  </span>
                  <span className="font-medium text-sm">{s.step.replace(/_/g, ' ')}</span>
                </div>
                {!s.completed && (
                  <button onClick={() => completeStep(s.step)}
                    className="text-xs border px-3 py-1 rounded hover:bg-gray-50">
                    Marcar como concluído
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
