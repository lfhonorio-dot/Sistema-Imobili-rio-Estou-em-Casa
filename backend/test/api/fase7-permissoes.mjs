// Roteiro de ponta a ponta da Fase 7 (papéis, relatórios, notificações,
// DIMOB, LGPD e segurança) contra a API REAL.
// Uso (de dentro de backend/): API_URL=http://localhost:3001/api/v1 DATABASE_URL=... node test/api/fase7-permissoes.mjs
// Nunca rode contra produção: o roteiro cria imobiliárias e usuários de teste.
import { PrismaClient } from '@prisma/client';

const B = process.env.API_URL || 'http://localhost:3001/api/v1';
const results = [];
const ok = (name, cond, extra = '') => results.push([!!cond, name, extra]);
let ipSeq = 1;
async function call(method, path, { token, ws, body, ip } = {}) {
  const headers = { 'X-Forwarded-For': ip ?? `10.7.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ws) headers['X-Workspace-Id'] = ws;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(B + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return { status: res.status, ct, buf: Buffer.from(await res.arrayBuffer()) };
  const json = await res.json();
  return { status: res.status, data: json?.data ?? json, raw: json };
}
const short = (r) => JSON.stringify(r.raw ?? r.status).slice(0, 260);
const run = Date.now().toString(36);
const iso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const PASS = 'Senha@12345';

const reg = await call('POST', '/auth/register', { body: { workspaceName: 'Imob ' + run, workspaceSlug: 'f7' + run, email: `dono-${run}@teste.local`, name: 'Dono', password: PASS } });
const O = { token: reg.data.accessToken, ws: reg.data.workspaceId };
const as = (u, o = {}) => ({ token: u.token, ws: O.ws, ...o });
const prisma = new PrismaClient();

try {
  // ── 1. Papéis e convites ───────────────────────────────
  const roles = (await call('GET', '/workspace/roles', as(O))).data;
  const roleId = (k) => roles.find((r) => r.systemKey === k)?.id;
  ok('imobiliária nasce com os 4 papéis', ['ADMIN', 'FINANCE', 'MANAGER', 'BROKER'].every((k) => roleId(k)), JSON.stringify(roles.map((r) => r.systemKey)));
  const users = {};
  for (const [key, sys] of [['brokerA', 'BROKER'], ['brokerB', 'BROKER'], ['fin', 'FINANCE'], ['ger', 'MANAGER']]) {
    const email = `${key}-${run}@teste.local`;
    const inv = await call('POST', '/users/workspace/invite', as(O, { body: { email, roleId: roleId(sys) } }));
    const token = inv.data.inviteLink?.split('/invite/')[1];
    const info = await call('GET', `/auth/invite/${token}`);
    const acc = await call('POST', '/auth/accept-invite', { body: { token, name: key, password: PASS } });
    const login = await call('POST', '/auth/login', { body: { email, password: PASS } });
    users[key] = { token: login.data.accessToken, email, invite: token, info, acc };
  }
  ok('convite gera link, mostra a imobiliária e o papel, e é aceito', users.brokerA.info.data.roleName === 'Corretor' && users.brokerA.acc.data.accepted && users.brokerA.token, short(users.brokerA.acc));
  const again = await call('POST', '/auth/accept-invite', { body: { token: users.brokerA.invite, name: 'x', password: PASS } });
  ok('convite não pode ser usado duas vezes', again.status === 400, short(again));
  const me = (u) => call('GET', '/auth/me', { token: u.token });
  ok('/auth/me devolve o papel efetivo', (await me(users.brokerA)).data.workspaces[0].roleKey === 'BROKER' && (await me(O)).data.workspaces[0].roleKey === 'ADMIN');
  const brokerInvite = await call('POST', '/users/workspace/invite', as(users.ger, { body: { email: `x-${run}@t.local`, roleId: roleId('BROKER') } }));
  ok('só o dono convida usuários (Gerente recebe 403)', brokerInvite.status === 403, short(brokerInvite));
  const members = (await call('GET', '/users/workspace/members', as(O))).data;
  const mid = (key) => members.find((m) => m.user.email === users[key].email)?.id;

  // ── 2. Acesso por área ─────────────────────────────────
  const checks = [
    ['Corretor não acessa o financeiro geral', users.brokerA, 'GET', '/financial/entries', 403],
    ['Corretor não acessa cobranças/gateways', users.brokerA, 'GET', '/billing/boletos', 403],
    ['Corretor não acessa notas fiscais', users.brokerA, 'GET', '/nfse', 403],
    ['Corretor não acessa relatórios gerenciais', users.brokerA, 'GET', '/reports/sales/vgv', 403],
    ['Corretor não acessa LGPD/configurações', users.brokerA, 'GET', '/lgpd/policies', 403],
    ['Corretor vê o painel dele', users.brokerA, 'GET', '/reports/sales-dashboard', 200],
    ['Corretor vê as próprias comissões', users.brokerA, 'GET', '/financial/my-commissions', 200],
    ['Financeiro acessa o financeiro', users.fin, 'GET', '/financial/entries', 200],
    ['Financeiro configura gateway', users.fin, 'GET', '/billing/gateways', 200],
    ['Financeiro não altera a imobiliária', users.fin, 'PUT', '/workspace', 403],
    ['Gerente vê relatórios', users.ger, 'GET', '/reports/sales/broker-ranking', 200],
    ['Gerente não mexe na configuração do gateway', users.ger, 'GET', '/billing/gateways', 403],
    ['Gerente não autoriza nota real', users.ger, 'POST', '/nfse/config/authorize-production', 403],
  ];
  for (const [name, u, m, p, exp] of checks) {
    const r = await call(m, p, as(u, { body: m === 'GET' ? undefined : {} }));
    ok(name, r.status === exp, `${r.status} ${short(r)}`);
  }
  const msg = await call('GET', '/financial/entries', as(users.brokerA));
  ok('recusa explica o papel', /Corretor.*não tem acesso/.test(msg.raw.message), short(msg));

  // ── 3. Escopo do Corretor ──────────────────────────────
  const pipe = (await call('GET', '/pipelines', as(O))).data;
  const pl = (Array.isArray(pipe) ? pipe : pipe.items).find((p) => p.type !== 'RENTAL') ?? (Array.isArray(pipe) ? pipe : pipe.items)[0];
  const stage0 = pl.stages.sort((a, b) => a.order - b.order)[0];
  const cA = (await call('POST', '/contacts', as(users.brokerA, { body: { type: 'PERSON', name: 'Lead do A', cpf: '52998224725' } }))).data;
  const dealA = (await call('POST', '/deals', as(users.brokerA, { body: { title: 'Negócio do A', contactId: cA.id, pipelineId: pl.id, stageId: stage0.id, value: 400000, origin: 'PORTAL' } }))).data;
  ok('negócio criado pelo Corretor fica com ele', dealA.assigneeId === mid('brokerA'), short({ raw: dealA }));
  const cB = (await call('POST', '/contacts', as(users.brokerB, { body: { type: 'PERSON', name: 'Lead do B', cpf: '11144477735' } }))).data;
  const listB = (await call('GET', '/deals?limit=100', as(users.brokerB))).data;
  ok('Corretor B não vê negócio do A', !listB.items.some((d) => d.id === dealA.id), short({ raw: listB }));
  const getAasB = await call('GET', `/deals/${dealA.id}`, as(users.brokerB));
  ok('Corretor B recebe 404 ao abrir negócio do A', getAasB.status === 404, short(getAasB));
  const contactsB = (await call('GET', '/contacts?limit=100', as(users.brokerB))).data;
  ok('Corretor B só vê os leads dele', contactsB.items.length === 1 && contactsB.items[0].id === cB.id, JSON.stringify(contactsB.items.map((c) => c.name)));
  const dupB = await call('POST', '/contacts', as(users.brokerB, { body: { type: 'PERSON', name: 'Tentativa', cpf: '52998224725' } }));
  ok('CPF de lead de outro corretor: recusa sem revelar o nome', dupB.status === 409 && !/Lead do A/.test(dupB.raw.message), short(dupB));
  const ownerSees = (await call('GET', '/deals?limit=100', as(O))).data;
  ok('Dono vê todos os negócios', ownerSees.items.some((d) => d.id === dealA.id));
  const moveB = await call('PATCH', `/deals/${dealA.id}`, as(users.brokerB, { body: { title: 'hack' } }));
  ok('Corretor B não edita negócio do A', moveB.status === 404, short(moveB));

  const prop = (await call('POST', '/properties', as(O, { body: { type: 'HOUSE', purpose: 'SALE', city: 'Franca', street: 'Rua do Sol', number: '7', salePrice: 400000, ownerId: cB.id } }))).data;
  const visit = await call('POST', '/visits', as(users.brokerA, { body: { propertyId: prop.id, contactId: cA.id, dealId: dealA.id, scheduledAt: new Date(Date.now() + 3600e3).toISOString(), brokerId: mid('brokerB') } }));
  ok('visita marcada pelo Corretor fica no nome dele', visit.status === 201 && visit.data.brokerId === mid('brokerA'), short(visit));
  const visitsB = (await call('GET', '/visits', as(users.brokerB))).data;
  ok('Corretor B não vê a visita do A', !(visitsB.items ?? visitsB).some((v) => v.id === visit.data.id), short({ raw: visitsB }));
  const task = (await call('POST', '/activities', as(users.brokerA, { body: { type: 'TASK', title: 'Ligar para o lead', dueAt: new Date(Date.now() + 3600e3).toISOString(), dealId: dealA.id } }))).data;
  const tasksB = (await call('GET', '/activities?limit=100', as(users.brokerB))).data;
  ok('Corretor B não vê tarefas do A', !tasksB.items.some((t) => t.id === task.id), short({ raw: tasksB }));

  // contrato do negócio do A, ativado pelo dono com o A como vendedor
  const ctr = (await call('POST', '/contracts', as(O, { body: { type: 'SALE', propertyId: prop.id, ownerId: cB.id, tenantId: cA.id, saleValue: 400000, commissionRate: 6, dealId: dealA.id } }))).data;
  const actBroker = await call('POST', `/contracts/${ctr.id}/sale/activate`, as(users.brokerA, { body: { installmentsCount: 1, firstDueDate: iso(20) } }));
  ok('Corretor não ativa venda', actBroker.status === 403, short(actBroker));
  const act = await call('POST', `/contracts/${ctr.id}/sale/activate`, as(O, { body: { installmentsCount: 1, firstDueDate: iso(20), sellerBrokerId: mid('brokerA'), sellerBrokerPct: 30 } }));
  ok('dono ativa a venda com o A como corretor vendedor', act.status === 201, short(act));
  ok('Corretor A vê o contrato do negócio dele; B não', (await call('GET', `/contracts/${ctr.id}`, as(users.brokerA))).status === 200 && (await call('GET', `/contracts/${ctr.id}`, as(users.brokerB))).status === 404);
  const myA = (await call('GET', '/financial/my-commissions', as(users.brokerA))).data;
  ok('"Minhas comissões" do A: R$ 7.200 a receber', myA.totals.toReceive === 7200, short({ raw: myA }));
  ok('"Minhas comissões" do B: nada', (await call('GET', '/financial/my-commissions', as(users.brokerB))).data.totals.toReceive === 0);
  const dashA = (await call('GET', '/reports/sales-dashboard', as(users.brokerA))).data;
  ok('painel do Corretor: só os números dele, sem saldo da imobiliária', dashA.scope === 'BROKER' && dashA.projectedBalance30d === null && dashA.commissionsReceivable === null && dashA.commissionsPayable.amount === 7200 && dashA.salesThisMonth.count === 1, short({ raw: dashA }));
  const dashB = (await call('GET', '/reports/sales-dashboard', as(users.brokerB))).data;
  ok('painel do Corretor B não conta a venda do A', dashB.salesThisMonth.count === 0 && dashB.vgvInNegotiation.deals === 0, short({ raw: dashB }));

  // ── 4. Relatórios ──────────────────────────────────────
  const vgv = (await call('GET', '/reports/sales/vgv', as(users.ger))).data;
  ok('VGV vendido inclui a venda (R$ 400 mil)', vgv.totals.vgv === 400000 && vgv.totals.count === 1, short({ raw: vgv }));
  const rank = (await call('GET', '/reports/sales/broker-ranking', as(O))).data;
  ok('ranking: Corretor A em 1º com 1 venda', rank.rows[0]?.broker === 'brokerA' && rank.rows[0].sales === 1, short({ raw: rank }));
  const src = (await call('GET', '/reports/sales/lead-sources', as(O))).data;
  ok('origem dos leads: Portal', src.rows.some((r) => r.origin === 'Portal' && r.leads === 1), short({ raw: src }));
  const fun = (await call('GET', '/reports/sales/funnel', as(O))).data;
  ok('conversão do funil calculada', fun.rows.length > 0 && fun.summary.some((s) => s.label.includes('criados')), short({ raw: fun }));
  const com = (await call('GET', '/reports/sales/commissions', as(O))).data;
  ok('comissões a receber (24.000) e a pagar (7.200)', com.summary[0].value === 24000 && com.summary[1].value === 7200, short({ raw: com }));
  // imóvel à venda (o primeiro já foi vendido) com autorização vencendo em 5 dias
  const prop2 = (await call('POST', '/properties', as(O, { body: { type: 'APARTMENT', purpose: 'SALE', city: 'Patrocínio Paulista', street: 'Rua B', number: '2', salePrice: 250000, ownerId: cB.id } }))).data;
  await call('POST', `/properties/${prop2.id}/authorizations`, as(O, { body: { signedAt: iso(-170), validUntil: iso(5), commissionRate: 6, captorUserId: mid('brokerB') } }));
  const auth = (await call('GET', '/reports/sales/authorizations', as(O))).data;
  ok('autorizações a vencer: imóvel com captador B', auth.rows.some((r) => r.captor === 'brokerB'), short({ raw: auth }));
  for (const k of ['vgv', 'funnel', 'sales-time', 'lead-sources', 'broker-ranking', 'commissions', 'idle-properties', 'authorizations']) {
    const x = await call('GET', `/reports/sales/${k}/export?format=xlsx`, as(O));
    const p = await call('GET', `/reports/sales/${k}/export?format=pdf`, as(O));
    if (x.buf?.slice(0, 2).toString() !== 'PK' || p.buf?.slice(0, 4).toString() !== '%PDF') ok(`exporta ${k}`, false, `${x.status}/${p.status}`);
  }
  ok('os 8 relatórios exportam Excel e PDF', true);

  // ── 5. Notificações ────────────────────────────────────
  const runR = await call('POST', '/notifications/run-rules', as(O));
  ok('regras geram avisos', runR.status === 200 && runR.data.created > 0, short(runR));
  const notA = (await call('GET', '/notifications?limit=50', as(users.brokerA))).data;
  ok('Corretor A recebeu "Lead novo" e "Visita hoje"/"Tarefa"', notA.items.some((n) => n.type === 'LEAD_NEW') && notA.items.some((n) => ['VISIT_TODAY', 'TASK_DUE'].includes(n.type)), JSON.stringify(notA.items.map((n) => n.type)));
  ok('sem SMTP: e-mail marcado como não enviado (nada de "enviado")', notA.items.every((n) => n.emailStatus === 'SKIPPED'), JSON.stringify(notA.items.map((n) => n.emailStatus)));
  const notB = (await call('GET', '/notifications?limit=50', as(users.brokerB))).data;
  ok('captador (B) avisado da autorização vencendo; não recebe o lead do A', notB.items.some((n) => n.type === 'AUTH_EXPIRING') && !notB.items.some((n) => n.type === 'LEAD_NEW' && n.entityId === dealA.id), JSON.stringify(notB.items.map((n) => n.type)));
  const runR2 = await call('POST', '/notifications/run-rules', as(O));
  ok('rodar de novo não duplica avisos', runR2.data.created === 0, short(runR2));
  const brokerRun = await call('POST', '/notifications/run-rules', as(users.brokerA));
  ok('Corretor não dispara as regras', brokerRun.status === 403, short(brokerRun));

  // ── 6. DIMOB ───────────────────────────────────────────
  const year = new Date().getFullYear();
  const ws = await prisma.workspace.findUnique({ where: { id: O.ws }, select: { cnpj: true } });
  const decl = (await call('GET', `/fiscal/dimob/export?year=${year}`, as(O))).data.declarantes ?? [];
  if (decl.length) {
    const v = await call('GET', `/fiscal/dimob/validate?year=${year}&declarantDoc=${encodeURIComponent(decl[0].declarantDoc)}`, as(O));
    ok('validação da DIMOB responde com partes e estrutura', v.status === 200 && typeof v.data.ok === 'boolean' && Array.isArray(v.data.issues), short(v));
    const pgd = await call('GET', `/fiscal/dimob/pgd?year=${year}&declarantDoc=${encodeURIComponent(decl[0].declarantDoc)}`, as(O));
    ok('arquivo usa R04 para venda', /\r\nR04/.test(pgd.data.content ?? ''), short(pgd));
  } else ok('DIMOB tem declarante (CNPJ da imobiliária)', !!ws?.cnpj, 'imobiliária de teste sem CNPJ: DIMOB sem declarante');

  // ── 7. LGPD ────────────────────────────────────────────
  const exp = await call('GET', `/lgpd/contacts/${cA.id}/export`, as(O));
  ok('exportação traz cadastro, negócios e contratos do cliente', exp.data.titular?.name === 'Lead do A' && exp.data.negocios.length === 1 && exp.data.contratos.length === 1, short(exp));
  const pvA = (await call('GET', `/lgpd/contacts/${cA.id}/anonymize-preview`, as(O))).data;
  ok('cliente com contrato: guarda legal de nome e CPF', pvA.legalHold === true, short({ raw: pvA }));
  const anonNo = await call('POST', `/lgpd/contacts/${cA.id}/anonymize`, as(O, { body: { reason: '' } }));
  ok('anonimizar exige motivo', anonNo.status === 400, short(anonNo));
  await call('POST', `/lgpd/contacts/${cA.id}/anonymize`, as(O, { body: { reason: 'Pedido do titular' } }));
  const afterA = await prisma.contact.findUnique({ where: { id: cA.id } });
  ok('anonimização parcial: some e-mail/telefone/endereço, ficam nome e CPF', afterA.name === 'Lead do A' && afterA.cpf && !afterA.email && !afterA.phone && !afterA.street);
  const solo = (await call('POST', '/contacts', as(O, { body: { type: 'PERSON', name: 'Sem vínculo', email: `solo-${run}@t.local`, phone: '16999990000' } }))).data;
  await call('POST', `/lgpd/contacts/${solo.id}/anonymize`, as(O, { body: { reason: 'Pedido do titular' } }));
  const afterSolo = await prisma.contact.findUnique({ where: { id: solo.id } });
  ok('sem obrigação legal: tudo apagado e cadastro desativado', afterSolo.name === 'Titular anonimizado' && !afterSolo.email && !afterSolo.phone && afterSolo.deletedAt);
  ok('Corretor não acessa LGPD', (await call('GET', `/lgpd/contacts/${cB.id}/export`, as(users.brokerB))).status === 403);

  // ── 8. Segurança: bloqueio por tentativas e limite por IP ──
  for (let i = 0; i < 10; i++) await call('POST', '/auth/login', { body: { email: users.fin.email, password: 'errada' } });
  const locked = await call('POST', '/auth/login', { body: { email: users.fin.email, password: PASS } });
  ok('10 senhas erradas bloqueiam a conta (mesmo com a senha certa depois)', locked.status === 401 && /bloqueado/.test(locked.raw.message), short(locked));
  const sameIp = [];
  for (let i = 0; i < 11; i++) sameIp.push((await call('POST', '/auth/login', { body: { email: `ninguem-${run}@t.local`, password: 'x' }, ip: '10.99.99.99' })).status);
  ok('limite por IP: muitas tentativas de login no mesmo IP recebem 429', sameIp.includes(429), sameIp.join(','));
} finally {
  await prisma.$disconnect();
}

let fail = 0;
for (const [c, n, e] of results) { if (!c) fail++; console.log(c ? 'OK  ' : 'FAIL', n, c ? '' : '→ ' + e); }
console.log(`\n${results.length - fail}/${results.length} verificações passaram`);
process.exit(fail ? 1 : 0);
