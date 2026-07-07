'use client';
import { useState, useEffect } from 'react';
import { useFiscal } from '@/hooks/use-fiscal';
import api from '@/lib/api';

type NfseRecord = {
  id: string;
  issuerCnpj: string;
  takerName: string;
  amount: number;
  issRate: number;
  status: string;
  issuedAt?: string;
};

type Tab = 'nfse' | 'dimob' | 'carne-leao';

const STATUS_COLORS: Record<string, string> = {
  ISSUED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
  ERROR: 'bg-red-100 text-red-700',
};

export default function FiscalPage() {
  const { findNfse, findDimob, findCarneLeao, generateDimob, loading } = useFiscal();
  const [tab, setTab] = useState<Tab>('nfse');
  const [nfseList, setNfseList] = useState<NfseRecord[]>([]);
  const [dimobList, setDimobList] = useState<Array<Record<string, unknown>>>([]);
  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()));
  const [declarants, setDeclarants] = useState<Array<Record<string, unknown>>>([]);
  const [exportCsv, setExportCsv] = useState('');
  const [carneLeaoList, setCarneLeaoList] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (tab === 'nfse') findNfse().then(d => d && setNfseList(d.items));
    if (tab === 'dimob') findDimob().then(d => d && setDimobList(d));
    if (tab === 'carne-leao') findCarneLeao().then(d => d && setCarneLeaoList(d));
  }, [tab]);

  const handleGenerateDimob = async () => {
    const year = new Date().getFullYear() - 1;
    if (!confirm(`Gerar DIMOB para o ano ${year}?`)) return;
    const result = await generateDimob(year);
    if (result) {
      alert(`DIMOB gerado: ${result.total} registros`);
      findDimob().then(d => d && setDimobList(d));
    }
  };

  async function loadDeclarants() {
    try {
      const res = await api.get('/fiscal/dimob/export', { params: { year: exportYear } });
      const data = res.data.data;
      setDeclarants(data?.declarantes ?? []);
      setExportCsv(data?.csv ?? '');
    } catch {
      alert('Erro ao carregar exportação DIMOB.');
    }
  }

  function downloadBlob(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPgd(declarantDoc: string) {
    try {
      const res = await api.get('/fiscal/dimob/pgd', { params: { year: exportYear, declarantDoc } });
      const d = res.data.data;
      downloadBlob(d.content, d.filename);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao gerar arquivo PGD.';
      alert(Array.isArray(msg) ? msg[0] : msg);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fiscal</h1>
        <p className="text-sm text-gray-500 mt-1">NFS-e, DIMOB, IRRF e Carnê-Leão</p>
      </div>

      <div className="flex gap-1 border-b mb-6">
        {(['nfse', 'dimob', 'carne-leao'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'nfse' ? 'NFS-e' : t === 'dimob' ? 'DIMOB' : 'Carnê-Leão'}
          </button>
        ))}
      </div>

      {tab === 'nfse' && (
        <div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : nfseList.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nenhuma NFS-e encontrada</div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Tomador</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Valor</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">ISS %</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Emissão</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nfseList.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{n.takerName}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {n.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{n.issRate}%</td>
                      <td className="px-4 py-3 text-gray-500">
                        {n.issuedAt ? new Date(n.issuedAt).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[n.status] ?? 'bg-gray-100'}`}>
                          {n.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'dimob' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={handleGenerateDimob}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
            >
              Gerar DIMOB {new Date().getFullYear() - 1}
            </button>
          </div>
          {dimobList.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nenhum registro DIMOB</div>
          ) : (
            <div className="space-y-2">
              {dimobList.map((d) => (
                <div key={d.id as string} className="bg-white border rounded-lg p-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{d.locadorName as string} → {d.locatarioName as string}</p>
                      <p className="text-sm text-gray-500">{d.propertyAddress as string}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{(d.totalValue as number)?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      <p className="text-xs text-gray-400">Ano {d.year as number}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Exportação por declarante (rateio PJ/PF) + arquivo PGD */}
          <div className="mt-8 bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Exportação por declarante (split PJ/PF)</h3>
            <p className="text-sm text-gray-500 mb-3">
              Agrega os eventos DIMOB por CNPJ declarante (imobiliária e corretores parceiros PJ) e
              gera o CSV de conferência e o arquivo TXT de importação do PGD DIMOB.
            </p>
            <div className="flex items-center gap-2 mb-4">
              <input
                value={exportYear}
                onChange={(e) => setExportYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="border rounded px-3 py-2 w-28 text-sm"
                placeholder="Ano"
              />
              <button onClick={loadDeclarants} className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700">
                Carregar declarantes
              </button>
              {exportCsv && (
                <button
                  onClick={() => downloadBlob(exportCsv, `DIMOB_${exportYear}.csv`)}
                  className="border text-sm px-4 py-2 rounded hover:bg-gray-50"
                >
                  Baixar CSV completo
                </button>
              )}
            </div>
            {declarants.length > 0 && (
              <div className="space-y-2">
                {declarants.map((d, i) => (
                  <div key={i} className="flex items-center justify-between border rounded p-3">
                    <div>
                      <p className="font-medium">{String(d.declarantName ?? '(sem nome)')}</p>
                      <p className="text-xs text-gray-500">
                        Doc: {String(d.declarantDoc || '—')} · {String(d.totalOperacoes)} operação(ões) ·
                        Comissão total: {Number(d.totalComissao ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadPgd(String(d.declarantDoc ?? ''))}
                      disabled={!d.declarantDoc}
                      className="bg-gray-900 text-white text-xs px-3 py-2 rounded disabled:opacity-40"
                    >
                      Arquivo PGD (TXT)
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'carne-leao' && (
        <div>
          {carneLeaoList.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nenhum registro de Carnê-Leão</div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Período</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Rendimento Bruto</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Base Cálculo</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Imposto</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {carneLeaoList.map((c) => (
                    <tr key={c.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono">{c.period as string}</td>
                      <td className="px-4 py-3 text-right">
                        {(c.grossIncome as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(c.taxableBase as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        {(c.taxDue as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{c.status as string}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
