// Fase 6 — XML do padrão ABRASF 2.04 (funções puras): montagem das
// mensagens GerarNfse, ConsultarNfsePorRps e CancelarNfse, envelope SOAP e
// leitura das respostas da prefeitura.

import { XMLParser } from 'fast-xml-parser';

export const ABRASF_NS = 'http://www.abrasf.org.br/nfse.xsd';
export const ABRASF_VERSION = '2.04';

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const tag = (name: string, value: unknown) => (value === undefined || value === null || value === '' ? '' : `<${name}>${esc(value)}</${name}>`);
const money = (v: number) => v.toFixed(2);
const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');
const cpfCnpj = (doc: string) => {
  const d = digits(doc);
  return `<CpfCnpj>${d.length === 14 ? `<Cnpj>${d}</Cnpj>` : `<Cpf>${d}</Cpf>`}</CpfCnpj>`;
};

export interface RpsInput {
  serie: string;
  numero: number;
  dataEmissao: string; // AAAA-MM-DD
  competencia: string; // AAAA-MM-DD
  prestador: { cnpj: string; inscricaoMunicipal: string };
  tomador: {
    documento: string;
    nome: string;
    inscricaoMunicipal?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco?: {
      logradouro?: string | null; numero?: string | null; complemento?: string | null; bairro?: string | null;
      codigoMunicipio: string; uf?: string | null; cep?: string | null;
    } | null;
  };
  servico: {
    valorServicos: number;
    aliquotaPct: number;
    valorIss: number;
    issRetido: boolean;
    valorPis: number; valorCofins: number; valorIr: number; valorCsll: number;
    itemListaServico: string;
    codigoCnae?: string | null;
    codigoTributacaoMunicipio?: string | null;
    discriminacao: string;
    codigoMunicipio: string;
    exigibilidadeIss: number;
  };
  regimeEspecialTributacao?: number | null;
  optanteSimples: boolean;
  incentivoFiscal: boolean;
}

/** Id do elemento assinado (referência da assinatura digital). */
export const rpsId = (serie: string, numero: number) => `RPS${digits(serie) || 'S'}${numero}`;

/** InfDeclaracaoPrestacaoServico dentro de <Rps> (a assinatura entra depois). */
export function buildRps(i: RpsInput): string {
  const s = i.servico;
  const t = i.tomador;
  const tomDoc = digits(t.documento);
  const end = t.endereco;
  const endereco = end && end.codigoMunicipio
    ? `<Endereco>${tag('Endereco', end.logradouro)}${tag('Numero', end.numero)}${tag('Complemento', end.complemento)}${tag('Bairro', end.bairro)}`
      + `${tag('CodigoMunicipio', end.codigoMunicipio)}${tag('Uf', end.uf)}${tag('Cep', digits(end.cep))}</Endereco>`
    : '';
  const contato = t.email || t.telefone ? `<Contato>${tag('Telefone', digits(t.telefone))}${tag('Email', t.email)}</Contato>` : '';
  return `<Rps><InfDeclaracaoPrestacaoServico Id="${rpsId(i.serie, i.numero)}">`
    + `<Rps><IdentificacaoRps><Numero>${i.numero}</Numero><Serie>${esc(i.serie)}</Serie><Tipo>1</Tipo></IdentificacaoRps>`
    + `<DataEmissao>${i.dataEmissao}</DataEmissao><Status>1</Status></Rps>`
    + `<Competencia>${i.competencia}</Competencia>`
    + `<Servico><Valores><ValorServicos>${money(s.valorServicos)}</ValorServicos>`
    + (s.valorPis ? `<ValorPis>${money(s.valorPis)}</ValorPis>` : '')
    + (s.valorCofins ? `<ValorCofins>${money(s.valorCofins)}</ValorCofins>` : '')
    + (s.valorIr ? `<ValorIr>${money(s.valorIr)}</ValorIr>` : '')
    + (s.valorCsll ? `<ValorCsll>${money(s.valorCsll)}</ValorCsll>` : '')
    + `<ValorIss>${money(s.valorIss)}</ValorIss><Aliquota>${s.aliquotaPct.toFixed(2)}</Aliquota></Valores>`
    + `<IssRetido>${s.issRetido ? 1 : 2}</IssRetido>${s.issRetido ? '<ResponsavelRetencao>1</ResponsavelRetencao>' : ''}`
    + `${tag('ItemListaServico', s.itemListaServico)}${tag('CodigoCnae', digits(s.codigoCnae))}${tag('CodigoTributacaoMunicipio', s.codigoTributacaoMunicipio)}`
    + `${tag('Discriminacao', s.discriminacao)}<CodigoMunicipio>${s.codigoMunicipio}</CodigoMunicipio>`
    + `<ExigibilidadeISS>${s.exigibilidadeIss}</ExigibilidadeISS><MunicipioIncidencia>${s.codigoMunicipio}</MunicipioIncidencia></Servico>`
    + `<Prestador>${cpfCnpj(i.prestador.cnpj)}<InscricaoMunicipal>${esc(digits(i.prestador.inscricaoMunicipal) || i.prestador.inscricaoMunicipal)}</InscricaoMunicipal></Prestador>`
    + `<TomadorServico><IdentificacaoTomador>${cpfCnpj(tomDoc)}${tag('InscricaoMunicipal', t.inscricaoMunicipal)}</IdentificacaoTomador>`
    + `${tag('RazaoSocial', t.nome)}${endereco}${contato}</TomadorServico>`
    + (i.regimeEspecialTributacao ? `<RegimeEspecialTributacao>${i.regimeEspecialTributacao}</RegimeEspecialTributacao>` : '')
    + `<OptanteSimplesNacional>${i.optanteSimples ? 1 : 2}</OptanteSimplesNacional><IncentivoFiscal>${i.incentivoFiscal ? 1 : 2}</IncentivoFiscal>`
    + `</InfDeclaracaoPrestacaoServico></Rps>`;
}

export const wrapGerarNfse = (signedRps: string) => `<GerarNfseEnvio xmlns="${ABRASF_NS}">${signedRps}</GerarNfseEnvio>`;

export function buildConsultaRps(serie: string, numero: number, cnpj: string, im: string): string {
  return `<ConsultarNfseRpsEnvio xmlns="${ABRASF_NS}"><IdentificacaoRps><Numero>${numero}</Numero><Serie>${esc(serie)}</Serie><Tipo>1</Tipo></IdentificacaoRps>`
    + `<Prestador>${cpfCnpj(cnpj)}<InscricaoMunicipal>${esc(digits(im) || im)}</InscricaoMunicipal></Prestador></ConsultarNfseRpsEnvio>`;
}

export const cancelId = (numero: string) => `CANC${digits(numero) || numero}`;

/** Pedido de cancelamento (InfPedidoCancelamento é assinado). */
export function buildCancelPedido(numero: string, cnpj: string, im: string, codigoMunicipio: string, codigo: string): string {
  return `<Pedido><InfPedidoCancelamento Id="${cancelId(numero)}"><IdentificacaoNfse><Numero>${esc(numero)}</Numero>${cpfCnpj(cnpj)}`
    + `<InscricaoMunicipal>${esc(digits(im) || im)}</InscricaoMunicipal><CodigoMunicipio>${codigoMunicipio}</CodigoMunicipio></IdentificacaoNfse>`
    + `<CodigoCancelamento>${esc(codigo)}</CodigoCancelamento></InfPedidoCancelamento></Pedido>`;
}

export const wrapCancelar = (signedPedido: string) => `<CancelarNfseEnvio xmlns="${ABRASF_NS}">${signedPedido}</CancelarNfseEnvio>`;

export const cabecalho = () => `<cabecalho xmlns="${ABRASF_NS}" versao="${ABRASF_VERSION}"><versaoDados>${ABRASF_VERSION}</versaoDados></cabecalho>`;

/** Envelope SOAP 1.1 no formato do WSDL oficial ABRASF 2.04 (nfseCabecMsg + nfseDadosMsg). */
export function soapEnvelope(serviceNs: string, operation: string, dados: string): string {
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfse="${serviceNs}">`
    + `<soapenv:Header/><soapenv:Body><nfse:${operation}Request>`
    + `<nfseCabecMsg><![CDATA[${cabecalho()}]]></nfseCabecMsg><nfseDadosMsg><![CDATA[${dados}]]></nfseDadosMsg>`
    + `</nfse:${operation}Request></soapenv:Body></soapenv:Envelope>`;
}

// ── Respostas ──────────────────────────────────────────────

export interface AbrasfMessage { codigo: string; mensagem: string; correcao?: string }
export interface AbrasfResult {
  messages: AbrasfMessage[];
  nfse?: { numero: string; codigoVerificacao?: string; dataEmissao?: string; xml: string };
  cancelled?: boolean;
  fault?: string;
}

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, trimValues: true });
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function unescapeXml(s: string) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Tira o XML de negócio de dentro do envelope SOAP (outputXML escapado ou XML direto). */
export function extractPayload(soap: string): string {
  const out = soap.match(/<(?:\w+:)?(?:outputXML|return|\w+Result)[^>]*>([\s\S]*?)<\/(?:\w+:)?(?:outputXML|return|\w+Result)>/);
  if (out) {
    const inner = out[1].trim();
    const cdata = inner.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
    return cdata ? cdata[1] : inner.startsWith('&lt;') ? unescapeXml(inner) : inner;
  }
  const body = soap.match(/<(?:\w+:)?Body[^>]*>([\s\S]*)<\/(?:\w+:)?Body>/);
  return body ? body[1] : soap;
}

function findKey(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  if (key in (obj as Record<string, unknown>)) return (obj as Record<string, unknown>)[key];
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const f = findKey(v, key);
    if (f !== undefined) return f;
  }
  return undefined;
}

export function parseAbrasfResponse(soap: string): AbrasfResult {
  const fault = soap.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/);
  if (fault) return { messages: [], fault: unescapeXml(fault[1].trim()) };
  const payload = extractPayload(soap);
  const doc = parser.parse(payload);
  const messages: AbrasfMessage[] = [];
  for (const listKey of ['ListaMensagemRetorno', 'ListaMensagemRetornoLote', 'ListaMensagemAlertaRetorno']) {
    const list = findKey(doc, listKey) as { MensagemRetorno?: unknown } | undefined;
    if (listKey === 'ListaMensagemAlertaRetorno') continue; // alertas não impedem a emissão
    for (const m of arr(list?.MensagemRetorno as Record<string, string> | Record<string, string>[] | undefined)) {
      messages.push({ codigo: String(m.Codigo ?? ''), mensagem: String(m.Mensagem ?? ''), correcao: m.Correcao ? String(m.Correcao) : undefined });
    }
  }
  const result: AbrasfResult = { messages };
  const inf = findKey(doc, 'InfNfse') as Record<string, unknown> | undefined;
  if (inf && inf.Numero) {
    const compXml = payload.match(/<(?:\w+:)?CompNfse[\s\S]*<\/(?:\w+:)?CompNfse>/);
    result.nfse = {
      numero: String(inf.Numero),
      codigoVerificacao: inf.CodigoVerificacao ? String(inf.CodigoVerificacao) : undefined,
      dataEmissao: inf.DataEmissao ? String(inf.DataEmissao) : undefined,
      xml: compXml ? compXml[0] : payload,
    };
  }
  if (findKey(doc, 'RetCancelamento') !== undefined || findKey(doc, 'NfseCancelamento') !== undefined) result.cancelled = true;
  return result;
}

/** Mensagens da prefeitura em texto para o usuário. */
export const formatMessages = (ms: AbrasfMessage[]) =>
  ms.map((m) => `${m.codigo ? `[${m.codigo}] ` : ''}${m.mensagem}${m.correcao ? ` — ${m.correcao}` : ''}`).join(' | ');
