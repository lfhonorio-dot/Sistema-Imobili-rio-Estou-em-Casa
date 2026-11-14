// Roteiro de ponta a ponta da Fase 3 (funil de venda) contra a API REAL.
// Uso: suba o backend apontando para um banco de TESTE e rode
//   API_URL=http://localhost:3001/api/v1 node test/api/fase3-funil.mjs
// Nunca rode contra produção: o roteiro cria imobiliárias de teste.
const B = process.env.API_URL || 'http://localhost:3001/api/v1';
const results = [];
const ok = (name, cond, extra = '') => results.push([cond, name, extra]);
async function call(method, path, { token, ws, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ws) headers['X-Workspace-Id'] = ws;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(B + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, data: json?.data ?? json, raw: json, text };
}
const short = (r) => JSON.stringify(r.raw).slice(0, 220);
async function register(slug) {
  const r = await call('POST', '/auth/register', { body: { workspaceName: 'Imob ' + slug, workspaceSlug: slug, email: `${slug}@teste.local`, name: 'Dono', password: 'Senha@12345' } });
  if (r.status >= 300) throw new Error('register ' + short(r));
  return { token: r.data.accessToken, ws: r.data.workspaceId };
}
const run = Date.now().toString(36);
const A = await register('f3a' + run);
const Bw = await register('f3b' + run);
const as = (o = {}) => ({ token: A.token, ws: A.ws, ...o });
const iso = (d) => d.toISOString().slice(0, 10);
const day = (n) => new Date(Date.now() + n * 864e5);

// Funil padrão criado sozinho para a imobiliária nova
const pipes = await call('GET', '/pipelines', as());
const funnel = pipes.data.find((p) => p.name === 'Funil de Venda');
const names = funnel?.stages?.map((s) => s.name) ?? [];
ok('funil padrão com as 9 etapas do dono', JSON.stringify(names) === JSON.stringify(['Novo lead', 'Atendimento', 'Visita agendada', 'Visita realizada', 'Proposta', 'Negociação', 'Documentação', 'Ganho', 'Perdido']), names.join(','));
const stage = (key) => funnel.stages.find((s) => s.stageKey === key);

// Cadastros
const seller = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Vendedor' } }))).data;
const buyer = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Comprador', maritalStatus: 'CASADO' } }))).data;
const prop = (await call('POST', '/properties', as({ body: { type: 'HOUSE', purpose: 'SALE', city: 'Franca', street: 'Rua A', number: '1', salePrice: 400000, ownerId: seller.id } }))).data;
await call('POST', `/properties/${prop.id}/authorizations`, as({ body: { signedAt: iso(day(-30)), validUntil: iso(day(150)), commissionRate: 6 } }));

const deal = await call('POST', '/deals', as({ body: { title: 'Casa Rua A — Comprador', contactId: buyer.id, pipelineId: funnel.id, propertyIds: [prop.id] } }));
ok('negócio criado com imóvel de interesse, em Novo lead', deal.status === 201 && deal.data.stageId === stage('NEW_LEAD').id, short(deal));
const D = deal.data.id;

// Visita
const when = new Date(day(2)); when.setUTCHours(17, 0, 0, 0);
const v1 = await call('POST', '/visits', as({ body: { dealId: D, propertyId: prop.id, scheduledAt: when.toISOString() } }));
ok('visita agendada avança o negócio para "Visita agendada"', v1.status === 201 && v1.data.dealMovedTo === 'Visita agendada', short(v1));
const clash = await call('POST', '/visits', as({ body: { dealId: D, propertyId: prop.id, scheduledAt: new Date(when.getTime() + 30 * 60000).toISOString() } }));
ok('mesmo corretor em horário sobreposto é recusado', clash.status === 409, short(clash));
const tasks = await call('GET', '/activities?type=VISIT&done=false&mine=true', as());
ok('visita aparece em "minhas tarefas" com data', tasks.data.items.some((t) => t.dealId === D && t.dueAt), short(tasks));
const range = await call('GET', `/activities?type=VISIT&startDate=${iso(day(1))}&endDate=${iso(day(3))}`, as());
const out = await call('GET', `/activities?type=VISIT&startDate=${iso(day(5))}&endDate=${iso(day(9))}`, as());
ok('filtro de período usa início E fim', range.data.items.length >= 1 && out.data.items.length === 0);
const noFb = await call('PATCH', `/visits/${v1.data.id}/complete`, as({ body: {} }));
ok('concluir visita exige o interesse do cliente', noFb.status === 400);
const done = await call('PATCH', `/visits/${v1.data.id}/complete`, as({ body: { interestLevel: 'HIGH', feedback: 'Gostou da cozinha' } }));
ok('visita realizada com retorno avança para "Visita realizada"', done.status === 200 && done.data.dealMovedTo === 'Visita realizada', short(done));

// Proposta
const badP = await call('POST', '/proposals', as({ body: { dealId: D, amount: 380000, paymentMethod: 'MIXED', downPayment: 50000, financedAmount: 200000, validUntil: iso(day(5)) } }));
ok('pagamento misto que não fecha o valor é recusado', badP.status === 400, badP.raw?.message);
const p1 = await call('POST', '/proposals', as({ body: { dealId: D, amount: 370000, paymentMethod: 'FINANCING', downPayment: 70000, financedAmount: 300000, validUntil: iso(day(5)) } }));
ok('proposta registrada avança para "Proposta"', p1.status === 201 && p1.data.dealMovedTo === 'Proposta' && p1.data.situation === 'OPEN', short(p1));
const p1b = await call('POST', '/proposals', as({ body: { dealId: D, amount: 1, paymentMethod: 'CASH', validUntil: iso(day(5)) } }));
ok('segunda proposta em aberto no mesmo negócio é recusada', p1b.status === 400);
const c1 = await call('POST', `/proposals/${p1.data.id}/counter`, as({ body: { amount: 390000, paymentMethod: 'FINANCING', downPayment: 90000, financedAmount: 300000, validUntil: iso(day(5)) } }));
ok('contraproposta vai para "Negociação"', c1.status === 201 && c1.data.kind === 'COUNTER' && c1.data.dealMovedTo === 'Negociação', short(c1));
const rejNoNote = await call('PATCH', `/proposals/${c1.data.id}/reject`, as({ body: {} }));
ok('recusar exige motivo', rejNoNote.status === 400);
const acc = await call('PATCH', `/proposals/${c1.data.id}/accept`, as({ body: { note: 'Fechado' } }));
ok('aceitar vai para "Documentação"', acc.status === 200 && acc.data.dealMovedTo === 'Documentação', short(acc));
const hist = await call('GET', `/proposals?dealId=${D}`, as());
ok('histórico: original (respondida) + contraproposta (aceita)', hist.data.length === 2 && hist.data[0].status === 'COUNTERED' && hist.data[1].status === 'ACCEPTED');
const docR = await call('GET', `/proposals/${c1.data.id}/document`, as());
ok('documento da proposta para imprimir/PDF', docR.status === 200 && docR.text.includes('Contraproposta') && docR.text.includes('390.000,00'), docR.text.slice(0, 120));
const dealNow = (await call('GET', `/deals/${D}`, as())).data;
ok('valor do negócio = valor aceito (entra no VGV)', Number(dealNow.value) === 390000);

// Perda exige motivo
const lostStage = stage('LOST');
const lostNo = await call('PATCH', `/deals/${D}/stage`, as({ body: { stageId: lostStage.id } }));
ok('mover para Perdido sem motivo é recusado', lostNo.status === 400, lostNo.raw?.message);
const otherPipe = await call('POST', '/pipelines', as({ body: { name: 'Outro', type: 'SALE' } }));
const foreignStage = otherPipe.data.stages[0].id;
const wrong = await call('PATCH', `/deals/${D}/stage`, as({ body: { stageId: foreignStage } }));
ok('etapa de outro funil é recusada', wrong.status === 404, short(wrong));

// Ganho → rascunho de contrato
const won = await call('PATCH', `/deals/${D}/stage`, as({ body: { stageId: stage('WON').id } }));
ok('Ganho devolve o próximo passo: assistente de contrato', won.status === 200 && won.data.nextStep?.type === 'CONTRACT_WIZARD' && won.data.nextStep.url.includes(D), short(won));
const draft = await call('GET', `/deals/${D}/contract-draft`, as());
ok('rascunho: imóvel, vendedor, comprador, valor aceito, comissão 6%, financiamento',
  draft.data.propertyId === prop.id && draft.data.ownerId === seller.id && draft.data.tenantId === buyer.id &&
  draft.data.saleValue === 390000 && draft.data.commissionRate === 6 && draft.data.paymentMethod === 'FINANCING', short(draft));
ok('rascunho avisa: comprador casado sem cônjuge', draft.data.warnings.some((w) => w.includes('cônjuge')));
const ctr = await call('POST', '/contracts', as({ body: { type: 'BROKERAGE', dealId: D, propertyId: prop.id, ownerId: seller.id, tenantId: buyer.id, saleValue: 390000, commissionRate: 6 } }));
ok('contrato criado a partir do negócio', ctr.status === 201, short(ctr));
const ctr2 = await call('POST', '/contracts', as({ body: { type: 'BROKERAGE', dealId: D, propertyId: prop.id, saleValue: 390000, commissionRate: 6 } }));
ok('segundo contrato para o mesmo negócio é recusado', ctr2.status === 409, short(ctr2));
const won2 = await call('PATCH', `/deals/${D}/stage`, as({ body: { stageId: stage('WON').id } }));
ok('Ganho com contrato existente aponta para o contrato', won2.data.nextStep?.type === 'OPEN_CONTRACT');

// Meus negócios
const mine = await call('GET', `/deals?mine=true&pipelineId=${funnel.id}`, as());
const all = await call('GET', `/deals?pipelineId=${funnel.id}`, as());
ok('"meus negócios" filtra pelo responsável', mine.status === 200 && mine.data.items.length === 0 && all.data.items.length === 1, `${mine.data.items?.length}/${all.data.items?.length}`);
await call('PATCH', `/deals/${D}`, as({ body: { assigneeId: (await call('GET', '/users/workspace/members', as())).data[0].id } }));
const mine2 = await call('GET', `/deals?mine=true&pipelineId=${funnel.id}`, as());
ok('negócio atribuído aparece em "meus negócios"', mine2.data.items.length === 1);

// Isolamento
const asB = (o = {}) => ({ token: Bw.token, ws: Bw.ws, ...o });
const x1 = await call('GET', `/proposals?dealId=${D}`, asB());
const x2 = await call('PATCH', `/visits/${v1.data.id}/cancel`, asB({ body: { reason: 'x' } }));
const x3 = await call('GET', `/deals/${D}/contract-draft`, asB());
const x4 = await call('POST', '/visits', asB({ body: { contactId: buyer.id, propertyId: prop.id, scheduledAt: when.toISOString() } }));
const x5 = await call('GET', `/proposals/${c1.data.id}/document`, asB());
const x6 = await call('POST', '/contracts', asB({ body: { type: 'BROKERAGE', dealId: D, propertyId: prop.id, saleValue: 1, commissionRate: 1 } }));
ok('outra imobiliária não vê nem altera o funil', [x1, x2, x3, x5].every((r) => r.status === 404) && x4.status === 400 && x6.status === 400,
  [x1, x2, x3, x4, x5, x6].map((r) => r.status).join(','));

let fail = 0;
for (const [c, n, e] of results) { if (!c) fail++; console.log(c ? 'OK  ' : 'FAIL', n, c ? '' : '→ ' + e); }
console.log(`\n${results.length - fail}/${results.length} verificações passaram`);
process.exit(fail ? 1 : 0);
