'use client';
import { Suspense, useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UnavailableNotice } from '@/components/common/error-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { useOperationProfile } from '@/hooks/use-operation-profile';
import { useFiscal } from '@/hooks/use-fiscal';
import { NfsePanel } from '@/components/nfse/nfse-panel';
import { validateDimob } from '@/hooks/use-team';
import api from '@/lib/api';

type Tab = 'nfse' | 'dimob' | 'carne-leao';

export default function FiscalPage() {
  return (
    <Suspense fallback={null}>
      <FiscalPageContent />
    </Suspense>
  );
}

// A aba vem do endereço (?tab=nfse | dimob | carne-leao) para o menu abrir
// direto em "Notas Fiscais" ou "Fiscal — DIMOB". Carnê-Leão (aluguel de PF)
// só aparece no perfil Venda e Locação.
function FiscalPageContent() {
  const { findDimob, findCarneLeao, generateDimob, loading } = useFiscal();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const profile = useOperationProfile();
  const tabs: Tab[] = profile === 'VENDA_E_LOCACAO' ? ['nfse', 'dimob', 'carne-leao'] : ['nfse', 'dimob'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam && tabs.includes(tabParam) ? tabParam : 'nfse';
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  const [dimobList, setDimobList] = useState<Array<Record<string, unknown>>>([]);
  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()));
  const [declarants, setDeclarants] = useState<Array<Record<string, unknown>>>([]);
  const [exportCsv, setExportCsv] = useState('');
  const [carneLeaoList, setCarneLeaoList] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
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

  // CNPJs da própria imobiliária no ano (troca de CNPJ no meio do ano = um arquivo para cada)
  const [companyCnpjs, setCompanyCnpjs] = useState<Array<{ cnpj: string | null; cnpjFormatted: string; name: string | null; periodFrom: string; periodTo: string; events: number }>>([]);
  async function loadDeclarants() {
    try {
      const [res, comp] = await Promise.all([
        api.get('/fiscal/dimob/export', { params: { year: exportYear } }),
        api.get('/fiscal/dimob/declarants', { params: { year: exportYear } }),
      ]);
      const data = res.data.data;
      setDeclarants(data?.declarantes ?? []);
      setExportCsv(data?.csv ?? '');
      setCompanyCnpjs(comp.data.data?.company ?? []);
    } catch (err) {
      alert(getApiErrorMessage(err, 'Erro ao carregar exportação DIMOB.'));
    }
  }

  function downloadBlob(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const [validation, setValidation] = useState<Awaited<ReturnType<typeof validateDimob>> | null>(null);
  async function runValidation(declarantDoc: string) {
    try {
      setValidation(await validateDimob(Number(exportYear), declarantDoc));
    } catch (err) {
      alert(getApiErrorMessage(err, 'Não foi possível validar a DIMOB.'));
    }
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
        {tabs.map((t) => (
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

      {tab === 'nfse' && <NfsePanel initialSub={searchParams.get('sub')} />}

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
                      <p className="font-semibold">{Number(d.totalValue ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
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
            {validation && (
              <div className={`rounded border p-3 text-sm ${validation.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <p className="font-medium">
                  {validation.ok ? 'Arquivo sem erros' : `${validation.errors} erro(s)`}{validation.warnings ? ` e ${validation.warnings} aviso(s)` : ''} · {validation.sales} venda(s)
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {validation.issues.map((x, i) => <li key={i} className={x.level === 'ERROR' ? 'text-red-700' : 'text-amber-700'}>{x.where}: {x.message}</li>)}
                </ul>
                <p className="mt-2 text-xs text-gray-600">Confere vendedor e comprador (CPF/CNPJ válidos e nome), valores, datas e a estrutura do arquivo (R01, R02 locação, R04 venda, T9). O programa da Receita faz a conferência final ao importar.</p>
              </div>
            )}
            {companyCnpjs.length > 1 && (
              <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-medium">A empresa trocou de CNPJ em {exportYear}: entregue uma DIMOB para cada CNPJ.</p>
                <p className="text-xs text-gray-600 mb-2">Cada operação entra no CNPJ que estava valendo na data dela. Escolha o declarante:</p>
                <div className="space-y-2">
                  {companyCnpjs.map((c) => {
                    const doc = c.cnpj ?? '';
                    const until = new Date(new Date(c.periodTo).getTime() - 864e5);
                    return (
                      <div key={doc} className="flex items-center justify-between rounded border bg-white p-2">
                        <div>
                          <p className="font-medium">{c.name ?? '(sem razão social)'} — CNPJ {c.cnpjFormatted}</p>
                          <p className="text-xs text-gray-500">
                            de {new Date(c.periodFrom).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} até {until.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · {c.events} operação(ões)
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => void runValidation(doc)} disabled={!doc || !c.events} className="border text-xs px-3 py-2 rounded disabled:opacity-40">Validar</button>
                          <button onClick={() => downloadPgd(doc)} disabled={!doc || !c.events} className="bg-gray-900 text-white text-xs px-3 py-2 rounded disabled:opacity-40">Arquivo PGD deste CNPJ</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => void runValidation(String(d.declarantDoc ?? ''))}
                        disabled={!d.declarantDoc}
                        className="border text-xs px-3 py-2 rounded disabled:opacity-40"
                      >
                        Validar
                      </button>
                      <button
                        onClick={() => downloadPgd(String(d.declarantDoc ?? ''))}
                        disabled={!d.declarantDoc}
                        className="bg-gray-900 text-white text-xs px-3 py-2 rounded disabled:opacity-40"
                      >
                        Arquivo PGD (TXT)
                      </button>
                    </div>
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
                        {Number(c.grossIncome).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {Number(c.taxableBase).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        {Number(c.taxDue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
