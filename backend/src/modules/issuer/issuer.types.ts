// Dados da empresa emitente gravados em cada documento no momento da emissão.
// Depois de gravado não muda (trigger no banco): reimprimir, reenviar ou
// exportar um documento antigo mostra a empresa da data em que ele foi emitido.
export interface IssuerSnapshot {
  cnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  inscricaoMunicipal: string | null;
  endereco: string | null;
  regimeTributario: string | null;
  capturedAt: string; // ISO
  legalEntityId?: string | null; // registro do histórico (WorkspaceLegalEntity) de onde veio
  backfill?: boolean; // preenchido pela migration com os dados vigentes naquela data
}

/** Lê com segurança um issuerSnapshot vindo do banco (coluna JSON). */
export function asSnapshot(v: unknown): IssuerSnapshot | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!('cnpj' in o) && !('razaoSocial' in o) && !('nomeFantasia' in o)) return null;
  const s = (k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string) : null);
  return {
    cnpj: s('cnpj'), razaoSocial: s('razaoSocial'), nomeFantasia: s('nomeFantasia'),
    inscricaoMunicipal: s('inscricaoMunicipal'), endereco: s('endereco'), regimeTributario: s('regimeTributario'),
    capturedAt: s('capturedAt') ?? new Date(0).toISOString(),
    legalEntityId: s('legalEntityId'), ...(o.backfill === true && { backfill: true }),
  };
}

/** Nome para exibir em documentos (o mesmo critério usado antes: o nome da imobiliária). */
export function displayName(s: IssuerSnapshot | null | undefined, fallback = ''): string {
  return s?.nomeFantasia || s?.razaoSocial || fallback;
}

/** Nome jurídico para contratos/recibos: razão social (e o nome fantasia entre parênteses, se diferente). */
export function legalName(s: IssuerSnapshot | null | undefined, fallback = ''): string {
  const r = s?.razaoSocial?.trim(); const f = s?.nomeFantasia?.trim();
  if (r && f && r.toLowerCase() !== f.toLowerCase()) return `${r} (${f})`;
  return r || f || fallback;
}

export const onlyDigits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

export function formatCnpj(v: string | null | undefined): string {
  const d = onlyDigits(v);
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (v ?? '');
}
