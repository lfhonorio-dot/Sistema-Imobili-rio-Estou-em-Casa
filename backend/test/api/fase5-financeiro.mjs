// Roteiro de ponta a ponta da Fase 5 (financeiro) contra a API REAL, com um
// Asaas SIMULADO local (nenhuma chamada sai para a internet).
// Uso: suba o backend com
//   ASAAS_API_URL_TEST_OVERRIDE=http://127.0.0.1:3999   (só funciona fora de produção)
// apontando para um banco de TESTE, e rode (de dentro de backend/):
//   API_URL=http://localhost:3001/api/v1 DATABASE_URL=... node test/api/fase5-financeiro.mjs
// Nunca rode contra produção: o roteiro cria imobiliárias de teste.
import http from 'node:http';
import { PrismaClient } from '@prisma/client';

const B = process.env.API_URL || 'http://localhost:3001/api/v1';
const results = [];
const ok = (name, cond, extra = '') => results.push([!!cond, name, extra]);

// ── Asaas simulado ─────────────────────────────────────────
const asaas = { payments: new Map(), deleted: [], calls: [] };
let seq = 0;
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    asaas.calls.push(`${req.method} ${req.url}`);
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.headers.access_token !== 'chave-asaas-teste') return send(401, { errors: [{ description: 'Chave de API inválida' }] });
    const u = new URL(req.url, 'http://x');
    if (req.method === 'GET' && u.pathname === '/customers') return send(200, { data: [] });
    if (req.method === 'POST' && u.pathname === '/customers') return send(200, { id: 'cus_' + (++seq) });
    if (req.method === 'POST' && u.pathname === '/payments') {
      const p = JSON.parse(body);
      const id = 'pay_' + (++seq);
      asaas.payments.set(id, p);
      return send(200, { id, status: 'PENDING', bankSlipUrl: p.billingType === 'BOLETO' ? `https://asaas.test/b/${id}.pdf` : null, invoiceUrl: `https://asaas.test/i/${id}`, nossoNumero: 'NN' + seq });
    }
    let m = u.pathname.match(/^\/payments\/([^/]+)\/identificationField$/);
    if (m) return send(200, { identificationField: '34191.79001 01043.510047 91020.150008 1 ' + m[1], barCode: '3419' + m[1] });
    m = u.pathname.match(/^\/payments\/([^/]+)\/pixQrCode$/);
    if (m) return send(200, { encodedImage: 'iVBORw0KGgo=', payload: '00020126580014br.gov.bcb.pix0136' + m[1] });
    m = u.pathname.match(/^\/payments\/([^/]+)$/);
    if (m && req.method === 'DELETE') {
      if (!asaas.payments.has(m[1])) return send(404, { errors: [{ description: 'Cobrança não encontrada' }] });
      asaas.deleted.push(m[1]);
      return send(200, { deleted: true, id: m[1] });
    }
    send(404, { errors: [{ description: 'rota simulada inexistente' }] });
  });
});
await new Promise((r) => server.listen(3999, '127.0.0.1', r));

// ── helpers ────────────────────────────────────────────────
async function call(method, path, { token, ws, body, headers: extra } = {}) {
  const headers = { ...(extra ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ws) headers['X-Workspace-Id'] = ws;
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(B + path, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) });
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('spreadsheet')) return { status: res.status, ct, buf: Buffer.from(await res.arrayBuffer()) };
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, data: json?.data ?? json, raw: json };
}
const short = (r) => JSON.stringify(r.raw ?? r).slice(0, 300);
async function register(slug) {
  const r = await call('POST', '/auth/register', { body: { workspaceName: 'Imob ' + slug, workspaceSlug: slug, email: `${slug}@teste.local`, name: 'Dono', password: 'Senha@12345' } });
  if (r.status >= 300) throw new Error('register ' + short(r));
  return { token: r.data.accessToken, ws: r.data.workspaceId };
}
const run = Date.now().toString(36);
const A = await register('f5a' + run);
const Bw = await register('f5b' + run);
const as = (o = {}) => ({ token: A.token, ws: A.ws, ...o });
const asB = (o = {}) => ({ token: Bw.token, ws: Bw.ws, ...o });
const iso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const entry = async (id) => (await call('GET', `/financial/entries/${id}`, as())).data;

try {
  // ── 1. Categorias e centros de custo ─────────────────────
  const cats = await call('GET', '/financial/categories', as());
  ok('plano de categorias padrão criado (receitas e despesas)', cats.status === 200 && cats.data.some((c) => c.type === 'PAYABLE' && c.code === 'TAXES') && cats.data.some((c) => c.type === 'RECEIVABLE' && c.code === 'COMMISSION'), short(cats));
  const newCat = await call('POST', '/financial/categories', as({ body: { type: 'PAYABLE', name: 'Aluguel de salas' } }));
  ok('categoria nova criada com código sem acento', newCat.status === 201 && newCat.data.code === 'ALUGUEL_DE_SALAS', short(newCat));
  const dupCat = await call('POST', '/financial/categories', as({ body: { type: 'PAYABLE', name: 'aluguel de SALAS' } }));
  ok('categoria duplicada é recusada', dupCat.status === 409, short(dupCat));
  const sysDel = await call('DELETE', `/financial/categories/${cats.data.find((c) => c.code === 'TAXES').id}`, as());
  ok('categoria padrão não pode ser removida (só desativada)', sysDel.status === 400, short(sysDel));
  const cc = await call('POST', '/financial/cost-centers', as({ body: { name: 'Administrativo' } }));
  const ccB = await call('POST', '/financial/cost-centers', asB({ body: { name: 'Do B' } }));
  ok('centro de custo criado', cc.status === 201, short(cc));

  const badCat = await call('POST', '/financial/entries', as({ body: { type: 'PAYABLE', category: 'NAO_EXISTE', description: 'x', amount: 10, dueDate: iso(5) } }));
  ok('categoria inexistente é recusada no lançamento', badCat.status === 400 && /Categoria/.test(badCat.raw.message), short(badCat));
  const otherCc = await call('POST', '/financial/entries', as({ body: { type: 'PAYABLE', category: 'OTHER', description: 'x', amount: 10, dueDate: iso(5), costCenterId: ccB.data.id } }));
  ok('centro de custo de outra imobiliária é recusado', otherCc.status === 400, short(otherCc));

  // ── 2. Baixa parcial, juros/multa/desconto, estorno, cancelamento ──
  const rent = await call('POST', '/financial/entries', as({ body: { type: 'PAYABLE', category: 'ALUGUEL_DE_SALAS', description: 'Aluguel sala', amount: 1000, dueDate: iso(-15), costCenterId: cc.data.id } }));
  ok('conta a pagar com categoria nova e centro de custo', rent.status === 201 && rent.data.costCenterId === cc.data.id, short(rent));
  const R = rent.data.id;
  const sug = await call('GET', `/financial/entries/${R}/payment-suggestion`, as());
  ok('sugestão de multa (2%) e juros (1% a.m. pro rata) para 15 dias de atraso', sug.data.fine === 20 && sug.data.interest === 5 && sug.data.daysLate === 15, short(sug));
  const p1 = await call('POST', `/financial/entries/${R}/payments`, as({ body: { principal: 400, method: 'PIX' } }));
  let e = await entry(R);
  ok('baixa parcial: conta continua em aberto com saldo de 600', p1.status === 201 && e.status === 'OVERDUE' && Number(e.paidAmount) === 400 && e.openAmount === 600, short(p1));
  const tooMuch = await call('POST', `/financial/entries/${R}/payments`, as({ body: { principal: 600.01 } }));
  ok('baixa maior que o saldo é recusada', tooMuch.status === 400 && /maior que o saldo/.test(tooMuch.raw.message), short(tooMuch));
  const future = await call('POST', `/financial/entries/${R}/payments`, as({ body: { principal: 10, paidAt: iso(10) } }));
  ok('baixa com data futura é recusada', future.status === 400, short(future));

  // comprovante
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const fd = new FormData(); fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'comprovante.pdf');
  const up = await call('POST', '/financial/receipts', as({ body: fd }));
  ok('comprovante enviado', up.status === 201 && up.data.id, short(up));
  const fdB = new FormData(); fdB.append('file', new Blob([pdf], { type: 'application/pdf' }), 'b.pdf');
  const upB = await call('POST', '/financial/receipts', asB({ body: fdB }));
  const alien = await call('POST', `/financial/entries/${R}/payments`, as({ body: { principal: 10, receiptFileId: upB.data.id } }));
  ok('comprovante de outra imobiliária é recusado', alien.status === 400, short(alien));

  const p2 = await call('POST', `/financial/entries/${R}/payments`, as({ body: { principal: 600, fine: 20, interest: 5, discount: 1.5, method: 'TRANSFER', receiptFileId: up.data.id } }));
  e = await entry(R);
  ok('2ª baixa quita: total pago = 600 + 20 + 5 − 1,50 = 623,50', p2.status === 201 && Number(p2.data.payment.total) === 623.5 && e.status === 'PAID', short(p2));
  const list = await call('GET', `/financial/entries/${R}/payments`, as());
  ok('histórico com 2 baixas e link do comprovante', list.data.length === 2 && list.data[1].receiptUrl?.startsWith('/files/'), short(list));
  const edit = await call('PATCH', `/financial/entries/${R}`, as({ body: { type: 'PAYABLE', category: 'ALUGUEL_DE_SALAS', description: 'x', amount: 1000, dueDate: iso(-15) } }));
  ok('conta quitada não pode ser editada', edit.status === 400, short(edit));
  const cancelPaid = await call('POST', `/financial/entries/${R}/cancel`, as({ body: { reason: 'teste' } }));
  ok('cancelar conta com baixa é recusado (estorne antes)', cancelPaid.status === 400 && /Estorne/.test(cancelPaid.raw.message), short(cancelPaid));
  const revNoReason = await call('POST', `/financial/payments/${p2.data.payment.id}/reverse`, as({ body: { reason: ' ' } }));
  ok('estorno exige motivo', revNoReason.status === 400, short(revNoReason));
  const revB = await call('POST', `/financial/payments/${p2.data.payment.id}/reverse`, asB({ body: { reason: 'invasão' } }));
  ok('outra imobiliária não estorna a baixa', revB.status === 404, short(revB));
  const rev = await call('POST', `/financial/payments/${p2.data.payment.id}/reverse`, as({ body: { reason: 'Pagamento devolvido pelo banco' } }));
  e = await entry(R);
  ok('estorno reabre a conta com o saldo de 600', rev.status === 200 && e.status === 'OVERDUE' && e.openAmount === 600, short(rev));
  const rev2 = await call('POST', `/financial/payments/${p2.data.payment.id}/reverse`, as({ body: { reason: 'de novo' } }));
  ok('estornar duas vezes é recusado', rev2.status === 400, short(rev2));
  await call('POST', `/financial/payments/${p1.data.payment.id}/reverse`, as({ body: { reason: 'lançado errado' } }));
  const cancelNo = await call('POST', `/financial/entries/${R}/cancel`, as({ body: { reason: '' } }));
  ok('cancelamento exige motivo', cancelNo.status === 400, short(cancelNo));
  const canc = await call('POST', `/financial/entries/${R}/cancel`, as({ body: { reason: 'Contrato da sala encerrado' } }));
  ok('conta cancelada com motivo (nada apagado)', canc.status === 200 && canc.data.status === 'CANCELLED' && canc.data.cancelReason === 'Contrato da sala encerrado', short(canc));

  // ── 3. Recorrência mensal real ────────────────────────────
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)).toISOString().slice(0, 10);
  const recur = await call('POST', '/financial/recurring', as({ body: { type: 'PAYABLE', category: 'UTILITIES', description: 'Internet', amount: 129.9, dayOfMonth: 10, startDate: start } }));
  ok('recorrência gera do início até o mês que vem (4 meses)', recur.status === 201 && recur.data.generatedNow === 4, short(recur));
  await call('PATCH', `/financial/recurring/${recur.data.id}`, as({ body: { amount: 139.9 } }));
  const recList = await call('GET', '/financial/recurring', as());
  ok('rodar de novo não duplica meses', recList.data.find((r) => r.id === recur.data.id)?.generated === 4, short(recList));
  const internet = await call('GET', '/financial/entries?search=Internet&limit=50', as());
  ok('lançamentos da recorrência têm competência e vencimento no dia 10', internet.data.items.length === 4 && internet.data.items.every((i) => i.competence && i.dueDate.slice(8, 10) === '10'), short(internet));

  // ── 4. Boleto e PIX (Asaas simulado) ───────────────────────
  const payer = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Pagador', cpf: '52998224725', email: 'pagador@teste.local', phone: '16999990000' } }))).data;
  const recv = await call('POST', '/financial/entries', as({ body: { type: 'RECEIVABLE', category: 'COMMISSION', description: 'Comissão avulsa', amount: 1000, dueDate: iso(10), contactId: payer.id } }));
  const E = recv.data.id;
  const noGw = await call('POST', '/billing/boletos', as({ body: { financialEntryId: E } }));
  ok('sem gateway, boleto é recusado com mensagem clara', noGw.status === 400 && /não disponível/.test(noGw.raw.message), short(noGw));
  const gw = await call('POST', '/billing/gateways', as({ body: { provider: 'ASAAS', name: 'Asaas teste', apiKey: 'chave-asaas-teste', environment: 'SANDBOX', isDefault: true } }));
  ok('gateway cadastrado sem devolver a chave', gw.status === 201 && gw.data && !('apiKey' in gw.data) && gw.data.hasWebhookToken === false, short(gw));
  const test = await call('POST', `/billing/gateways/${gw.data.id}/test`, as());
  ok('teste de conexão com o Asaas', test.status === 200 && test.data.ok === true, short(test));
  const tok = await call('POST', `/billing/gateways/${gw.data.id}/webhook-token`, as());
  ok('token do webhook gerado', tok.status === 200 && tok.data.webhookToken?.length === 48, short(tok));
  const TOKEN = tok.data.webhookToken;

  const bol = await call('POST', '/billing/boletos', as({ body: { financialEntryId: E, kind: 'BOLETO' } }));
  ok('boleto emitido no Asaas (linha digitável e PDF)', bol.status === 201 && bol.data.kind === 'BOLETO' && bol.data.linhaDigitavel && bol.data.bankSlipUrl, short(bol));
  const sentToAsaas = asaas.payments.get(bol.data.gatewayBoletoId);
  ok('Asaas recebeu valor, vencimento, multa e juros padrão', sentToAsaas?.value === 1000 && sentToAsaas.billingType === 'BOLETO' && sentToAsaas.fine?.value === 2 && sentToAsaas.interest?.value === 1, JSON.stringify(sentToAsaas));
  const dupBol = await call('POST', '/billing/boletos', as({ body: { financialEntryId: E, kind: 'PIX' } }));
  ok('segunda cobrança na mesma conta é recusada', dupBol.status === 400, short(dupBol));
  const manual = await call('POST', `/financial/entries/${E}/payments`, as({ body: { principal: 1000 } }));
  ok('baixa manual com boleto ativo é recusada (evita pagar em dobro)', manual.status === 400 && /boleto/.test(manual.raw.message), short(manual));
  const editAmt = await call('PATCH', `/financial/entries/${E}`, as({ body: { type: 'RECEIVABLE', category: 'COMMISSION', description: 'Comissão avulsa', amount: 900, dueDate: iso(10), contactId: payer.id } }));
  ok('mudar valor com boleto ativo é recusado (use reemitir)', editAmt.status === 400 && /Reemitir/.test(editAmt.raw.message), short(editAmt));
  const cancB = await call('POST', `/billing/boletos/${bol.data.id}/cancel`, asB({ body: { reason: 'x' } }));
  ok('outra imobiliária não cancela a cobrança', cancB.status === 404, short(cancB));
  const cancBol = await call('POST', `/billing/boletos/${bol.data.id}/cancel`, as({ body: { reason: 'Cliente pediu PIX' } }));
  ok('cancelar boleto cancela no Asaas e libera a conta', cancBol.status === 200 && cancBol.data.status === 'CANCELLED' && asaas.deleted.includes(bol.data.gatewayBoletoId) && cancBol.data.financialEntryId === null && cancBol.data.entryRef === E, short(cancBol));
  const pix = await call('POST', '/billing/boletos', as({ body: { financialEntryId: E, kind: 'PIX' } }));
  ok('PIX emitido com QR Code e copia-e-cola', pix.status === 201 && pix.data.kind === 'PIX' && pix.data.pixCopiaECola?.startsWith('000201') && pix.data.pixQrCode, short(pix));
  const reiss = await call('POST', `/billing/boletos/${pix.data.id}/reissue`, as({ body: { newDueDate: iso(20) } }));
  ok('reemitir cancela o PIX antigo no Asaas e emite outro', reiss.status === 200 && reiss.data.id !== pix.data.id && asaas.deleted.includes(pix.data.gatewayBoletoId) && reiss.data.kind === 'PIX', short(reiss));
  const hist = await call('GET', `/billing/boletos?entryId=${E}`, as());
  ok('histórico de cobranças da conta: 2 canceladas + 1 ativa', hist.data.items.length === 3 && hist.data.items.filter((b) => b.status === 'CANCELLED').length === 2, short(hist));

  // envio: SMTP e WhatsApp não configurados neste teste → erro visível
  const sendMail = await call('POST', `/billing/boletos/${reiss.data.id}/send`, as({ body: { channels: ['EMAIL'] } }));
  ok('falha no envio por e-mail vira erro visível (nada de "enviado")', sendMail.status === 400 && /e-mail/.test(sendMail.raw.message), short(sendMail));
  const sendWa = await call('POST', `/billing/boletos/${reiss.data.id}/send`, as({ body: { channels: ['WHATSAPP'] } }));
  ok('falha no envio por WhatsApp vira erro visível', sendWa.status === 400 && /WhatsApp/.test(sendWa.raw.message), short(sendWa));
  const afterSend = (await call('GET', `/billing/boletos/${reiss.data.id}`, as())).data;
  ok('cobrança não fica marcada como enviada', !afterSend.lastSentAt, short(afterSend));

  // webhook
  const wh = (body, token = TOKEN) => call('POST', `/billing/webhook/${A.ws}`, { body, headers: { 'asaas-access-token': token } });
  const whBad = await wh({ id: 'evt_x', event: 'PAYMENT_RECEIVED', payment: { id: reiss.data.gatewayBoletoId, value: 1000 } }, 'token-errado');
  ok('webhook com token errado é recusado', whBad.status === 403, short(whBad));
  const evt = { id: 'evt_' + run, event: 'PAYMENT_RECEIVED', payment: { id: reiss.data.gatewayBoletoId, value: 1010, originalValue: 1000, paymentDate: iso(0) } };
  const whOk = await wh(evt);
  e = await entry(E);
  ok('webhook baixa a conta automaticamente (R$ 10 de juros cobrados pelo banco)', whOk.status === 200 && whOk.data.result === 'PAID' && e.status === 'PAID', short(whOk));
  const pays = (await call('GET', `/financial/entries/${E}/payments`, as())).data;
  ok('baixa do gateway: principal 1000 + juros 10', pays.length === 1 && Number(pays[0].principal) === 1000 && Number(pays[0].interest) === 10 && pays[0].source === 'GATEWAY', JSON.stringify(pays));
  const whDup = await wh(evt);
  ok('mesmo evento de novo não baixa duas vezes', whDup.status === 200 && whDup.data.duplicate === true && (await call('GET', `/financial/entries/${E}/payments`, as())).data.length === 1, short(whDup));
  const whConfirmed = await wh({ id: 'evt2_' + run, event: 'PAYMENT_CONFIRMED', payment: { id: reiss.data.gatewayBoletoId, value: 1010 } });
  ok('evento CONFIRMED depois do RECEIVED é ignorado (já pago)', whConfirmed.data.result === 'ALREADY_PAID', short(whConfirmed));

  // cancelar conta com cobrança ativa → cancela no Asaas primeiro
  const recv2 = (await call('POST', '/financial/entries', as({ body: { type: 'RECEIVABLE', category: 'OTHER', description: 'Taxa', amount: 250, dueDate: iso(5), contactId: payer.id } }))).data;
  const bol2 = (await call('POST', '/billing/boletos', as({ body: { financialEntryId: recv2.id } }))).data;
  const cancEntry = await call('POST', `/financial/entries/${recv2.id}/cancel`, as({ body: { reason: 'Cobrança indevida' } }));
  ok('cancelar conta cancela o boleto no Asaas antes', cancEntry.status === 200 && asaas.deleted.includes(bol2.gatewayBoletoId), short(cancEntry));

  // ── 5. Bancário: extrato, conciliação, razão ────────────────
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const acc = await call('POST', '/banking/accounts', as({ body: { name: 'Conta Asaas', bankName: 'Asaas', openingBalance: 5000, openingDate: monthStart } }));
  ok('conta bancária com saldo inicial', acc.status === 201 && Number(acc.data.openingBalance) === 5000, short(acc));
  const supplierBill = (await call('POST', '/financial/entries', as({ body: { type: 'PAYABLE', category: 'MARKETING', description: 'Portal de anúncios', amount: 350, dueDate: iso(0) } }))).data;
  const d = (n) => { const x = new Date(Date.now() + n * 864e5); return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`; };
  const csv = `Data;Histórico;Valor\n${d(0)};PIX recebido Pagador;1.010,00\n${d(0)};Pagamento portal;-350,00\n${d(0)};Tarifa;-9,90\n`;
  const imp = await call('POST', '/banking/statement/import', as({ body: { bankAccountId: acc.data.id, fileName: 'extrato.csv', content: Buffer.from(csv).toString('base64') } }));
  ok('extrato CSV importado (3 lançamentos)', imp.status === 201 && imp.data.imported === 3 && imp.data.format === 'CSV', short(imp));
  const imp2 = await call('POST', '/banking/statement/import', as({ body: { bankAccountId: acc.data.id, fileName: 'extrato.csv', content: Buffer.from(csv).toString('base64') } }));
  ok('reimportar o mesmo arquivo não duplica', imp2.data.imported === 0 && imp2.data.duplicates === 3, short(imp2));
  const ofx = `<OFX><STMTTRN><DTPOSTED>${iso(0).replace(/-/g, '')}<TRNAMT>12.34<FITID>ofx-${run}<MEMO>Rendimento</STMTTRN></OFX>`;
  const impOfx = await call('POST', '/banking/statement/import', as({ body: { bankAccountId: acc.data.id, fileName: 'extrato.ofx', content: Buffer.from(ofx).toString('base64') } }));
  ok('extrato OFX importado', impOfx.data.imported === 1 && impOfx.data.format === 'OFX', short(impOfx));
  const badFile = await call('POST', '/banking/statement/import', as({ body: { bankAccountId: acc.data.id, fileName: 'x.pdf', content: Buffer.from('oi').toString('base64') } }));
  ok('formato desconhecido dá erro claro', badFile.status === 400 && /Formato/.test(badFile.raw.message), short(badFile));
  const impB = await call('POST', '/banking/statement/import', asB({ body: { bankAccountId: acc.data.id, fileName: 'e.csv', content: Buffer.from(csv).toString('base64') } }));
  ok('outra imobiliária não importa na conta', impB.status === 404, short(impB));

  const txs = (await call('GET', `/banking/transactions?bankAccountId=${acc.data.id}&reconciled=false&limit=50`, as())).data.items;
  const credit = txs.find((t) => Number(t.amount) === 1010);
  const debit = txs.find((t) => Number(t.amount) === -350);
  const fee = txs.find((t) => Number(t.amount) === -9.9);
  const sugg = await call('GET', `/banking/transactions/${credit.id}/suggestions`, as());
  ok('sugestão: a entrada de 1.010 casa com a baixa já feita pelo webhook', sugg.data.payments.some((p) => p.entryId === E), short(sugg));
  const wrongSide = await call('POST', '/banking/reconcile', as({ body: { bankTransactionId: debit.id, financialEntryId: E } }));
  ok('saída do extrato não concilia com conta a receber', wrongSide.status === 400, short(wrongSide));
  const auto = await call('POST', `/banking/accounts/${acc.data.id}/auto-reconcile`, as());
  ok('conciliação automática casa a entrada (baixa existente) e a saída (conta aberta)', auto.status === 200 && auto.data.matched === 2, short(auto));
  const billAfter = await entry(supplierBill.id);
  const billPays = (await call('GET', `/financial/entries/${supplierBill.id}/payments`, as())).data;
  ok('conciliação baixou a conta a pagar, na conta bancária certa', billAfter.status === 'PAID' && billPays[0]?.source === 'RECONCILIATION' && billPays[0]?.bankAccountId === acc.data.id, JSON.stringify(billPays));
  const feeNoNote = await call('POST', '/banking/reconcile', as({ body: { bankTransactionId: fee.id } }));
  ok('conciliar sem conta exige observação', feeNoNote.status === 400, short(feeNoNote));
  const feeOk = await call('POST', '/banking/reconcile', as({ body: { bankTransactionId: fee.id, notes: 'Tarifa do banco' } }));
  ok('tarifa conciliada com observação', feeOk.status === 200, short(feeOk));
  const led = await call('GET', `/banking/accounts/${acc.data.id}/ledger?from=${monthStart}`, as());
  ok('razão bancário: 5.000 + 1.010 − 350 − 9,90 + 12,34 = 5.662,44', led.status === 200 && led.data.openingBalance === 5000 && led.data.closingBalance === 5662.44 && led.data.rows.length === 4, short(led));
  const unrec = await call('POST', `/banking/transactions/${debit.id}/unreconcile`, as());
  const billBack = await entry(supplierBill.id);
  ok('desfazer conciliação estorna a baixa e reabre a conta', unrec.status === 200 && billBack.status !== 'PAID' && billBack.openAmount === 350, short(unrec));
  const unrecCredit = await call('POST', `/banking/transactions/${credit.id}/unreconcile`, as());
  ok('desfazer conciliação de baixa do gateway só desliga o extrato (baixa continua)', unrecCredit.status === 200 && (await entry(E)).status === 'PAID', short(unrecCredit));

  // ── 6. Fluxo de caixa e DRE ─────────────────────────────────
  const cf = await call('GET', `/financial/cash-flow?granularity=day&from=${monthStart}&to=${iso(40)}`, as());
  ok('fluxo de caixa diário: realizado inclui a baixa do gateway (1.010)', cf.status === 200 && cf.data.totals.realizedIn >= 1010 && cf.data.rows[0].period === monthStart, short(cf));
  ok('fluxo projetado inclui contas em aberto (a pagar 350 e internet)', cf.data.totals.projectedOut > cf.data.totals.realizedOut, short(cf));
  const cfAcc = await call('GET', `/financial/cash-flow?granularity=month&bankAccountId=${acc.data.id}`, as());
  ok('fluxo por conta: começa no saldo inicial e não projeta contas sem conta', cfAcc.status === 200 && cfAcc.data.projectionIncluded === false && cfAcc.data.bankAccount?.id === acc.data.id, short(cfAcc));
  const cfX = await call('GET', `/financial/cash-flow/export?granularity=month`, as());
  ok('exportação do fluxo em Excel (.xlsx)', cfX.status === 200 && cfX.buf?.slice(0, 2).toString() === 'PK', short(cfX));
  const dre = await call('GET', `/financial/dre?year=${now.getUTCFullYear()}`, as());
  const comm = dre.data.revenue?.find((l) => l.category === 'COMMISSION');
  ok('DRE por caixa: comissão recebida 1.010 no mês; juros entram no valor', comm?.months[now.getUTCMonth()] === 1010, short(dre));
  const dreX = await call('GET', `/financial/dre/export?year=${now.getUTCFullYear()}`, as());
  ok('exportação do DRE em Excel', dreX.status === 200 && dreX.buf?.slice(0, 2).toString() === 'PK', short(dreX));
  const sumr = await call('GET', '/financial/summary', as());
  ok('resumo: recebido no mês vem das baixas', sumr.data.totalReceived >= 1010, short(sumr));

  // ── 7. Vendas antigas (simula contrato ativado pelo sistema antigo) ──
  const prisma = new PrismaClient();
  const seller = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Vendedor antigo', cpf: '11144477735' } }))).data;
  const prop = (await call('POST', '/properties', as({ body: { type: 'HOUSE', purpose: 'SALE', city: 'Patrocínio Paulista', street: 'Rua C', number: '3', salePrice: 300000, ownerId: seller.id } }))).data;
  const legacy = (await call('POST', '/contracts', as({ body: { type: 'SALE', propertyId: prop.id, ownerId: seller.id, saleValue: 300000, commissionRate: 5 } }))).data;
  await prisma.contract.update({ where: { id: legacy.id }, data: { status: 'ACTIVE', activatedAt: null } });
  await prisma.$disconnect();
  const diag = await call('GET', '/contracts/sale/legacy', as());
  const row = diag.data.find?.((r) => r.id === legacy.id);
  ok('diagnóstico lista a venda antiga sem comissão lançada', row?.needsRegularization === true && row.suggestedCommission === 15000, short(diag));
  const reg = await call('POST', `/contracts/${legacy.id}/sale/regularize`, as({ body: { installmentsCount: 1, firstDueDate: iso(15), commissionPayerId: seller.id } }));
  ok('regularização lança a comissão de 15.000 a receber', reg.status === 201 && reg.data.receivables === 1 && reg.data.commissionTotal === 15000, short(reg));
  const reg2 = await call('POST', `/contracts/${legacy.id}/sale/regularize`, as({ body: { installmentsCount: 1, firstDueDate: iso(15) } }));
  ok('regularizar de novo é recusado', reg2.status === 409 || reg2.status === 400, short(reg2));
  const regB = await call('POST', `/contracts/${legacy.id}/sale/regularize`, asB({ body: { installmentsCount: 1 } }));
  ok('outra imobiliária não regulariza', regB.status === 404, short(regB));

  // ── 8. Rescisão cancela cobrança no Asaas ───────────────────
  const legacyEntries = (await call('GET', `/financial/entries?contractId=${legacy.id}&type=RECEIVABLE`, as())).data.items;
  const bol3 = (await call('POST', '/billing/boletos', as({ body: { financialEntryId: legacyEntries[0].id } }))).data;
  const resc = await call('POST', `/contracts/${legacy.id}/sale/rescind`, as({ body: { reason: 'Desistência' } }));
  ok('rescisão cancela o boleto em aberto no Asaas', resc.status === 201 && resc.data.chargesCancelled === 1 && asaas.deleted.includes(bol3.gatewayBoletoId), short(resc));

  // ── 9. Isolamento ───────────────────────────────────────────
  const isoChecks = await Promise.all([
    call('GET', `/financial/entries/${E}/payments`, asB()),
    call('GET', `/banking/accounts/${acc.data.id}/ledger`, asB()),
    call('GET', `/banking/transactions/${credit.id}/suggestions`, asB()),
    call('POST', `/billing/boletos/${reiss.data.id}/send`, asB({ body: { channels: ['EMAIL'] } })),
    call('POST', `/financial/entries/${E}/cancel`, asB({ body: { reason: 'x' } })),
  ]);
  ok('outra imobiliária não vê nem mexe em nada (404)', isoChecks.every((r) => r.status === 404), isoChecks.map((r) => r.status).join(','));
  const listB = await call('GET', '/financial/entries?limit=100', asB());
  ok('listagem da outra imobiliária não traz lançamentos desta', listB.data.items.length === 0, short(listB));
} finally {
  server.close();
}

let fail = 0;
for (const [c, n, e] of results) { if (!c) fail++; console.log(c ? 'OK  ' : 'FAIL', n, c ? '' : '→ ' + e); }
console.log(`\n${results.length - fail}/${results.length} verificações passaram`);
process.exit(fail ? 1 : 0);
