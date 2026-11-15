// Roteiro de ponta a ponta da Fase 6 (NFS-e) contra a API REAL, com a SIL
// (webservice ABRASF 2.04 da prefeitura) SIMULADA localmente — nenhuma nota
// vai para a prefeitura. O simulador confere a assinatura digital do XML.
// Uso (de dentro de backend/, backend rodando fora de produção):
//   API_URL=http://localhost:3001/api/v1 node test/api/fase6-nfse.mjs
import http from 'node:http';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

const B = process.env.API_URL || 'http://localhost:3001/api/v1';
const results = [];
const ok = (name, cond, extra = '') => results.push([!!cond, name, extra]);

// ── certificado A1 de TESTE ────────────────────────────────
const CNPJ = '12345678000195';
const keys = forge.pki.rsa.generateKeyPair(1024);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey; cert.serialNumber = '01';
cert.validity.notBefore = new Date(Date.now() - 864e5); cert.validity.notAfter = new Date(Date.now() + 365 * 864e5);
cert.setSubject([{ name: 'commonName', value: `IMOBILIARIA TESTE LTDA:${CNPJ}` }]); cert.setIssuer([{ name: 'commonName', value: 'AC TESTE' }]);
cert.sign(keys.privateKey, forge.md.sha256.create());
const PFX = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'senha123', { algorithm: '3des' })).getBytes(), 'binary');
const CERT_PEM = forge.pki.certificateToPem(cert);

// ── SIL simulada ───────────────────────────────────────────
const sil = { calls: [], badSignatures: 0, notes: new Map(), cancelled: new Set(), rejectOnce: new Set(), seq: 2026000100 };
const resp = (op, inner) => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:${op}Response xmlns:ns2="http://nfse.abrasf.org.br"><outputXML>${inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</outputXML></ns2:${op}Response></soap:Body></soap:Envelope>`;
const comp = (n) => `<CompNfse><Nfse versao="2.04"><InfNfse Id="N${n.numero}"><Numero>${n.numero}</Numero><CodigoVerificacao>CV${n.numero}</CodigoVerificacao><DataEmissao>${new Date().toISOString().slice(0, 19)}</DataEmissao><DeclaracaoPrestacaoServico>${n.rps}</DeclaracaoPrestacaoServico></InfNfse></Nfse></CompNfse>`;
const verify = (xml) => {
  const m = xml.match(/<Signature[\s\S]*?<\/Signature>/);
  if (!m) return false;
  const v = new SignedXml({ publicCert: CERT_PEM });
  v.loadSignature(m[0]);
  try { return v.checkSignature(xml); } catch { return false; }
};
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const op = (body.match(/<nfse:(\w+)Request>/) || [])[1];
    const dados = (body.match(/<nfseDadosMsg><!\[CDATA\[([\s\S]*?)\]\]><\/nfseDadosMsg>/) || [])[1] ?? '';
    sil.calls.push(op);
    const send = (x) => { res.writeHead(200, { 'Content-Type': 'text/xml' }); res.end(x); };
    if (op === 'GerarNfse') {
      if (!verify(dados)) { sil.badSignatures++; return send(resp(op, '<GerarNfseResposta><ListaMensagemRetorno><MensagemRetorno><Codigo>E500</Codigo><Mensagem>Assinatura inválida</Mensagem></MensagemRetorno></ListaMensagemRetorno></GerarNfseResposta>')); }
      const rps = (dados.match(/<IdentificacaoRps>([\s\S]*?)<\/IdentificacaoRps>/) || [])[1];
      const key = (rps.match(/<Numero>(\d+)<\/Numero>/) || [])[1];
      if (/REJEITAR/.test(dados) && !sil.rejectOnce.has(key)) {
        sil.rejectOnce.add(key);
        return send(resp(op, '<GerarNfseResposta><ListaMensagemRetorno><MensagemRetorno><Codigo>E160</Codigo><Mensagem>Código de tributação inválido</Mensagem><Correcao>Confira o código do serviço</Correcao></MensagemRetorno></ListaMensagemRetorno></GerarNfseResposta>'));
      }
      if (sil.notes.has(key)) return send(resp(op, '<GerarNfseResposta><ListaMensagemRetorno><MensagemRetorno><Codigo>E10</Codigo><Mensagem>RPS já informado</Mensagem></MensagemRetorno></ListaMensagemRetorno></GerarNfseResposta>'));
      const n = { numero: String(++sil.seq), rps: dados.slice(0, 200).replace(/</g, '') , dados };
      sil.notes.set(key, n);
      return send(resp(op, `<GerarNfseResposta><ListaNfse>${comp(n)}</ListaNfse></GerarNfseResposta>`));
    }
    if (op === 'ConsultarNfsePorRps') {
      const key = (dados.match(/<Numero>(\d+)<\/Numero>/) || [])[1];
      const n = sil.notes.get(key);
      return send(resp(op, n ? `<ConsultarNfseRpsResposta>${comp(n)}</ConsultarNfseRpsResposta>` : '<ConsultarNfseRpsResposta><ListaMensagemRetorno><MensagemRetorno><Codigo>E92</Codigo><Mensagem>RPS não encontrado</Mensagem></MensagemRetorno></ListaMensagemRetorno></ConsultarNfseRpsResposta>'));
    }
    if (op === 'CancelarNfse') {
      if (!verify(dados)) { sil.badSignatures++; return send(resp(op, '<CancelarNfseResposta><ListaMensagemRetorno><MensagemRetorno><Codigo>E500</Codigo><Mensagem>Assinatura inválida</Mensagem></MensagemRetorno></ListaMensagemRetorno></CancelarNfseResposta>')); }
      const numero = (dados.match(/<Numero>(\d+)<\/Numero>/) || [])[1];
      sil.cancelled.add(numero);
      return send(resp(op, `<CancelarNfseResposta><RetCancelamento><NfseCancelamento><Confirmacao><DataHora>${new Date().toISOString()}</DataHora></Confirmacao></NfseCancelamento></RetCancelamento></CancelarNfseResposta>`));
    }
    res.writeHead(500); res.end('<soap:Envelope><soap:Body><soap:Fault><faultstring>operacao desconhecida</faultstring></soap:Fault></soap:Body></soap:Envelope>');
  });
});
await new Promise((r) => server.listen(3998, '127.0.0.1', r));

// ── helpers ────────────────────────────────────────────────
async function call(method, path, { token, ws, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ws) headers['X-Workspace-Id'] = ws;
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(B + path, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) });
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return { status: res.status, ct, buf: Buffer.from(await res.arrayBuffer()) };
  const json = await res.json();
  return { status: res.status, data: json?.data ?? json, raw: json };
}
const short = (r) => JSON.stringify(r.raw ?? r.status).slice(0, 300);
async function register(slug) {
  const r = await call('POST', '/auth/register', { body: { workspaceName: 'Imob ' + slug, workspaceSlug: slug, email: `${slug}@teste.local`, name: 'Dono', password: 'Senha@12345' } });
  if (r.status >= 300) throw new Error('register ' + short(r));
  return { token: r.data.accessToken, ws: r.data.workspaceId };
}
const run = Date.now().toString(36);
const A = await register('f6a' + run);
const Bw = await register('f6b' + run);
const as = (o = {}) => ({ token: A.token, ws: A.ws, ...o });
const asB = (o = {}) => ({ token: Bw.token, ws: Bw.ws, ...o });
const iso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const entry = async (id) => (await call('GET', `/financial/entries/${id}`, as())).data;

try {
  // ── 1. Configuração fiscal ──────────────────────────────
  let cfg = await call('GET', '/nfse/config', as());
  ok('configuração nasce em LUCRO PRESUMIDO, Franca, homologação', cfg.data.regime === 'LUCRO_PRESUMIDO' && cfg.data.codigoMunicipioIbge === '3516200' && cfg.data.nfseEnvironment === 'HOMOLOG', short(cfg));
  ok('mostra o que falta para emitir', cfg.data.readiness.ready === false && cfg.data.readiness.missing.includes('certificado digital A1'), short(cfg));
  const badIss = await call('PATCH', '/nfse/config', as({ body: { aliquotaISS: 7 } }));
  ok('ISS acima de 5% é recusado', badIss.status === 400, short(badIss));
  const badUrl = await call('PATCH', '/nfse/config', as({ body: { nfseWsUrlHomolog: 'http://servidor-qualquer.com/ws' } }));
  ok('webservice sem https é recusado', badUrl.status === 400, short(badUrl));
  cfg = await call('PATCH', '/nfse/config', as({ body: {
    razaoSocial: 'Imobiliária Teste Ltda', cnpj: '12.345.678/0001-95', inscricaoMunicipal: '98765', itemListaServico: '10.05',
    codigoTributacaoMunicipio: '100500', aliquotaISS: 2, nfseWsUrlHomolog: 'http://127.0.0.1:3998/ws',
  } }));
  ok('dados fiscais salvos (todas as alíquotas editáveis)', cfg.status === 200 && cfg.data.cnpj === CNPJ && cfg.data.aliquotaISS === 2, short(cfg));
  const prodEarly = await call('PATCH', '/nfse/config', as({ body: { nfseEnvironment: 'PRODUCTION' } }));
  ok('não liga produção sem autorização do dono', prodEarly.status === 400 && /Autorizar notas reais/.test(prodEarly.raw.message), short(prodEarly));

  const fdBad = new FormData(); fdBad.append('file', new Blob([PFX]), 'cert.pfx'); fdBad.append('password', 'errada');
  const certBad = await call('POST', '/nfse/config/certificate', as({ body: fdBad }));
  ok('senha errada do certificado: mensagem clara', certBad.status === 400 && /Senha do certificado/.test(certBad.raw.message), short(certBad));
  const fd = new FormData(); fd.append('file', new Blob([PFX]), 'cert.pfx'); fd.append('password', 'senha123');
  const certOk = await call('POST', '/nfse/config/certificate', as({ body: fd }));
  ok('certificado A1 aceito; senha e arquivo não voltam na resposta', certOk.status === 201 && certOk.data.hasCertificate && !('certPfxEnc' in certOk.data) && !('certPasswordEnc' in certOk.data) && certOk.data.readiness.ready, short(certOk));

  // ── 2. Contas e tomadores ───────────────────────────────
  const pj = (await call('POST', '/contacts', as({ body: { type: 'COMPANY', name: 'Construtora Alfa', companyName: 'Construtora Alfa Ltda', cnpj: '11222333000181', email: 'fin@alfa.local' } }))).data;
  const pf = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Carla Compradora', cpf: '52998224725', email: 'carla@t.local' } }))).data;
  const semDoc = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Sem Documento' } }))).data;
  const ePJ = (await call('POST', '/financial/entries', as({ body: { type: 'RECEIVABLE', category: 'COMMISSION', description: 'Comissão venda Rua do Sol', amount: 12000, dueDate: iso(10), contactId: pj.id } }))).data;
  const ePF = (await call('POST', '/financial/entries', as({ body: { type: 'RECEIVABLE', category: 'COMMISSION', description: 'Comissão venda Rua B', amount: 5000, dueDate: iso(5), contactId: pf.id } }))).data;
  await call('POST', `/financial/entries/${ePF.id}/payments`, as({ body: { principal: 5000, method: 'PIX' } }));
  const eNoDoc = (await call('POST', '/financial/entries', as({ body: { type: 'RECEIVABLE', category: 'COMMISSION', description: 'Comissão sem doc', amount: 1000, dueDate: iso(5), contactId: semDoc.id } }))).data;

  const pvNo = await call('POST', `/nfse/entries/${eNoDoc.id}/preview`, as({ body: {} }));
  ok('prévia avisa tomador sem CPF/CNPJ', pvNo.data.canIssue === false && pvNo.data.problems.some((p) => /CPF ou CNPJ/.test(p)), short(pvNo));
  const noDoc = await call('POST', `/nfse/entries/${eNoDoc.id}`, as({ body: {} }));
  ok('emissão sem CPF/CNPJ do tomador é recusada', noDoc.status === 400, short(noDoc));

  const pv = await call('POST', `/nfse/entries/${ePJ.id}/preview`, as({ body: {} }));
  ok('prévia PJ: ISS 240; retém IR 180 + PIS 78 + COFINS 360 + CSLL 120 = 738; líquido 11.262',
    pv.data.canIssue && pv.data.taxes.issDue === 240 && pv.data.taxes.totalRetained === 738 && pv.data.taxes.netAmount === 11262 && pv.data.taker.name === 'Construtora Alfa Ltda', short(pv));

  // ── 3. Emissão PJ (homologação) ─────────────────────────
  const em = await call('POST', `/nfse/entries/${ePJ.id}`, as({ body: {} }));
  ok('nota autorizada na prefeitura (simulada) com número e código', em.status === 201 && em.data.status === 'AUTHORIZED' && em.data.number && em.data.verificationCode, short(em));
  ok('XML enviado com assinatura digital válida', sil.badSignatures === 0 && sil.calls.includes('GerarNfse'));
  let e = await entry(ePJ.id);
  ok('retenções abatem a conta: falta receber só o líquido (11.262)', e.openAmount === 11262, JSON.stringify(e).slice(0, 200));
  const pays = (await call('GET', `/financial/entries/${ePJ.id}/payments`, as())).data;
  ok('retenção registrada sem entrada de dinheiro (fluxo de caixa usa o líquido)', pays.length === 1 && pays[0].source === 'RETENTION' && Number(pays[0].total) === 0 && Number(pays[0].principal) === 738, JSON.stringify(pays));
  const dup = await call('POST', `/nfse/entries/${ePJ.id}`, as({ body: {} }));
  ok('segunda nota para a mesma conta é recusada', dup.status === 400, short(dup));
  const xml = await fetch(B + em.data.xmlDownloadUrl);
  const xmlText = await xml.text();
  ok('XML da nota guardado e baixável (link assinado)', xml.status === 200 && xmlText.includes('<CompNfse>') && xmlText.includes(em.data.number), xmlText.slice(0, 120));
  const pdf = await fetch(B + em.data.pdfDownloadUrl);
  const pdfBuf = Buffer.from(await pdf.arrayBuffer());
  ok('PDF da nota guardado e baixável', pdf.status === 200 && pdfBuf.slice(0, 4).toString() === '%PDF', pdf.status);
  const mail = await call('POST', `/nfse/${em.data.id}/email`, as({ body: {} }));
  ok('envio por e-mail sem SMTP vira erro visível', mail.status >= 400 && /e-mail|SMTP/i.test(mail.raw.message), short(mail));

  // ── 4. Emissão PF de conta já recebida; rejeição e reenvio ─
  const rej = await call('POST', `/nfse/entries/${ePF.id}`, as({ body: { description: 'Intermediação imobiliária REJEITAR (teste)' } }));
  ok('rejeição da prefeitura aparece com o motivo', rej.data.status === 'REJECTED' && /E160/.test(rej.data.rejectionReason), short(rej));
  const retry = await call('POST', `/nfse/${rej.data.id}/retry`, as());
  ok('reenviar depois de corrigir: autorizada com o mesmo RPS', retry.data.status === 'AUTHORIZED' && retry.data.rpsNumber === rej.data.rpsNumber, short(retry));
  ok('tomador PF: sem retenções', Number(retry.data.totalRetained) === 0 && Number(retry.data.netAmount) === 5000, short(retry));
  const retryAgain = await call('POST', `/nfse/${rej.data.id}/retry`, as());
  ok('reenviar nota autorizada é recusado', retryAgain.status === 400, short(retryAgain));

  // ── 5. Cancelamento ─────────────────────────────────────
  const badCode = await call('POST', `/nfse/${em.data.id}/cancel`, as({ body: { reason: 'teste', code: '9' } }));
  ok('código de cancelamento inválido é recusado', badCode.status === 400, short(badCode));
  const cancB = await call('POST', `/nfse/${em.data.id}/cancel`, asB({ body: { reason: 'invasão', code: '1' } }));
  ok('outra imobiliária não cancela a nota', cancB.status === 404, short(cancB));
  const canc = await call('POST', `/nfse/${em.data.id}/cancel`, as({ body: { reason: 'Valor digitado errado', code: '1' } }));
  ok('nota cancelada na prefeitura (pedido assinado)', canc.data.status === 'CANCELLED' && sil.cancelled.has(em.data.number) && sil.badSignatures === 0, short(canc));
  e = await entry(ePJ.id);
  ok('cancelar a nota estorna a retenção: conta volta a 12.000 em aberto', e.openAmount === 12000, JSON.stringify(e).slice(0, 200));
  const canc2 = await call('POST', `/nfse/${em.data.id}/cancel`, as({ body: { reason: 'de novo', code: '1' } }));
  ok('cancelar duas vezes é recusado', canc2.status === 400, short(canc2));

  // ── 6. Lista, relatório do contador ─────────────────────
  const list = await call('GET', '/nfse?limit=50', as());
  ok('lista com situação legível', list.data.items.length === 2 && list.data.items.some((n) => n.statusLabel === 'Cancelada') && list.data.items.some((n) => n.statusLabel === 'Autorizada'), short(list));
  const month = new Date().toISOString().slice(0, 7);
  const rep = await call('GET', `/nfse/report?month=${month}`, as());
  ok('relatório do mês: 1 válida (5.000) e 1 cancelada; estimativa PIS/COFINS', rep.data.totals.count === 1 && rep.data.totals.cancelled === 1 && rep.data.totals.base === 5000 && rep.data.estimate.pis === 32.5 && rep.data.estimate.cofins === 150, short(rep));
  const repX = await call('GET', `/nfse/report/export?month=${month}`, as());
  ok('relatório em Excel', repX.status === 200 && repX.buf?.slice(0, 2).toString() === 'PK', repX.status);

  // ── 7. Autorização de produção ──────────────────────────
  const authBad = await call('POST', '/nfse/config/authorize-production', as({ body: { confirm: 'sim' } }));
  ok('produção exige a frase de confirmação', authBad.status === 400, short(authBad));
  const authOk = await call('POST', '/nfse/config/authorize-production', as({ body: { confirm: 'AUTORIZO NOTAS REAIS' } }));
  ok('dono autoriza notas reais: ambiente produção com o endereço da SIL de Franca', authOk.status === 200 && authOk.data.nfseEnvironment === 'PRODUCTION' && authOk.data.effectiveWsUrl.startsWith('https://franca.siltecnologia.com.br') && authOk.data.productionAuthorizedAt, short(authOk));
  const back = await call('POST', '/nfse/config/back-to-homolog', as());
  ok('volta para homologação a qualquer momento', back.data.nfseEnvironment === 'HOMOLOG' && !back.data.productionAuthorizedAt, short(back));
  const authB = await call('POST', '/nfse/config/authorize-production', asB({ body: { confirm: 'AUTORIZO NOTAS REAIS' } }));
  ok('sem nota de teste autorizada, não libera produção', authB.status === 400 && /homologação/.test(authB.raw.message), short(authB));

  // ── 8. Isolamento ───────────────────────────────────────
  const isoChecks = await Promise.all([
    call('GET', `/nfse/${retry.data.id}`, asB()),
    call('POST', `/nfse/entries/${ePJ.id}/preview`, asB({ body: {} })),
    call('POST', `/nfse/${retry.data.id}/retry`, asB()),
  ]);
  ok('outra imobiliária não vê nem mexe nas notas (404)', isoChecks.every((r) => r.status === 404), isoChecks.map((r) => r.status).join(','));
  ok('lista da outra imobiliária vazia', (await call('GET', '/nfse', asB())).data.items.length === 0);

  // ── 9. Emissão automática ao receber a comissão ─────────
  await call('PATCH', '/nfse/config', as({ body: { autoIssueOnReceipt: true } }));
  const eAuto = (await call('POST', '/financial/entries', as({ body: { type: 'RECEIVABLE', category: 'COMMISSION', description: 'Comissão automática', amount: 3000, dueDate: iso(3), contactId: pf.id } }))).data;
  await call('POST', `/financial/entries/${eAuto.id}/payments`, as({ body: { principal: 3000, method: 'PIX' } }));
  let auto = null;
  for (let i = 0; i < 16 && !(auto && auto.status === 'AUTHORIZED'); i++) {
    await new Promise((r) => setTimeout(r, 5000));
    auto = (await call('GET', `/nfse?entryId=${eAuto.id}`, as())).data.items[0];
  }
  ok('comissão recebida → nota emitida sozinha pela fila', auto?.status === 'AUTHORIZED' && auto.autoIssued === true, JSON.stringify(auto).slice(0, 200));
} finally {
  server.close();
}

let fail = 0;
for (const [c, n, e] of results) { if (!c) fail++; console.log(c ? 'OK  ' : 'FAIL', n, c ? '' : '→ ' + e); }
console.log(`\n${results.length - fail}/${results.length} verificações passaram`);
process.exit(fail ? 1 : 0);
