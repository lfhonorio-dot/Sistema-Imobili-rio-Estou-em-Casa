// Simuladores locais usados pelos roteiros da Fase 8. Nada sai para a internet:
//   - Asaas (boleto/PIX)            → http://127.0.0.1:3999
//   - SIL / prefeitura (NFS-e)      → http://127.0.0.1:3998  (confere a assinatura digital do XML)
//   - Servidor de e-mail (SMTP)     → 127.0.0.1:2525         (guarda os e-mails para o teste ler)
import http from 'node:http';
import net from 'node:net';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

export const ASAAS_KEY = 'chave-asaas-teste';

export async function startAsaas(port = 3999) {
  const state = { payments: new Map(), deleted: [], calls: [] };
  let seq = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      state.calls.push(`${req.method} ${req.url}`);
      const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.headers.access_token !== ASAAS_KEY) return send(401, { errors: [{ description: 'Chave de API inválida' }] });
      const u = new URL(req.url, 'http://x');
      if (req.method === 'GET' && u.pathname === '/customers') return send(200, { data: [] });
      if (req.method === 'POST' && u.pathname === '/customers') return send(200, { id: 'cus_' + (++seq) });
      if (req.method === 'POST' && u.pathname === '/payments') {
        const p = JSON.parse(body);
        const id = 'pay_' + (++seq);
        state.payments.set(id, p);
        return send(200, { id, status: 'PENDING', bankSlipUrl: p.billingType === 'BOLETO' ? `https://asaas.test/b/${id}.pdf` : null, invoiceUrl: `https://asaas.test/i/${id}`, nossoNumero: 'NN' + seq });
      }
      let m = u.pathname.match(/^\/payments\/([^/]+)\/identificationField$/);
      if (m) return send(200, { identificationField: '34191.79001 01043.510047 91020.150008 1 ' + m[1], barCode: '3419' + m[1] });
      m = u.pathname.match(/^\/payments\/([^/]+)\/pixQrCode$/);
      if (m) return send(200, { encodedImage: 'iVBORw0KGgo=', payload: '00020126580014br.gov.bcb.pix0136' + m[1] });
      m = u.pathname.match(/^\/payments\/([^/]+)$/);
      if (m && req.method === 'DELETE') {
        if (!state.payments.has(m[1])) return send(404, { errors: [{ description: 'Cobrança não encontrada' }] });
        state.deleted.push(m[1]);
        return send(200, { deleted: true, id: m[1] });
      }
      send(404, { errors: [{ description: 'rota simulada inexistente' }] });
    });
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { ...state, state, close: () => server.close() };
}

// Certificado A1 de TESTE (gerado na hora; não vale fora do teste).
export function makeTestCertificate(cnpj = '12345678000195', password = 'senha123') {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey; cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 864e5); cert.validity.notAfter = new Date(Date.now() + 365 * 864e5);
  cert.setSubject([{ name: 'commonName', value: `IMOBILIARIA TESTE LTDA:${cnpj}` }]); cert.setIssuer([{ name: 'commonName', value: 'AC TESTE' }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const pfx = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' })).getBytes(), 'binary');
  return { pfx, password, certPem: forge.pki.certificateToPem(cert), cnpj };
}

export async function startSil(certPem, port = 3998) {
  const sil = { calls: [], badSignatures: 0, notes: new Map(), cancelled: new Set(), seq: 2026000700 };
  const resp = (op, inner) => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:${op}Response xmlns:ns2="http://nfse.abrasf.org.br"><outputXML>${inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</outputXML></ns2:${op}Response></soap:Body></soap:Envelope>`;
  const comp = (n) => `<CompNfse><Nfse versao="2.04"><InfNfse Id="N${n.numero}"><Numero>${n.numero}</Numero><CodigoVerificacao>CV${n.numero}</CodigoVerificacao><DataEmissao>${new Date().toISOString().slice(0, 19)}</DataEmissao></InfNfse></Nfse></CompNfse>`;
  const msg = (root, code, text) => `<${root}><ListaMensagemRetorno><MensagemRetorno><Codigo>${code}</Codigo><Mensagem>${text}</Mensagem></MensagemRetorno></ListaMensagemRetorno></${root}>`;
  const verify = (xml) => {
    const m = xml.match(/<Signature[\s\S]*?<\/Signature>/);
    if (!m) return false;
    const v = new SignedXml({ publicCert: certPem });
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
        if (!verify(dados)) { sil.badSignatures++; return send(resp(op, msg('GerarNfseResposta', 'E500', 'Assinatura inválida'))); }
        const rps = (dados.match(/<IdentificacaoRps>([\s\S]*?)<\/IdentificacaoRps>/) || [])[1] ?? '';
        const key = (rps.match(/<Numero>(\d+)<\/Numero>/) || [])[1];
        if (sil.notes.has(key)) return send(resp(op, msg('GerarNfseResposta', 'E10', 'RPS já informado')));
        const n = { numero: String(++sil.seq), dados };
        sil.notes.set(key, n);
        return send(resp(op, `<GerarNfseResposta><ListaNfse>${comp(n)}</ListaNfse></GerarNfseResposta>`));
      }
      if (op === 'ConsultarNfsePorRps') {
        const key = (dados.match(/<Numero>(\d+)<\/Numero>/) || [])[1];
        const n = sil.notes.get(key);
        return send(resp(op, n ? `<ConsultarNfseRpsResposta>${comp(n)}</ConsultarNfseRpsResposta>` : msg('ConsultarNfseRpsResposta', 'E92', 'RPS não encontrado')));
      }
      if (op === 'CancelarNfse') {
        if (!verify(dados)) { sil.badSignatures++; return send(resp(op, msg('CancelarNfseResposta', 'E500', 'Assinatura inválida'))); }
        sil.cancelled.add((dados.match(/<Numero>(\d+)<\/Numero>/) || [])[1]);
        return send(resp(op, `<CancelarNfseResposta><RetCancelamento><NfseCancelamento><Confirmacao><DataHora>${new Date().toISOString()}</DataHora></Confirmacao></NfseCancelamento></RetCancelamento></CancelarNfseResposta>`));
      }
      res.writeHead(500); res.end('<soap:Envelope><soap:Body><soap:Fault><faultstring>operacao desconhecida</faultstring></soap:Fault></soap:Body></soap:Envelope>');
    });
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  sil.close = () => server.close();
  return sil;
}

// Servidor de e-mail mínimo: aceita qualquer mensagem e guarda para o teste ler.
export async function startSmtp(port = 2525) {
  const mails = [];
  const decode = (raw) => {
    // junta quoted-printable e base64 o suficiente para achar links e códigos
    let t = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    for (const b of raw.split(/\r?\n\r?\n/)) {
      const c = b.replace(/\s+/g, '');
      if (c.length > 40 && /^[A-Za-z0-9+/=]+$/.test(c)) { try { t += '\n' + Buffer.from(c, 'base64').toString('utf8'); } catch { /* não era base64 */ } }
    }
    return t;
  };
  const server = net.createServer((sock) => {
    let buf = ''; let inData = false; let data = ''; let to = []; let authStep = 0;
    const say = (s) => sock.write(s + '\r\n');
    say('220 simulador ESMTP');
    sock.on('error', () => {});
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      for (;;) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end < 0) return;
          data = buf.slice(0, end); buf = buf.slice(end + 5); inData = false;
          const subject = (data.match(/^Subject: (.*(?:\r?\n[ \t].*)*)/mi) || [])[1] ?? '';
          mails.push({ to: [...to], subject: decodeSubject(subject), raw: data, text: decode(data) });
          to = []; say('250 OK guardado');
          continue;
        }
        const nl = buf.indexOf('\r\n');
        if (nl < 0) return;
        const line = buf.slice(0, nl); buf = buf.slice(nl + 2);
        const cmd = line.toUpperCase();
        if (authStep > 0) { authStep--; say(authStep ? '334 UGFzc3dvcmQ6' : '235 autenticado'); continue; }
        if (cmd.startsWith('EHLO')) { say('250-simulador'); say('250 AUTH PLAIN LOGIN'); }
        else if (cmd.startsWith('HELO')) say('250 simulador');
        else if (cmd.startsWith('AUTH PLAIN')) say('235 autenticado');
        else if (cmd.startsWith('AUTH LOGIN')) { authStep = 2; say('334 VXNlcm5hbWU6'); }
        else if (cmd.startsWith('MAIL FROM')) say('250 OK');
        else if (cmd.startsWith('RCPT TO')) { to.push((line.match(/<([^>]+)>/) || [])[1] ?? line); say('250 OK'); }
        else if (cmd === 'DATA') { inData = true; say('354 pode enviar'); }
        else if (cmd === 'RSET') { to = []; say('250 OK'); }
        else if (cmd === 'QUIT') { say('221 tchau'); sock.end(); }
        else say('250 OK');
      }
    });
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { mails, close: () => server.close(), lastTo: (addr) => [...mails].reverse().find((m) => m.to.includes(addr)) };
}

function decodeSubject(s) {
  return s.replace(/\r?\n[ \t]/g, '').replace(/=\?UTF-8\?([BQ])\?([^?]*)\?=/gi, (_, enc, v) =>
    enc.toUpperCase() === 'B' ? Buffer.from(v, 'base64').toString('utf8')
      : Buffer.from(v.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16))), 'binary').toString('utf8'));
}

// Cliente HTTP dos roteiros.
export function makeClient(base) {
  let ipSeq = 1;
  const call = async (method, path, { token, ws, body, headers: extra } = {}) => {
    // cada chamada vem de um "IP" diferente para o limite por IP não atrapalhar o teste
    const headers = { 'X-Forwarded-For': `10.8.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`, ...(extra ?? {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (ws) headers['X-Workspace-Id'] = ws;
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) });
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return { status: res.status, ct, buf: Buffer.from(await res.arrayBuffer()) };
    const json = await res.json();
    return { status: res.status, data: json?.data ?? json, raw: json };
  };
  return call;
}
