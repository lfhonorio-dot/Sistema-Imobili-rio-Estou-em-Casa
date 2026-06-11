'use client';
import { useState, useEffect } from 'react';
import { useMarketing } from '@/hooks/use-marketing';

type Tab = 'meta' | 'google' | 'portais';
type Campaign = Record<string, unknown>;

const PORTALS = ['ZAP', 'VIVAREAL', 'OLX', 'IMOVELWEB', 'I123'];

function fmt(n: number | unknown) {
  if (typeof n !== 'number') return '—';
  return n.toLocaleString('pt-BR');
}

function fmtBRL(n: number | unknown) {
  if (typeof n !== 'number') return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function MarketingPage() {
  const {
    loading,
    syncMetaCampaigns, getMetaCampaigns, saveMetaIntegration,
    syncGoogleCampaigns, getGoogleCampaigns, saveGoogleIntegration,
    getPortalIntegrations, savePortalIntegration, deletePortalIntegration,
    getPublications,
  } = useMarketing();

  const [tab, setTab] = useState<Tab>('meta');
  const [metaCampaigns, setMetaCampaigns] = useState<Campaign[]>([]);
  const [googleCampaigns, setGoogleCampaigns] = useState<Campaign[]>([]);
  const [portalIntegrations, setPortalIntegrations] = useState<Campaign[]>([]);
  const [publications, setPublications] = useState<Campaign[]>([]);

  // Meta form
  const [metaToken, setMetaToken] = useState('');
  const [metaAccountId, setMetaAccountId] = useState('');

  // Google form
  const [googleToken, setGoogleToken] = useState('');
  const [googleCustomerId, setGoogleCustomerId] = useState('');

  // Portal form
  const [portalName, setPortalName] = useState('ZAP');
  const [portalApiKey, setPortalApiKey] = useState('');

  useEffect(() => {
    if (tab === 'meta') getMetaCampaigns().then(d => d && setMetaCampaigns(d));
    if (tab === 'google') getGoogleCampaigns().then(d => d && setGoogleCampaigns(d));
    if (tab === 'portais') {
      getPortalIntegrations().then(d => d && setPortalIntegrations(d));
      getPublications().then(d => d && setPublications(d));
    }
  }, [tab]);

  const handleSaveMeta = async () => {
    if (!metaToken || !metaAccountId) return alert('Preencha Token e Account ID');
    const ok = await saveMetaIntegration({ accessToken: metaToken, accountId: metaAccountId });
    if (ok) { alert('Integração Meta salva!'); setMetaToken(''); setMetaAccountId(''); }
  };

  const handleSyncMeta = async () => {
    const r = await syncMetaCampaigns();
    if (r) { alert(`${(r as Record<string,unknown>).synced} campanhas sincronizadas`); getMetaCampaigns().then(d => d && setMetaCampaigns(d)); }
  };

  const handleSaveGoogle = async () => {
    if (!googleToken || !googleCustomerId) return alert('Preencha Token e Customer ID');
    const ok = await saveGoogleIntegration({ accessToken: googleToken, customerId: googleCustomerId });
    if (ok) { alert('Integração Google salva!'); setGoogleToken(''); setGoogleCustomerId(''); }
  };

  const handleSyncGoogle = async () => {
    const r = await syncGoogleCampaigns();
    if (r) { alert(`${(r as Record<string,unknown>).synced} campanhas sincronizadas`); getGoogleCampaigns().then(d => d && setGoogleCampaigns(d)); }
  };

  const handleSavePortal = async () => {
    if (!portalApiKey) return alert('Informe a API Key');
    const ok = await savePortalIntegration({ portal: portalName, apiKey: portalApiKey });
    if (ok) { setPortalApiKey(''); getPortalIntegrations().then(d => d && setPortalIntegrations(d)); }
  };

  const handleDeletePortal = async (portal: string) => {
    if (!confirm(`Remover integração com ${portal}?`)) return;
    await deletePortalIntegration(portal);
    getPortalIntegrations().then(d => d && setPortalIntegrations(d));
  };

  const ctr = (c: Campaign) => {
    const imp = c.impressions as number;
    const cl = c.clicks as number;
    return imp > 0 ? ((cl / imp) * 100).toFixed(2) + '%' : '—';
  };

  const cpl = (c: Campaign) => {
    const spend = c.spend as number;
    const leads = c.leads as number;
    return leads > 0 ? fmtBRL(spend / leads) : '—';
  };

  const roi = (c: Campaign) => {
    const spend = c.spend as number;
    const rev = c.revenue as number;
    return spend > 0 ? (rev / spend).toFixed(2) + 'x' : '—';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
        <p className="text-sm text-gray-500 mt-1">Meta Ads, Google Ads e Portais Imobiliários</p>
      </div>

      <div className="flex gap-1 border-b mb-6">
        {(['meta', 'google', 'portais'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'meta' ? 'Meta Ads' : t === 'google' ? 'Google Ads' : 'Portais'}
          </button>
        ))}
      </div>

      {/* ── META ADS ─────────────────────────── */}
      {tab === 'meta' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-semibold text-gray-800 mb-4">Configurar Integração Meta</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Access Token</label>
                <input value={metaToken} onChange={e => setMetaToken(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="EAAxxxxxxxx..." />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ad Account ID</label>
                <input value={metaAccountId} onChange={e => setMetaAccountId(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="act_123456789" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSaveMeta} className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700">
                Salvar
              </button>
              <button onClick={handleSyncMeta} disabled={loading}
                className="border text-gray-700 text-sm px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-50">
                Sincronizar Campanhas
              </button>
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Campanhas</h2>
            {metaCampaigns.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-white rounded-lg border">
                Nenhuma campanha — clique em Sincronizar
              </div>
            ) : (
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Campanha','Gasto','Impressões','Cliques','Leads','CTR','CPL','ROI'].map(h => (
                        <th key={h} className="text-left px-3 py-3 text-gray-600 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {metaCampaigns.map(c => (
                      <tr key={c.id as string} className="hover:bg-gray-50">
                        <td className="px-3 py-3 font-medium">{c.name as string}</td>
                        <td className="px-3 py-3">{fmtBRL(c.spend as number)}</td>
                        <td className="px-3 py-3">{fmt(c.impressions)}</td>
                        <td className="px-3 py-3">{fmt(c.clicks)}</td>
                        <td className="px-3 py-3">{fmt(c.leads)}</td>
                        <td className="px-3 py-3">{ctr(c)}</td>
                        <td className="px-3 py-3">{cpl(c)}</td>
                        <td className="px-3 py-3">{roi(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GOOGLE ADS ───────────────────────── */}
      {tab === 'google' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-semibold text-gray-800 mb-4">Configurar Integração Google Ads</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Access Token</label>
                <input value={googleToken} onChange={e => setGoogleToken(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="ya29.xxxxxxxx" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Customer ID</label>
                <input value={googleCustomerId} onChange={e => setGoogleCustomerId(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="123-456-7890" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSaveGoogle} className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700">
                Salvar
              </button>
              <button onClick={handleSyncGoogle} disabled={loading}
                className="border text-gray-700 text-sm px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-50">
                Sincronizar Campanhas
              </button>
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Campanhas</h2>
            {googleCampaigns.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-white rounded-lg border">
                Nenhuma campanha — clique em Sincronizar
              </div>
            ) : (
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Campanha','Gasto','Cliques','Leads','Conv.','CPC','CPL','ROAS'].map(h => (
                        <th key={h} className="text-left px-3 py-3 text-gray-600 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {googleCampaigns.map(c => {
                      const spend = c.spend as number;
                      const clicks = c.clicks as number;
                      const leads = c.leads as number;
                      const rev = c.revenue as number;
                      return (
                        <tr key={c.id as string} className="hover:bg-gray-50">
                          <td className="px-3 py-3 font-medium">{c.name as string}</td>
                          <td className="px-3 py-3">{fmtBRL(spend)}</td>
                          <td className="px-3 py-3">{fmt(clicks)}</td>
                          <td className="px-3 py-3">{fmt(leads)}</td>
                          <td className="px-3 py-3">{fmt(c.conversions)}</td>
                          <td className="px-3 py-3">{clicks > 0 ? fmtBRL(spend / clicks) : '—'}</td>
                          <td className="px-3 py-3">{leads > 0 ? fmtBRL(spend / leads) : '—'}</td>
                          <td className="px-3 py-3">{spend > 0 ? (rev / spend).toFixed(2) + 'x' : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PORTAIS ──────────────────────────── */}
      {tab === 'portais' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-semibold text-gray-800 mb-4">Adicionar Portal</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Portal</label>
                <select value={portalName} onChange={e => setPortalName(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm bg-white">
                  {PORTALS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">API Key</label>
                <input value={portalApiKey} onChange={e => setPortalApiKey(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Chave de integração do portal" />
              </div>
            </div>
            <button onClick={handleSavePortal} className="mt-4 bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700">
              Salvar Integração
            </button>
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Portais Configurados</h2>
            {portalIntegrations.length === 0 ? (
              <div className="text-center py-6 text-gray-400">Nenhum portal configurado</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {portalIntegrations.map(p => (
                  <div key={p.id as string} className="bg-white border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{p.portal as string}</p>
                      <p className="text-xs text-gray-400">{(p._count as Record<string,number>)?.publications ?? 0} publicações</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{p.status as string}</span>
                      <button onClick={() => handleDeletePortal(p.portal as string)}
                        className="text-xs text-red-500 hover:text-red-700">Remover</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Publicações Recentes</h2>
            {publications.length === 0 ? (
              <div className="text-center py-6 text-gray-400">Nenhuma publicação encontrada</div>
            ) : (
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">Imóvel</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">Portal</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">Publicado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {publications.map(pub => {
                      const prop = pub.property as Record<string, unknown>;
                      const portal = pub.portal as Record<string, unknown>;
                      const statusColor: Record<string, string> = {
                        PUBLISHED: 'bg-green-100 text-green-700',
                        UNPUBLISHED: 'bg-gray-100 text-gray-600',
                        ERROR: 'bg-red-100 text-red-700',
                        PENDING: 'bg-yellow-100 text-yellow-700',
                      };
                      return (
                        <tr key={pub.id as string} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{prop?.city as string || (prop?.code as string) || '—'}</td>
                          <td className="px-4 py-3">{portal?.portal as string}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[pub.status as string] ?? 'bg-gray-100'}`}>
                              {pub.status as string}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {pub.publishedAt ? new Date(pub.publishedAt as string).toLocaleDateString('pt-BR') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
