// Fase 6 — interface comum de provedores de NFS-e (mesmo padrão adapter do
// gateway de pagamento). Hoje: SIL Tecnologia (ABRASF 2.04) — Franca-SP.

import type { RpsInput } from './abrasf-xml';
import type { LoadedCertificate } from './xml-signer';

export interface NfseProviderContext {
  environment: 'HOMOLOG' | 'PRODUCTION';
  wsUrl: string;
  soapNamespace: string;
  certificate: LoadedCertificate;
  prestador: { cnpj: string; inscricaoMunicipal: string; codigoMunicipio: string };
}

export type NfseOutcome =
  | { kind: 'AUTHORIZED'; numero: string; codigoVerificacao?: string; dataEmissao?: string; xml: string; requestXml: string }
  | { kind: 'REJECTED'; reason: string; requestXml: string }
  | { kind: 'NOT_FOUND' }
  | { kind: 'TRANSIENT'; reason: string };

export interface NfseProvider {
  readonly name: string;
  /** Emite (síncrono) a NFS-e a partir do RPS. */
  emit(ctx: NfseProviderContext, rps: RpsInput): Promise<NfseOutcome>;
  /** Consulta pelo RPS (para não duplicar depois de uma falha de comunicação). */
  consultByRps(ctx: NfseProviderContext, serie: string, numero: number): Promise<NfseOutcome>;
  /** Cancela na prefeitura. */
  cancel(ctx: NfseProviderContext, numero: string, codigo: string): Promise<{ ok: true; xml: string } | { ok: false; reason: string; transient?: boolean }>;
}

/** Endereços conhecidos do provedor (podem ser trocados na tela de configuração). */
export const SIL_FRANCA_PRODUCTION_URL = 'https://franca.siltecnologia.com.br/services/Abrasf24';
