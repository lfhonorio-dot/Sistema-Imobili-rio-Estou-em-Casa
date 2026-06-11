'use client';
import { useState, useEffect } from 'react';
import { useFiscal } from '@/hooks/use-fiscal';

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
