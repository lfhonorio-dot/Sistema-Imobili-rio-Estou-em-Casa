// Roteiro de ponta a ponta da Fase 4 (contrato de venda e pós-venda) contra a API REAL.
// Uso: suba o backend apontando para um banco de TESTE e rode
//   API_URL=http://localhost:3001/api/v1 node test/api/fase4-contrato-venda.mjs
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
  return { status: res.status, data: json?.data ?? json, raw: json };
}
const short = (r) => JSON.stringify(r.raw).slice(0, 260);
async function register(slug) {
  const r = await call('POST', '/auth/register', { body: { workspaceName: 'Imob ' + slug, workspaceSlug: slug, email: `${slug}@teste.local`, name: 'Dono', password: 'Senha@12345' } });
  if (r.status >= 300) throw new Error('register ' + short(r));
  return { token: r.data.accessToken, ws: r.data.workspaceId };
}
const run = Date.now().toString(36);
const A = await register('f4a' + run);
const Bw = await register('f4b' + run);
const as = (o = {}) => ({ token: A.token, ws: A.ws, ...o });
const iso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const sum = (arr) => Math.round(arr.reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;

// Cadastros
const me = (await call('GET', '/users/workspace/members', as())).data[0];
const seller = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Vendedor', cpf: '11144477735' } }))).data;
const buyer = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Comprador', cpf: '52998224725' } }))).data;
const partner = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Parceiro Externo' } }))).data;
const prop = (await call('POST', '/properties', as({ body: { type: 'HOUSE', purpose: 'SALE', city: 'Franca', street: 'Rua B', number: '2', salePrice: 400000, ownerId: seller.id } }))).data;
await call('POST', `/properties/${prop.id}/authorizations`, as({ body: { signedAt: iso(-20), validUntil: iso(150), commissionRate: 6, captorUserId: me.id } }));

// Contrato nasce rascunho, sem lançamentos
const ctr = await call('POST', '/contracts', as({ body: {
  type: 'SALE', propertyId: prop.id, ownerId: seller.id, tenantId: buyer.id, saleValue: 390000, commissionRate: 6,
  partnerSplits: [{ contactId: partner.id, percentage: 20 }],
} }));
ok('contrato de venda criado como rascunho', ctr.status === 201 && ctr.data.status === 'DRAFT', short(ctr));
const C = ctr.data.id;
let detail = (await call('GET', `/contracts/${C}`, as())).data;
ok('rascunho NÃO lança valor do imóvel nem comissão', detail.financialEntries.length === 0, JSON.stringify(detail.financialEntries).slice(0, 200));
ok('imóvel continua disponível no rascunho', (await call('GET', `/properties/${prop.id}`, as())).data.status === 'AVAILABLE');
const dimob0 = await call('GET', `/fiscal/dimob/export?year=${new Date().getFullYear()}`, as());
ok('rascunho não entra na DIMOB', (dimob0.data.declarantes ?? []).length === 0, short(dimob0));

// Status genérico não ativa venda
const gen = await call('PATCH', `/contracts/${C}/status`, as({ body: { status: 'ACTIVE' } }));
ok('ativar venda pelo status genérico é recusado', gen.status === 400, short(gen));

// Prévia
const plan = { installmentsCount: 2, firstDueDate: iso(30), sellerBrokerId: me.id, sellerBrokerPct: 30, captorBrokerPct: 10, paymentMethod: 'FINANCING' };
const prev = await call('POST', `/contracts/${C}/sale/preview`, as({ body: plan }));
ok('prévia: comissão 23.400 em 2 parcelas, captador sugerido pela autorização',
  prev.status === 201 && prev.data.commissionTotal === 23400 && prev.data.receivables.length === 2 && prev.data.suggestedCaptorId === me.id, short(prev));
ok('prévia: vendedor 7.020 + captador 2.340 + parceiro 4.680; imobiliária fica 9.360',
  JSON.stringify(prev.data.perBeneficiary?.map((b) => b.amount)) === '[7020,2340,4680]' && prev.data.agencyNet === 9360, short(prev));
ok('prévia não grava nada', (await call('GET', `/contracts/${C}`, as())).data.status === 'DRAFT');
const bad = await call('POST', `/contracts/${C}/sale/preview`, as({ body: { ...plan, installmentsCount: undefined, installments: [{ dueDate: iso(30), amount: 1000 }] } }));
ok('parcelas que não fecham a comissão são recusadas', bad.status === 400 && /soma das parcelas/.test(bad.raw.message), short(bad));
const over = await call('POST', `/contracts/${C}/sale/preview`, as({ body: { ...plan, sellerBrokerPct: 75 } }));
ok('repasses acima de 100% são recusados', over.status === 400, short(over));
const cashNoValue = await call('POST', `/contracts/${C}/sale/activate`, as({ body: { ...plan, cashInvolved: true } }));
ok('espécie sem valor é recusada', cashNoValue.status === 400, short(cashNoValue));

// Ativação
const act = await call('POST', `/contracts/${C}/sale/activate`, as({ body: { ...plan, cashInvolved: true, cashAmount: 120000 } }));
ok('ativação: 2 a receber e 6 a pagar', act.status === 201 && act.data.receivables === 2 && act.data.payables === 6, short(act));
ok('ativação avisa sobre espécie ≥ R$ 100 mil (COAF)', (act.data.warnings ?? []).some((w) => w.includes('COAF')));
detail = (await call('GET', `/contracts/${C}`, as())).data;
const rec = detail.financialEntries.filter((e) => e.type === 'RECEIVABLE');
const pay = detail.financialEntries.filter((e) => e.type === 'PAYABLE');
ok('contrato ativo, imóvel vendido', detail.status === 'ACTIVE' && (await call('GET', `/properties/${prop.id}`, as())).data.status === 'SOLD');
ok('a receber = comissão (R$ 23.400), pago pelo vendedor', sum(rec) === 23400 && rec.every((e) => e.category === 'COMMISSION' && e.contactId === seller.id));
ok('a pagar = R$ 14.040 (vendedor + captador + parceiro), ligados à parcela', sum(pay) === 14040 && pay.every((e) => e.sourceEntryId));
ok('parceiro com conta a pagar no nome dele', pay.filter((e) => e.contactId === partner.id).length === 2 && sum(pay.filter((e) => e.contactId === partner.id)) === 4680);
ok('pagamento em espécie aguardando análise', detail.cashInvolved === true && detail.cashReviewStatus === 'PENDING_REVIEW');
ok('quadro da comissão usa a comissão combinada', detail.commissionBreakdown?.commissionTotal === 23400);
const dimob1 = await call('GET', `/fiscal/dimob/export?year=${new Date().getFullYear()}`, as());
ok('venda ativada entra na DIMOB', (dimob1.data.declarantes ?? []).length >= 1 && JSON.stringify(dimob1.data).includes('390000'), short(dimob1));
const again = await call('POST', `/contracts/${C}/sale/activate`, as({ body: plan }));
ok('ativar duas vezes é recusado', again.status === 400 || again.status === 409, short(again));

// Checklist
const cl = await call('GET', `/contracts/${C}/checklist`, as());
const keys = cl.data.map((i) => i.key);
ok('checklist de pós-venda com os 7 itens e prazos', ['DOCS_PARTIES', 'CREDIT_APPROVAL', 'BANK_APPRAISAL', 'ITBI', 'DEED', 'REGISTRY', 'KEYS'].every((k) => keys.includes(k)) && cl.data.every((i) => i.dueDate && i.responsibleId), short(cl));
const done = await call('PATCH', `/contracts/${C}/checklist/${cl.data[0].id}`, as({ body: { status: 'DONE', notes: 'Documentos conferidos' } }));
ok('marcar item como concluído registra quem e quando', done.status === 200 && done.data.status === 'DONE' && done.data.doneAt && done.data.doneById, short(done));
const custom = await call('POST', `/contracts/${C}/checklist`, as({ body: { title: 'Quitar condomínio atrasado', dueDate: iso(10) } }));
ok('item extra no checklist', custom.status === 201);

// Análise de espécie
const noNote = await call('PATCH', `/contracts/${C}/sale/cash-review`, as({ body: { note: '' } }));
const rev = await call('PATCH', `/contracts/${C}/sale/cash-review`, as({ body: { note: 'Origem dos recursos comprovada; comunicação ao COAF feita.' } }));
ok('análise de espécie exige conclusão e registra', noNote.status === 400 && rev.status === 200 && rev.data.cashReviewStatus === 'REVIEWED', short(rev));

// Paga a 1ª parcela e o repasse do vendedor, depois rescinde
const firstRec = rec.sort((a, b) => a.installment - b.installment)[0];
await call('PATCH', `/financial/entries/${firstRec.id}/pay`, as({ body: { paidAmount: Number(firstRec.amount) } }));
const firstPaySeller = pay.find((e) => e.sourceEntryId === firstRec.id && e.beneficiaryUserId === me.id && e.description.includes('vendedor'));
await call('PATCH', `/financial/entries/${firstPaySeller.id}/pay`, as({ body: {} }));
const noReason = await call('POST', `/contracts/${C}/sale/rescind`, as({ body: { reason: ' ' } }));
ok('rescisão exige motivo', noReason.status === 400);
const resc = await call('POST', `/contracts/${C}/sale/rescind`, as({ body: { reason: 'Financiamento negado ao comprador' } }));
ok('rescisão: 6 em aberto canceladas e 2 estornos (parcela recebida + repasse pago)', resc.status === 201 && resc.data.cancelled === 6 && resc.data.reversals === 2, short(resc));
detail = (await call('GET', `/contracts/${C}`, as())).data;
const cancelled = detail.financialEntries.filter((e) => e.status === 'CANCELLED');
const reversals = detail.financialEntries.filter((e) => e.description.startsWith('Estorno'));
ok('nada foi apagado: lançamentos cancelados ficam com o motivo', cancelled.length === 6 && cancelled.every((e) => e.cancelReason?.includes('Financiamento negado')));
ok('estorno da parcela recebida vira conta a pagar (devolução) pendente', reversals.some((e) => e.type === 'PAYABLE' && Number(e.amount) === Number(firstRec.amount) && e.sourceEntryId === firstRec.id));
ok('contrato rescindido e imóvel disponível de novo', detail.status === 'RESCINDED' && (await call('GET', `/properties/${prop.id}`, as())).data.status === 'AVAILABLE');
const dimob2 = await call('GET', `/fiscal/dimob/export?year=${new Date().getFullYear()}`, as());
ok('venda rescindida sai da DIMOB', (dimob2.data.declarantes ?? []).length === 0, short(dimob2));
const cl2 = await call('GET', `/contracts/${C}/checklist`, as());
ok('checklist pendente cancelado, concluído preservado', cl2.data.filter((i) => i.status === 'CANCELLED').length >= 5 && cl2.data.some((i) => i.status === 'DONE'));

// Isolamento
const asB = (o = {}) => ({ token: Bw.token, ws: Bw.ws, ...o });
const x = await Promise.all([
  call('POST', `/contracts/${C}/sale/preview`, asB({ body: plan })),
  call('GET', `/contracts/${C}/checklist`, asB()),
  call('POST', `/contracts/${C}/sale/rescind`, asB({ body: { reason: 'x' } })),
  call('PATCH', `/contracts/${C}/sale/cash-review`, asB({ body: { note: 'x' } })),
]);
ok('outra imobiliária não vê nem altera a venda', x.every((r) => r.status === 404), x.map((r) => r.status).join(','));

let fail = 0;
for (const [c, n, e] of results) { if (!c) fail++; console.log(c ? 'OK  ' : 'FAIL', n, c ? '' : '→ ' + e); }
console.log(`\n${results.length - fail}/${results.length} verificações passaram`);
process.exit(fail ? 1 : 0);
