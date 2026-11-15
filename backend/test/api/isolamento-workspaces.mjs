// Isolamento entre imobiliárias (workspaces) contra a API REAL (banco de TESTE).
// A imobiliária A cadastra dados com uma marca única; a imobiliária B percorre as
// listagens e tenta ler/alterar/apagar os registros de A. Nada de A pode aparecer para B.
// Uso (de dentro de backend/): API_URL=http://localhost:3001/api/v1 node test/api/isolamento-workspaces.mjs
// Nunca rode contra produção: o roteiro cria imobiliárias de teste.
import { makeClient } from './_simuladores.mjs';

const call = makeClient(process.env.API_URL || 'http://localhost:3001/api/v1');
const results = [];
const ok = (name, cond, extra = '') => results.push([!!cond, name, extra]);
const run = Date.now().toString(36);
const MARK = 'ZZISO' + run.toUpperCase();
const iso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const YEAR = new Date().getFullYear();
async function register(slug) {
  const r = await call('POST', '/auth/register', { body: { workspaceName: 'Imob ' + slug, workspaceSlug: slug, email: `${slug}@teste.local`, name: 'Dono', password: 'Senha@12345' } });
  if (r.status >= 300) throw new Error('cadastro falhou: ' + JSON.stringify(r.raw));
  return { token: r.data.accessToken, ws: r.data.workspaceId };
}

try {
  const A = await register('isoa' + run);
  const Bw = await register('isob' + run);
  const asA = (o = {}) => ({ ...A, ...o });
  const asB = (o = {}) => ({ ...Bw, ...o });

  // Dados da imobiliária A
  const seller = (await call('POST', '/contacts', asA({ body: { type: 'PERSON', name: MARK + ' Vendedor', cpf: '11144477735' } }))).data;
  const buyer = (await call('POST', '/contacts', asA({ body: { type: 'PERSON', name: MARK + ' Comprador', cpf: '52998224725' } }))).data;
  const prop = (await call('POST', '/properties', asA({ body: { type: 'HOUSE', purpose: 'SALE', city: 'Franca', street: 'Rua ' + MARK, number: '7', salePrice: 300000, ownerId: seller.id } }))).data;
  const pipes = (await call('GET', '/pipelines', asA())).data;
  const funnel = (Array.isArray(pipes) ? pipes : pipes.items).find((p) => p.name === 'Funil de Venda');
  const deal = (await call('POST', '/deals', asA({ body: { title: MARK + ' negócio', contactId: buyer.id, pipelineId: funnel.id, propertyIds: [prop.id] } }))).data;
  const when = new Date(Date.now() + 3 * 864e5); when.setUTCHours(15, 0, 0, 0);
  const visit = (await call('POST', '/visits', asA({ body: { dealId: deal.id, propertyId: prop.id, scheduledAt: when.toISOString() } }))).data;
  const proposal = (await call('POST', '/proposals', asA({ body: { dealId: deal.id, amount: 290000, paymentMethod: 'CASH', validUntil: iso(5) } }))).data;
  const ctr = (await call('POST', '/contracts', asA({ body: { type: 'SALE', propertyId: prop.id, ownerId: seller.id, tenantId: buyer.id, saleValue: 290000, commissionRate: 6 } }))).data;
  await call('POST', `/contracts/${ctr.id}/sale/activate`, asA({ body: { installmentsCount: 1, firstDueDate: iso(10), paymentMethod: 'CASH' } }));
  const entry = (await call('POST', '/financial/entries', asA({ body: { type: 'RECEIVABLE', category: 'OTHER', description: MARK + ' taxa', amount: 500, dueDate: iso(5), contactId: buyer.id } }))).data;
  const ids = [seller.id, buyer.id, prop.id, deal.id, visit.id, proposal.id, ctr.id, entry.id];
  ok('preparo: imobiliária A cadastrou cliente, imóvel, negócio, visita, proposta, contrato e conta', ids.every(Boolean), JSON.stringify(ids));

  // 1. Listagens de B não trazem nada de A
  const lists = [
    '/contacts?limit=100', '/properties?limit=100', `/deals?limit=100`, '/visits', '/activities?limit=100',
    '/contracts?limit=100', '/financial/entries?limit=100', '/financial/summary', `/financial/cash-flow?granularity=month`, `/financial/dre?year=${YEAR}`,
    '/billing/boletos', '/nfse', `/fiscal/dimob/export?year=${YEAR}`, '/esignature/envelopes', '/notifications', '/users/workspace/members',
    `/reports/sales/vgv?from=${YEAR}-01-01&to=${YEAR}-12-31`, '/reports/sales/commissions', '/reports/sales/idle-properties?days=1', '/reports/sales-dashboard',
    `/contacts?search=${MARK}`, `/properties?search=${MARK}`,
  ];
  const leaks = []; const broken = [];
  for (const p of lists) {
    const r = await call('GET', p, asB());
    if (r.status !== 200) { broken.push(`${p}=${r.status}`); continue; }
    const txt = JSON.stringify(r.raw ?? '');
    if (txt.includes(MARK) || ids.some((id) => txt.includes(id)) || txt.includes('290000')) leaks.push(p);
  }
  ok(`1. ${lists.length} listagens e relatórios de B respondem e não mostram nada de A`, leaks.length === 0 && broken.length === 0, `vazou em: ${leaks.join(' ')} | não respondeu: ${broken.join(' ')}`);
  const own = await call('GET', `/contacts?search=${MARK}`, asA());
  ok('1b. a própria A enxerga os dados dela (o teste não está "passando no vazio")', JSON.stringify(own.raw).includes(MARK));

  // 2. Leitura direta por ID
  const reads = [`/proposals?dealId=${deal.id}`, `/contacts/${buyer.id}`, `/properties/${prop.id}`, `/deals/${deal.id}`, `/contracts/${ctr.id}`, `/financial/entries/${entry.id}`, `/deals/${deal.id}/contract-draft`, `/contracts/${ctr.id}/checklist`, `/financial/entries/${entry.id}/payments`, `/lgpd/contacts/${buyer.id}/export`];
  const rs = []; for (const p of reads) rs.push((await call('GET', p, asB())).status);
  ok('2. ler registro de A pelo endereço direto devolve "não encontrado"', rs.every((s) => s === 404), rs.join(','));

  // 3. Alterar / apagar / operar
  const writes = [
    ['PATCH', `/contacts/${buyer.id}`, { name: 'invadido' }], ['DELETE', `/contacts/${buyer.id}`], ['PATCH', `/properties/${prop.id}`, { salePrice: 1 }], ['DELETE', `/properties/${prop.id}`],
    ['PATCH', `/deals/${deal.id}`, { title: 'invadido' }], ['DELETE', `/deals/${deal.id}`], ['PATCH', `/visits/${visit.id}/complete`, { interestLevel: 'LOW' }], ['PATCH', `/proposals/${proposal.id}/accept`, {}],
    ['POST', `/contracts/${ctr.id}/sale/rescind`, { reason: 'invasão' }], ['POST', `/financial/entries/${entry.id}/payments`, { principal: 500 }], ['POST', `/financial/entries/${entry.id}/cancel`, { reason: 'invasão' }],
    ['POST', `/nfse/entries/${entry.id}`, {}], ['POST', `/lgpd/contacts/${buyer.id}/anonymize`, { reason: 'invasão' }],
  ];
  const ws = []; for (const [m, p, b] of writes) ws.push((await call(m, p, asB({ body: b }))).status);
  ok('3. alterar, apagar, baixar, rescindir ou anonimizar registro de A é recusado', ws.every((s) => s === 404 || s === 400), ws.join(','));
  const refs = await Promise.all([
    call('POST', '/deals', asB({ body: { title: 'x', contactId: buyer.id, pipelineId: funnel.id } })),
    call('POST', '/financial/entries', asB({ body: { type: 'RECEIVABLE', category: 'OTHER', description: 'x', amount: 1, dueDate: iso(1), contactId: buyer.id } })),
    call('POST', '/billing/boletos', asB({ body: { financialEntryId: entry.id } })),
  ]);
  ok('3b. B não consegue usar cliente, funil ou conta de A em cadastros próprios', refs.every((r) => r.status === 400 || r.status === 404), refs.map((r) => r.status).join(','));

  // 4. Nada mudou em A
  const after = await Promise.all([call('GET', `/contacts/${buyer.id}`, asA()), call('GET', `/contracts/${ctr.id}`, asA()), call('GET', `/financial/entries/${entry.id}`, asA()), call('GET', `/properties/${prop.id}`, asA())]);
  ok('4. depois das tentativas, os dados de A continuam intactos', after[0].data.name === MARK + ' Comprador' && after[1].data.status === 'ACTIVE' && after[2].data.status !== 'CANCELLED' && after[2].data.status !== 'PAID' && Number(after[3].data.salePrice) === 300000, after.map((r) => r.status).join(','));

  // 5. Trocar ou omitir o cabeçalho da imobiliária não dá acesso
  const cross = await call('GET', '/contacts', { token: Bw.token, ws: A.ws });
  const noTok = await call('GET', '/contacts', { ws: A.ws });
  ok('5. usuário de B apontando para a imobiliária A é barrado; sem login, também', cross.status === 403 && noTok.status === 401, `${cross.status},${noTok.status}`);
  // Sem o cabeçalho, o sistema usa a imobiliária do próprio usuário — nunca "todas".
  const noHeader = [];
  for (const p of lists) {
    const r = await call('GET', p, { token: Bw.token });
    const txt = JSON.stringify(r.raw ?? '');
    if (r.status === 200 && (txt.includes(MARK) || ids.some((id) => txt.includes(id)))) noHeader.push(p);
  }
  const noHeaderRead = await call('GET', `/contacts/${buyer.id}`, { token: Bw.token });
  const noHeaderWrite = await call('PATCH', `/contacts/${buyer.id}`, { token: Bw.token, body: { name: 'invadido' } });
  ok('6. chamada SEM o cabeçalho da imobiliária não devolve nem altera dados de outra imobiliária', noHeader.length === 0 && noHeaderRead.status === 404 && noHeaderWrite.status === 404, `vazou em: ${noHeader.join(' ')} | leitura ${noHeaderRead.status} escrita ${noHeaderWrite.status}`);
  const still = await call('GET', `/contacts/${buyer.id}`, asA());
  ok('6b. o cliente de A continua com o nome original', still.data?.name === MARK + ' Comprador', still.data?.name);
} catch (err) {
  ok('roteiro interrompido por erro inesperado', false, err?.stack ?? String(err));
}

let fail = 0;
for (const [c, n, e] of results) { if (!c) fail++; console.log(c ? 'OK  ' : 'FAIL', n, c ? '' : '→ ' + e); }
console.log(`\n${results.length - fail}/${results.length} verificações passaram`);
process.exit(fail ? 1 : 0);
