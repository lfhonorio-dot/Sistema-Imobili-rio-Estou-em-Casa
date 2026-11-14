import { computeNfseTaxes, takerKind } from './nfse-tax';
import { buildCancelPedido, wrapCancelar, buildRps, parseAbrasfResponse, rpsId, soapEnvelope, wrapGerarNfse, type RpsInput } from './abrasf-xml';
import { loadPfx, signElement, verifySignature } from './xml-signer';
import * as forge from 'node-forge';

// Certificado A1 de TESTE (autoassinado), só para os testes automáticos.

function makeTestPfx(password = 'senha-teste', cnpj = '12345678000195'): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const attrs = [{ name: 'commonName', value: `IMOBILIARIA TESTE LTDA:${cnpj}` }, { name: 'countryName', value: 'BR' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary');
}


// Fase 6 — NFS-e: tributos/retenções, XML ABRASF 2.04, assinatura digital.

const cfg = { issRatePct: 2, retentionsEnabled: true, retIrPct: 1.5, retPisPct: 0.65, retCofinsPct: 3, retCsllPct: 1, retMinAmount: 10, retainIssWhenPj: false };

describe('computeNfseTaxes', () => {
  it('tomador pessoa física: sem retenções, líquido = bruto', () => {
    const t = computeNfseTaxes(12000, false, cfg);
    expect(t).toMatchObject({ base: 12000, issDue: 240, totalRetained: 0, netAmount: 12000, issRetained: false });
  });
  it('tomador PJ: retém IR 1,5% e PIS/COFINS/CSLL 4,65%', () => {
    const t = computeNfseTaxes(12000, true, cfg);
    expect(t).toMatchObject({ irRetained: 180, pisRetained: 78, cofinsRetained: 360, csllRetained: 120, totalRetained: 738, netAmount: 11262 });
  });
  it('valores pequenos: dispensa abaixo do mínimo', () => {
    const t = computeNfseTaxes(500, true, cfg); // IR 7,50 < 10; CSRF 23,25 >= 10
    expect(t.irRetained).toBe(0);
    expect(t.pisRetained + t.cofinsRetained + t.csllRetained).toBeCloseTo(23.25);
    const t2 = computeNfseTaxes(200, true, cfg); // CSRF 9,30 < 10
    expect(t2.totalRetained).toBe(0);
  });
  it('ISS retido pelo tomador PJ quando configurado', () => {
    const t = computeNfseTaxes(1000, true, { ...cfg, retentionsEnabled: false, retainIssWhenPj: true });
    expect(t).toMatchObject({ issRetained: true, issRetainedAmount: 20, totalRetained: 20, netAmount: 980 });
  });
  it('alíquota de ISS fora da faixa legal é recusada', () => {
    expect(() => computeNfseTaxes(100, false, { ...cfg, issRatePct: 7 })).toThrow(/ISS/);
  });
  it('tipo do tomador pelo documento', () => {
    expect(takerKind('529.982.247-25')).toBe('PF');
    expect(takerKind('12.345.678/0001-95')).toBe('PJ');
    expect(takerKind('123')).toBeNull();
  });
});

const rps: RpsInput = {
  serie: '1', numero: 42, dataEmissao: '2026-11-14', competencia: '2026-11-14',
  prestador: { cnpj: '12.345.678/0001-95', inscricaoMunicipal: '12345' },
  tomador: { documento: '529.982.247-25', nome: 'Carla & Filhos <Ltda>', email: 'c@t.local', endereco: { logradouro: 'Rua A', numero: '1', bairro: 'Centro', codigoMunicipio: '3516200', uf: 'SP', cep: '14400-000' } },
  servico: { valorServicos: 12000, aliquotaPct: 2, valorIss: 240, issRetido: false, valorPis: 0, valorCofins: 0, valorIr: 0, valorCsll: 0,
    itemListaServico: '10.05', discriminacao: 'Intermediação na venda do imóvel X', codigoMunicipio: '3516200', exigibilidadeIss: 1 },
  optanteSimples: false, incentivoFiscal: false,
};

describe('XML ABRASF 2.04', () => {
  it('monta o RPS com valores, prestador, tomador e escapa caracteres especiais', () => {
    const x = buildRps(rps);
    expect(x).toContain(`Id="${rpsId('1', 42)}"`);
    expect(x).toContain('<ValorServicos>12000.00</ValorServicos>');
    expect(x).toContain('<IssRetido>2</IssRetido>');
    expect(x).toContain('<Cnpj>12345678000195</Cnpj>');
    expect(x).toContain('<Cpf>52998224725</Cpf>');
    expect(x).toContain('Carla &amp; Filhos &lt;Ltda&gt;');
    expect(x).toContain('<Cep>14400000</Cep>');
    expect(x).not.toContain('<ValorIr>');
  });

  it('assina o RPS com o certificado A1 e a assinatura confere', () => {
    const cert = loadPfx(makeTestPfx('abc'), 'abc');
    expect(cert.cnpj).toBe('12345678000195');
    const signed = signElement(wrapGerarNfse(buildRps(rps)), 'InfDeclaracaoPrestacaoServico', cert);
    expect(signed).toMatch(/<\/InfDeclaracaoPrestacaoServico><Signature/);
    expect(signed).toContain(`URI="#${rpsId('1', 42)}"`);
    expect(signed).toContain('<X509Certificate>');
    expect(verifySignature(signed, cert.certificatePem)).toBe(true);
    // adulterar o valor invalida a assinatura
    expect(verifySignature(signed.replace('12000.00', '1.00'), cert.certificatePem)).toBe(false);
  });

  it('senha errada do certificado dá mensagem clara', () => {
    expect(() => loadPfx(makeTestPfx('certa'), 'errada')).toThrow(/Senha do certificado/);
    expect(() => loadPfx(Buffer.from('nao e pfx'), 'x')).toThrow(/inválido/);
  });

  it('pedido de cancelamento assinado', () => {
    const cert = loadPfx(makeTestPfx('abc'), 'abc');
    const signed = signElement(wrapCancelar(buildCancelPedido('2026000001', '12345678000195', '12345', '3516200', '1')), 'InfPedidoCancelamento', cert);
    expect(signed).toMatch(/^<CancelarNfseEnvio xmlns=/);
    expect(verifySignature(signed, cert.certificatePem)).toBe(true);
  });

  it('envelope SOAP com cabeçalho e dados em CDATA', () => {
    const env = soapEnvelope('http://nfse.abrasf.org.br', 'GerarNfse', '<x/>');
    expect(env).toContain('<nfse:GerarNfseRequest>');
    expect(env).toContain('<nfseDadosMsg><![CDATA[<x/>]]></nfseDadosMsg>');
    expect(env).toContain('<versaoDados>2.04</versaoDados>');
  });
});

describe('respostas da prefeitura', () => {
  const wrap = (inner: string) => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:GerarNfseResponse xmlns:ns2="http://nfse.abrasf.org.br"><outputXML>${inner.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</outputXML></ns2:GerarNfseResponse></soap:Body></soap:Envelope>`;

  it('nota autorizada: número e código de verificação', () => {
    const r = parseAbrasfResponse(wrap('<GerarNfseResposta xmlns="http://www.abrasf.org.br/nfse.xsd"><ListaNfse><CompNfse><Nfse versao="2.04"><InfNfse Id="n1"><Numero>2026000123</Numero><CodigoVerificacao>AB12CD</CodigoVerificacao><DataEmissao>2026-11-14T10:00:00</DataEmissao></InfNfse></Nfse></CompNfse></ListaNfse></GerarNfseResposta>'));
    expect(r.messages).toEqual([]);
    expect(r.nfse).toMatchObject({ numero: '2026000123', codigoVerificacao: 'AB12CD' });
    expect(r.nfse!.xml).toMatch(/^<CompNfse>/);
  });

  it('rejeição: mensagens com código e correção', () => {
    const r = parseAbrasfResponse(wrap('<GerarNfseResposta><ListaMensagemRetorno><MensagemRetorno><Codigo>E160</Codigo><Mensagem>Inscrição municipal inválida</Mensagem><Correcao>Confira a IM</Correcao></MensagemRetorno></ListaMensagemRetorno></GerarNfseResposta>'));
    expect(r.nfse).toBeUndefined();
    expect(r.messages).toEqual([{ codigo: 'E160', mensagem: 'Inscrição municipal inválida', correcao: 'Confira a IM' }]);
  });

  it('erro SOAP (fault)', () => {
    const r = parseAbrasfResponse('<soap:Envelope xmlns:soap="x"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>Assinatura inválida</faultstring></soap:Fault></soap:Body></soap:Envelope>');
    expect(r.fault).toBe('Assinatura inválida');
  });

  it('cancelamento confirmado', () => {
    const r = parseAbrasfResponse(wrap('<CancelarNfseResposta><RetCancelamento><NfseCancelamento><Confirmacao><DataHora>2026-11-14T10:00:00</DataHora></Confirmacao></NfseCancelamento></RetCancelamento></CancelarNfseResposta>'));
    expect(r.cancelled).toBe(true);
  });
});
