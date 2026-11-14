// Fase 6 — provedor SIL Tecnologia, padrão ABRASF 2.04 (Prefeitura de Franca).
// Integração direta com o webservice SOAP da SIL, autorizada pelo dono.
// Erros de comunicação (rede, tempo, HTTP 5xx) são TRANSIENT (a fila tenta de
// novo); mensagens de negócio da prefeitura são REJECTED (com o motivo).

import { Injectable, Logger } from '@nestjs/common';
import {
  buildCancelPedido, buildConsultaRps, buildRps, formatMessages, parseAbrasfResponse, soapEnvelope, wrapCancelar, wrapGerarNfse,
  type RpsInput,
} from './abrasf-xml';
import { signElement } from './xml-signer';
import type { NfseOutcome, NfseProvider, NfseProviderContext } from './nfse-provider';

// Códigos ABRASF de "RPS já convertido em NFS-e" — nesse caso consultamos a nota existente.
const ALREADY_ISSUED = /E10\b|L018|já (foi )?(convertido|informado|utilizado)|duplicidade/i;

@Injectable()
export class SilAbrasf24Provider implements NfseProvider {
  readonly name = 'SIL_ABRASF24';
  private readonly logger = new Logger(SilAbrasf24Provider.name);

  private async call(ctx: NfseProviderContext, operation: string, dados: string): Promise<{ ok: true; body: string } | { ok: false; reason: string }> {
    const envelope = soapEnvelope(ctx.soapNamespace, operation, dados);
    let res: Response;
    try {
      res = await fetch(ctx.wsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${ctx.soapNamespace.replace(/\/$/, '')}/${operation}"`,
        },
        body: envelope,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      const cause = (err as { cause?: { code?: string } }).cause?.code ?? (err as Error).name;
      this.logger.warn(`SIL ${operation}: sem resposta (${cause})`);
      return { ok: false, reason: `Sem resposta da prefeitura (${cause}).` };
    }
    const body = await res.text().catch(() => '');
    if (res.status >= 500 && !/faultstring|outputXML|Resposta/i.test(body)) {
      return { ok: false, reason: `Prefeitura respondeu HTTP ${res.status}.` };
    }
    if (res.status >= 400 && !body) return { ok: false, reason: `Prefeitura respondeu HTTP ${res.status}.` };
    return { ok: true, body };
  }

  async emit(ctx: NfseProviderContext, rps: RpsInput): Promise<NfseOutcome> {
    const requestXml = signElement(wrapGerarNfse(buildRps(rps)), 'InfDeclaracaoPrestacaoServico', ctx.certificate);
    const r = await this.call(ctx, 'GerarNfse', requestXml);
    if (!r.ok) return { kind: 'TRANSIENT', reason: r.reason };
    const parsed = parseAbrasfResponse(r.body);
    if (parsed.fault) return { kind: 'REJECTED', reason: `Webservice: ${parsed.fault}`, requestXml };
    if (parsed.nfse) return { kind: 'AUTHORIZED', ...parsed.nfse, requestXml };
    if (parsed.messages.length) {
      if (parsed.messages.some((m) => ALREADY_ISSUED.test(`${m.codigo} ${m.mensagem}`))) {
        const found = await this.consultByRps(ctx, rps.serie, rps.numero);
        if (found.kind === 'AUTHORIZED') return { ...found, requestXml };
      }
      return { kind: 'REJECTED', reason: formatMessages(parsed.messages), requestXml };
    }
    return { kind: 'TRANSIENT', reason: 'Resposta da prefeitura sem nota e sem mensagem de erro.' };
  }

  async consultByRps(ctx: NfseProviderContext, serie: string, numero: number): Promise<NfseOutcome> {
    const r = await this.call(ctx, 'ConsultarNfsePorRps', buildConsultaRps(serie, numero, ctx.prestador.cnpj, ctx.prestador.inscricaoMunicipal));
    if (!r.ok) return { kind: 'TRANSIENT', reason: r.reason };
    const parsed = parseAbrasfResponse(r.body);
    if (parsed.nfse) return { kind: 'AUTHORIZED', ...parsed.nfse, requestXml: '' };
    return { kind: 'NOT_FOUND' };
  }

  async cancel(ctx: NfseProviderContext, numero: string, codigo: string) {
    // assina já dentro do envelope final (o namespace entra na canonicalização)
    const pedido = signElement(
      wrapCancelar(buildCancelPedido(numero, ctx.prestador.cnpj, ctx.prestador.inscricaoMunicipal, ctx.prestador.codigoMunicipio, codigo)),
      'InfPedidoCancelamento', ctx.certificate,
    );
    const r = await this.call(ctx, 'CancelarNfse', pedido);
    if (!r.ok) return { ok: false as const, reason: r.reason, transient: true };
    const parsed = parseAbrasfResponse(r.body);
    if (parsed.fault) return { ok: false as const, reason: `Webservice: ${parsed.fault}` };
    if (parsed.cancelled) return { ok: true as const, xml: r.body };
    if (parsed.messages.length) return { ok: false as const, reason: formatMessages(parsed.messages) };
    return { ok: false as const, reason: 'A prefeitura não confirmou o cancelamento.', transient: true };
  }
}
