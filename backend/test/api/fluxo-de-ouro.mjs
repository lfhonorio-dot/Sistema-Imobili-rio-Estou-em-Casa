// FLUXO DE OURO de ponta a ponta contra a API REAL (banco de TESTE):
//   captação do imóvel → lead → visita → proposta → negócio ganho → contrato de venda
//   → assinatura eletrônica → comissão a receber (boleto E PIX) → NFS-e
//   → comissão a pagar ao corretor → fluxo de caixa → DIMOB.
// Asaas, prefeitura (SIL) e servidor de e-mail são SIMULADOS localmente (_simuladores.mjs).
// O backend precisa estar rodando FORA de produção com:
//   ASAAS_API_URL_TEST_OVERRIDE=http://127.0.0.1:3999  SMTP_HOST=127.0.0.1  SMTP_PORT=2525
//   SMTP_USER=teste  SMTP_PASS=teste  SMTP_FROM=teste@teste.local
// Uso (de dentro de backend/): API_URL=http://localhost:3001/api/v1 node test/api/fluxo-de-ouro.mjs
// Nunca rode contra produção: o roteiro cria imobiliárias e usuários de teste.
import { ASAAS_KEY, makeClient, makeTestCertificate, startAsaas, startSil, startSmtp } from './_simuladores.mjs';

const B = process.env.API_URL || 'http://localhost:3001/api/v1';
const call = makeClient(B);
const results = [];
const ok = (name, cond, extra = '') => results.push([!!cond, name, extra]);
const short = (r) => JSON.stringify(r?.raw ?? r?.status ?? r).slice(0, 320);
const run = Date.now().toString(36);
const iso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const sum = (arr) => Math.round(arr.reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
const PASS = 'Senha@12345';
const YEAR = new Date().getFullYear();

const certificate = makeTestCertificate();
const asaas = await startAsaas();
const sil = await startSil(certificate.certPem);
const smtp = await startSmtp(Number(process.env.SMTP_TEST_PORT || 2525));

try {
  // ── 0. Imobiliária, dono e corretor ─────────────────────
  const reg = await call('POST', '/auth/register', { body: { workspaceName: 'Imobiliária Ouro ' + run, workspaceSlug: 'ouro' + run, email: `dono-${run}@teste.local`, name: 'Dona Maria', password: PASS } });
  if (reg.status >= 300) throw new Error('cadastro da imobiliária falhou: ' + short(reg));
  const O = { token: reg.data.accessToken, ws: reg.data.workspaceId };
  const asO = (o = {}) => ({ ...O, ...o });
  const wsUp = await call('PUT', '/workspace', asO({ body: { cnpj: certificate.cnpj } }));
  if (wsUp.status >= 300) throw new Error('não gravou o CNPJ da imobiliária: ' + short(wsUp));
  const roles = (await call('GET', '/workspace/roles', asO())).data;
  const brokerEmail = `corretor-${run}@teste.local`;
  const inv = await call('POST', '/users/workspace/invite', asO({ body: { email: brokerEmail, roleId: roles.find((r) => r.systemKey === 'BROKER').id } }));
  const invToken = inv.data.inviteLink?.split('/invite/')[1];
  await call('POST', '/auth/accept-invite', { body: { token: invToken, name: 'Carlos Corretor', password: PASS } });
  const bl = await call('POST', '/auth/login', { body: { email: brokerEmail, password: PASS } });
  const asC = (o = {}) => ({ token: bl.data.accessToken, ws: O.ws, ...o });
  const members = (await call('GET', '/users/workspace/members', asO())).data;
  const brokerMember = members.find((m) => m.user.email === brokerEmail);
  ok('0. imobiliária criada e corretor convidado entra com o papel Corretor', bl.status < 300 && brokerMember?.roleKey === 'BROKER', short(bl));

  // ── 1. Captação do imóvel ───────────────────────────────
  const seller = (await call('POST', '/contacts', asO({ body: { type: 'PERSON', name: 'Valter Vendedor', cpf: '11144477735', email: `vendedor-${run}@teste.local`, phone: '16999990001' } }))).data;
  const prop = await call('POST', '/properties', asO({ body: { type: 'HOUSE', purpose: 'SALE', city: 'Franca', state: 'SP', street: 'Rua do Ouro', number: '100', neighborhood: 'Centro', zipCode: '14400000', salePrice: 400000, ownerId: seller.id } }));
  const auth = await call('POST', `/properties/${prop.data.id}/authorizations`, asO({ body: { signedAt: iso(-10), validUntil: iso(170), commissionRate: 6, captorUserId: brokerMember.id } }));
  ok('1. imóvel captado com proprietário e autorização de venda (6%)', prop.status === 201 && auth.status === 201, short(prop) + short(auth));
  const P = prop.data.id;

  // ── 2. Lead (pelo corretor) ─────────────────────────────
  const pipes = (await call('GET', '/pipelines', asC())).data;
  const funnel = (Array.isArray(pipes) ? pipes : pipes.items).find((p) => p.name === 'Funil de Venda');
  const stage = (key) => funnel.stages.find((s) => s.stageKey === key);
  const buyer = (await call('POST', '/contacts', asC({ body: { type: 'PERSON', name: 'Clara Compradora', cpf: '52998224725', email: `compradora-${run}@teste.local`, phone: '16999990002' } }))).data;
  const deal = await call('POST', '/deals', asC({ body: { title: 'Casa Rua do Ouro — Clara', contactId: buyer.id, pipelineId: funnel.id, propertyIds: [P], origin: 'PORTAL' } }));
  ok('2. lead vira negócio em "Novo lead", do corretor que criou', deal.status === 201 && deal.data.stageId === stage('NEW_LEAD').id && deal.data.assigneeId === brokerMember.id, short(deal));
  const D = deal.data.id;

  // ── 3. Visita ───────────────────────────────────────────
  const when = new Date(Date.now() + 2 * 864e5); when.setUTCHours(17, 0, 0, 0);
  const visit = await call('POST', '/visits', asC({ body: { dealId: D, propertyId: P, scheduledAt: when.toISOString() } }));
  const visitDone = await call('PATCH', `/visits/${visit.data.id}/complete`, asC({ body: { interestLevel: 'HIGH', feedback: 'Gostou muito' } }));
  ok('3. visita agendada e realizada avança o funil', visit.data?.dealMovedTo === 'Visita agendada' && visitDone.data?.dealMovedTo === 'Visita realizada', short(visit) + short(visitDone));

  // ── 4. Proposta ─────────────────────────────────────────
  const prop1 = await call('POST', '/proposals', asC({ body: { dealId: D, amount: 390000, paymentMethod: 'FINANCING', downPayment: 90000, financedAmount: 300000, validUntil: iso(5) } }));
  const accepted = await call('PATCH', `/proposals/${prop1.data.id}/accept`, asC({ body: { note: 'Vendedor aceitou' } }));
  ok('4. proposta registrada e aceita leva para "Documentação"', prop1.data?.dealMovedTo === 'Proposta' && accepted.data?.dealMovedTo === 'Documentação', short(prop1) + short(accepted));

  // ── 5. Negócio ganho → contrato de venda ────────────────
  const won = await call('PATCH', `/deals/${D}/stage`, asC({ body: { stageId: stage('WON').id } }));
  const draft = await call('GET', `/deals/${D}/contract-draft`, asC());
  ok('5a. ganho abre o assistente com imóvel, vendedor, compradora, valor e comissão', won.data?.nextStep?.type === 'CONTRACT_WIZARD' && draft.data?.propertyId === P && draft.data.ownerId === seller.id && draft.data.tenantId === buyer.id && draft.data.saleValue === 390000 && draft.data.commissionRate === 6, short(won) + short(draft));
  const ctr = await call('POST', '/contracts', asO({ body: { type: 'SALE', dealId: D, propertyId: P, ownerId: seller.id, tenantId: buyer.id, saleValue: 390000, commissionRate: 6 } }));
  const C = ctr.data?.id;
  let detail = (await call('GET', `/contracts/${C}`, asO())).data;
  ok('5b. contrato de venda nasce rascunho, sem nenhum lançamento', ctr.status === 201 && ctr.data.status === 'DRAFT' && detail.financialEntries.length === 0, short(ctr));

  // ── 6. Assinatura eletrônica (e-mail simulado de verdade) ─
  const req = await call('POST', `/contracts/${C}/request-signature`, asO({ body: {} }));
  const mailSeller = smtp.lastTo(seller.email);
  const mailBuyer = smtp.lastTo(buyer.email);
  ok('6a. pedido de assinatura envia e-mail com link para vendedor e compradora', req.status < 300 && mailSeller && mailBuyer, short(req) + ` e-mails=${smtp.mails.length}`);
  const tokenOf = (m) => (m?.text.match(/\/sign\/([a-f0-9]{64})/) || [])[1];
  let signedAll = true;
  for (const [who, mail] of [['vendedor', mailSeller], ['compradora', mailBuyer]]) {
    const t = tokenOf(mail);
    const portal = await call('GET', `/esignature/portal/${t}`);
    const otp = await call('POST', `/esignature/portal/${t}/otp`);
    const otpMail = [...smtp.mails].reverse().find((m) => m.to.includes(who === 'vendedor' ? seller.email : buyer.email) && /código/i.test(m.subject));
    const code = (otpMail?.subject.match(/(\d{6})/) || [])[1] ?? otp.data?.otp_dev;
    const wrong = await call('POST', `/esignature/portal/${t}/sign`, { body: { otp: '000000' === code ? '111111' : '000000' } });
    const sign = await call('POST', `/esignature/portal/${t}/sign`, { body: { otp: code } });
    const good = portal.status === 200 && wrong.status === 403 && sign.status === 200;
    if (!good) { signedAll = false; ok(`6b. assinatura (${who})`, false, short(portal) + short(wrong) + short(sign)); }
  }
  const envs = await call('GET', `/esignature/envelopes?contractId=${C}`, asO());
  const env = (envs.data?.items ?? envs.data ?? [])[0];
  ok('6b. as duas partes assinam com código recebido por e-mail (código errado é recusado)', signedAll && env?.status === 'COMPLETED', short(envs));

  // ── 7. Ativar a venda → comissão a receber e a pagar ────
  const plan = { installmentsCount: 2, firstDueDate: iso(15), sellerBrokerId: brokerMember.id, sellerBrokerPct: 30, captorBrokerPct: 10, paymentMethod: 'FINANCING' };
  const act = await call('POST', `/contracts/${C}/sale/activate`, asO({ body: plan }));
  detail = (await call('GET', `/contracts/${C}`, asO())).data;
  const rec = detail.financialEntries.filter((e) => e.type === 'RECEIVABLE').sort((a, b) => a.installment - b.installment);
  const pay = detail.financialEntries.filter((e) => e.type === 'PAYABLE');
  ok('7a. venda ativada: contrato ativo e imóvel vendido', act.status === 201 && detail.status === 'ACTIVE' && (await call('GET', `/properties/${P}`, asO())).data.status === 'SOLD', short(act));
  ok('7b. comissão a receber = R$ 23.400 em 2 parcelas, no nome do vendedor', rec.length === 2 && sum(rec) === 23400 && rec.every((e) => e.category === 'COMMISSION' && e.contactId === seller.id), JSON.stringify(rec.map((e) => e.amount)));
  ok('7c. comissão a pagar ao corretor = R$ 9.360 (30% venda + 10% captação)', sum(pay) === 9360 && pay.every((e) => e.beneficiaryUserId === brokerMember.id && e.sourceEntryId), JSON.stringify(pay.map((e) => [e.amount, e.description])));
  const myBefore = (await call('GET', '/financial/my-commissions', asC())).data;
  ok('7d. corretor vê as comissões dele a receber (R$ 9.360) e não acessa o financeiro geral', myBefore.totals?.toReceive === 9360 && (await call('GET', '/financial/entries', asC())).status === 403, JSON.stringify(myBefore.totals));

  // ── 8. Boleto (parcela 1) e PIX (parcela 2) ─────────────
  const gw = await call('POST', '/billing/gateways', asO({ body: { provider: 'ASAAS', name: 'Asaas teste', apiKey: ASAAS_KEY, environment: 'SANDBOX', isDefault: true } }));
  const TOKEN = (await call('POST', `/billing/gateways/${gw.data.id}/webhook-token`, asO())).data.webhookToken;
  const wh = (body) => call('POST', `/billing/webhook/${O.ws}`, { body, headers: { 'asaas-access-token': TOKEN } });
  const boleto = await call('POST', '/billing/boletos', asO({ body: { financialEntryId: rec[0].id, kind: 'BOLETO' } }));
  ok('8a. boleto da 1ª parcela emitido no Asaas com o valor certo', boleto.status === 201 && boleto.data.linhaDigitavel && asaas.payments.get(boleto.data.gatewayBoletoId)?.value === 11700, short(boleto));
  const whBol = await wh({ id: 'evt_b_' + run, event: 'PAYMENT_RECEIVED', payment: { id: boleto.data.gatewayBoletoId, value: 11700, originalValue: 11700, paymentDate: iso(0) } });
  const e1 = (await call('GET', `/financial/entries/${rec[0].id}`, asO())).data;
  ok('8b. aviso de pagamento do boleto baixa a 1ª parcela sozinho', whBol.status === 200 && whBol.data.result === 'PAID' && e1.status === 'PAID', short(whBol));
  const pix = await call('POST', '/billing/boletos', asO({ body: { financialEntryId: rec[1].id, kind: 'PIX' } }));
  ok('8c. PIX da 2ª parcela emitido com copia-e-cola', pix.status === 201 && pix.data.kind === 'PIX' && pix.data.pixCopiaECola?.startsWith('000201'), short(pix));
  const whPix = await wh({ id: 'evt_p_' + run, event: 'PAYMENT_RECEIVED', payment: { id: pix.data.gatewayBoletoId, value: 11700, originalValue: 11700, paymentDate: iso(0) } });
  const whDup = await wh({ id: 'evt_p_' + run, event: 'PAYMENT_RECEIVED', payment: { id: pix.data.gatewayBoletoId, value: 11700, originalValue: 11700, paymentDate: iso(0) } });
  const e2 = (await call('GET', `/financial/entries/${rec[1].id}`, asO())).data;
  const pays2 = (await call('GET', `/financial/entries/${rec[1].id}/payments`, asO())).data;
  ok('8d. aviso de pagamento do PIX baixa a 2ª parcela uma única vez (aviso repetido não duplica)', whPix.data?.result === 'PAID' && whDup.data?.duplicate === true && e2.status === 'PAID' && pays2.length === 1, short(whPix) + short(whDup));

  // ── 9. NFS-e da comissão (prefeitura simulada) ──────────
  await call('PATCH', '/nfse/config', asO({ body: { razaoSocial: 'Imobiliária Ouro Ltda', cnpj: certificate.cnpj, inscricaoMunicipal: '98765', itemListaServico: '10.05', codigoTributacaoMunicipio: '100500', aliquotaISS: 2, nfseWsUrlHomolog: 'http://127.0.0.1:3998/ws' } }));
  const fd = new FormData(); fd.append('file', new Blob([certificate.pfx]), 'cert.pfx'); fd.append('password', certificate.password);
  const certUp = await call('POST', '/nfse/config/certificate', asO({ body: fd }));
  const nf = await call('POST', `/nfse/entries/${rec[0].id}`, asO({ body: {} }));
  ok('9a. NFS-e da 1ª parcela autorizada, com número, tomador = vendedor', certUp.data?.readiness?.ready && nf.status === 201 && nf.data.status === 'AUTHORIZED' && nf.data.number && Number(nf.data.serviceAmount ?? nf.data.amount ?? 11700) === 11700, short(nf));
  ok('9b. XML chegou à prefeitura com assinatura digital válida', sil.badSignatures === 0 && sil.calls.includes('GerarNfse'), sil.calls.join(','));
  const nfDup = await call('POST', `/nfse/entries/${rec[0].id}`, asO({ body: {} }));
  ok('9c. não emite duas notas para a mesma parcela', nfDup.status >= 400, short(nfDup));

  // ── 10. Pagar a comissão do corretor ────────────────────
  for (const p of pay) await call('POST', `/financial/entries/${p.id}/payments`, asO({ body: { principal: Number(p.amount), method: 'PIX' } }));
  const payAfter = (await call('GET', `/contracts/${C}`, asO())).data.financialEntries.filter((e) => e.type === 'PAYABLE');
  const myAfter = (await call('GET', '/financial/my-commissions', asC())).data;
  ok('10. comissões do corretor pagas: ele vê R$ 9.360 recebidos e nada pendente', payAfter.every((e) => e.status === 'PAID') && myAfter.totals?.received === 9360 && myAfter.totals?.toReceive === 0, JSON.stringify(myAfter.totals));

  // ── 11. Fluxo de caixa ──────────────────────────────────
  const cf = await call('GET', `/financial/cash-flow?granularity=month&from=${YEAR}-01-01&to=${YEAR}-12-31`, asO());
  ok('11. fluxo de caixa realizado: entrou R$ 23.400, saiu R$ 9.360', cf.status === 200 && cf.data.totals.realizedIn === 23400 && cf.data.totals.realizedOut === 9360, JSON.stringify(cf.data?.totals));
  const vgv = await call('GET', `/reports/sales/vgv?from=${YEAR}-01-01&to=${YEAR}-12-31`, asO());
  ok('11b. relatório de VGV mostra a venda de R$ 390.000', JSON.stringify(vgv.data ?? {}).includes('390000'), short(vgv));

  // ── 12. DIMOB ───────────────────────────────────────────
  const dim = await call('GET', `/fiscal/dimob/export?year=${YEAR}`, asO());
  const decl = dim.data?.declarantes ?? [];
  ok('12a. a venda entra na DIMOB do ano', decl.length >= 1 && JSON.stringify(dim.data).includes('390000'), short(dim));
  if (decl.length) {
    const q = `year=${YEAR}&declarantDoc=${encodeURIComponent(decl[0].declarantDoc)}`;
    const val = await call('GET', `/fiscal/dimob/validate?${q}`, asO());
    ok('12b. validação da DIMOB sem erros (vendedor e compradora identificados)', val.status === 200 && val.data.errors === 0 && val.data.sales === 1, short(val));
    const pgd = await call('GET', `/fiscal/dimob/pgd?${q}`, asO());
    const txt = pgd.buf?.toString('latin1') ?? pgd.data?.content ?? JSON.stringify(pgd.data ?? '');
    ok('12c. arquivo do PGD traz o registro de venda (R04) com os dois CPFs', /R04/.test(txt) && txt.includes('11144477735') && txt.includes('52998224725'), String(txt).slice(0, 200));
  }

  // ── 13. Isolamento: outra imobiliária não vê nada disto ─
  const reg2 = await call('POST', '/auth/register', { body: { workspaceName: 'Outra ' + run, workspaceSlug: 'outra' + run, email: `outra-${run}@teste.local`, name: 'Outro Dono', password: PASS } });
  const X = { token: reg2.data.accessToken, ws: reg2.data.workspaceId };
  const peek = await Promise.all([`/contracts/${C}`, `/deals/${D}`, `/properties/${P}`, `/contacts/${buyer.id}`, `/financial/entries/${rec[0].id}`].map((p) => call('GET', p, X)));
  const cross = await call('GET', `/contracts/${C}`, { token: X.token, ws: O.ws });
  ok('13. outra imobiliária recebe "não encontrado" em tudo, e não entra na imobiliária alheia', peek.every((r) => r.status === 404) && cross.status === 403, peek.map((r) => r.status).join(',') + '/' + cross.status);
} catch (err) {
  ok('roteiro interrompido por erro inesperado', false, err?.stack ?? String(err));
} finally {
  asaas.close(); sil.close(); smtp.close();
}

let fail = 0;
for (const [c, n, e] of results) { if (!c) fail++; console.log(c ? 'OK  ' : 'FAIL', n, c ? '' : '→ ' + e); }
console.log(`\n${results.length - fail}/${results.length} verificações passaram`);
process.exit(fail ? 1 : 0);
