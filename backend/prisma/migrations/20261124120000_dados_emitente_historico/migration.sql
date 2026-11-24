-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "issuerSnapshot" JSONB;

-- AlterTable
ALTER TABLE "commissions" ADD COLUMN     "issuerSnapshot" JSONB;

-- AlterTable
ALTER TABLE "signature_envelopes" ADD COLUMN     "documentHtml" TEXT,
ADD COLUMN     "issuerSnapshot" JSONB;

-- AlterTable
ALTER TABLE "payment_gateway_configs" ADD COLUMN     "legalEntityId" TEXT;

-- AlterTable
ALTER TABLE "boletos" ADD COLUMN     "issuerSnapshot" JSONB;

-- AlterTable
ALTER TABLE "nfse_records" ADD COLUMN     "issuerSnapshot" JSONB;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "issuerSnapshot" JSONB;

-- CreateTable
CREATE TABLE "workspace_legal_entities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "cnpj" TEXT,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "inscricaoMunicipal" TEXT,
    "endereco" TEXT,
    "regimeTributario" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdBy" TEXT,
    "nfseCertPfxEnc" TEXT,
    "nfseCertPasswordEnc" TEXT,
    "nfseCertSubject" TEXT,
    "nfseCertValidUntil" TIMESTAMP(3),
    "nfseRpsSerie" TEXT,
    "nfseRpsNextNumber" INTEGER,
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workspace_legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_legal_entities_workspaceId_validFrom_idx" ON "workspace_legal_entities"("workspaceId", "validFrom");

-- AddForeignKey
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "workspace_legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_legal_entities" ADD CONSTRAINT "workspace_legal_entities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══════════════════════════════════════════════════════════════
-- Dados (somente aditivo): histórico da empresa + cópia do emitente
-- ═══════════════════════════════════════════════════════════════

-- Só um registro vigente (validTo nulo) por imobiliária.
CREATE UNIQUE INDEX "workspace_legal_entities_one_current"
  ON "workspace_legal_entities"("workspaceId")
  WHERE "validTo" IS NULL AND "deletedAt" IS NULL;

-- 1) Registro vigente inicial de cada imobiliária, a partir do cadastro atual.
--    CNPJ: o da configuração fiscal (usado na NFS-e) tem precedência sobre o do workspace.
INSERT INTO "workspace_legal_entities"
  ("id", "workspaceId", "cnpj", "razaoSocial", "nomeFantasia", "inscricaoMunicipal",
   "endereco", "regimeTributario", "validFrom", "checklist", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, w."id",
       NULLIF(regexp_replace(COALESCE(NULLIF(t."cnpj", ''), w."cnpj", ''), '\D', '', 'g'), ''),
       NULLIF(t."razaoSocial", ''), w."name", NULLIF(t."inscricaoMunicipal", ''),
       NULLIF(w."address", ''), t."regime", w."createdAt", '{}', NOW(), NOW()
FROM "workspaces" w
LEFT JOIN "tax_configs" t ON t."workspaceId" = w."id"
WHERE NOT EXISTS (SELECT 1 FROM "workspace_legal_entities" e WHERE e."workspaceId" = w."id");

-- Contas de gateway já cadastradas pertencem ao CNPJ vigente.
UPDATE "payment_gateway_configs" g SET "legalEntityId" = e."id"
FROM "workspace_legal_entities" e
WHERE e."workspaceId" = g."workspaceId" AND e."validTo" IS NULL AND g."legalEntityId" IS NULL;

-- 2) Backfill da cópia do emitente nos documentos já existentes, com os dados
--    atuais (não há histórico anterior a esta migration). Marcados "backfill": true.
CREATE TEMP TABLE "_issuer_bf" AS
SELECT e."workspaceId", e."id" AS "legalEntityId",
       jsonb_build_object(
         'cnpj', e."cnpj", 'razaoSocial', e."razaoSocial", 'nomeFantasia', e."nomeFantasia",
         'inscricaoMunicipal', e."inscricaoMunicipal", 'endereco', e."endereco",
         'regimeTributario', e."regimeTributario", 'legalEntityId', e."id",
         'capturedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
         'backfill', true
       ) AS "snap"
FROM "workspace_legal_entities" e
WHERE e."validTo" IS NULL AND e."deletedAt" IS NULL;

-- Contratos: só os já "emitidos" (fora de rascunho ou com envelope de assinatura).
-- Rascunho sem envelope ainda não foi emitido: continua lendo o cadastro atual.
UPDATE "contracts" c SET "issuerSnapshot" = b."snap"
FROM "_issuer_bf" b
WHERE b."workspaceId" = c."workspaceId" AND c."issuerSnapshot" IS NULL
  AND (c."status" <> 'DRAFT' OR EXISTS (SELECT 1 FROM "signature_envelopes" s WHERE s."contractId" = c."id"));

UPDATE "signature_envelopes" x SET "issuerSnapshot" = b."snap"
FROM "_issuer_bf" b WHERE b."workspaceId" = x."workspaceId" AND x."issuerSnapshot" IS NULL;

-- NFS-e: mantém o CNPJ que de fato foi para a prefeitura (issuerCnpj) quando houver.
UPDATE "nfse_records" x SET "issuerSnapshot" =
  b."snap" || CASE WHEN NULLIF(x."issuerCnpj", '') IS NOT NULL
                   THEN jsonb_build_object('cnpj', regexp_replace(x."issuerCnpj", '\D', '', 'g'))
                   ELSE '{}'::jsonb END
FROM "_issuer_bf" b WHERE b."workspaceId" = x."workspaceId" AND x."issuerSnapshot" IS NULL;

UPDATE "boletos" x SET "issuerSnapshot" = b."snap"
FROM "_issuer_bf" b WHERE b."workspaceId" = x."workspaceId" AND x."issuerSnapshot" IS NULL;

UPDATE "commissions" x SET "issuerSnapshot" = b."snap"
FROM "_issuer_bf" b WHERE b."workspaceId" = x."workspaceId" AND x."issuerSnapshot" IS NULL;

UPDATE "proposals" x SET "issuerSnapshot" = b."snap"
FROM "_issuer_bf" b WHERE b."workspaceId" = x."workspaceId" AND x."issuerSnapshot" IS NULL;

-- Registro do backfill na auditoria (um por imobiliária, com as contagens).
INSERT INTO "audit_logs" ("id", "workspaceId", "action", "entity", "entityId", "after", "createdAt")
SELECT gen_random_uuid()::text, b."workspaceId", 'ISSUER_SNAPSHOT_BACKFILL', 'IssuerSnapshot', b."legalEntityId",
       jsonb_build_object(
         'origem', 'migration 20261124120000_dados_emitente_historico',
         'observacao', 'Cópia do emitente preenchida com os dados cadastrais vigentes na data da migration',
         'contratos', (SELECT count(*) FROM "contracts" c WHERE c."workspaceId" = b."workspaceId" AND c."issuerSnapshot" @> '{"backfill": true}'),
         'envelopes', (SELECT count(*) FROM "signature_envelopes" x WHERE x."workspaceId" = b."workspaceId" AND x."issuerSnapshot" @> '{"backfill": true}'),
         'nfse', (SELECT count(*) FROM "nfse_records" x WHERE x."workspaceId" = b."workspaceId" AND x."issuerSnapshot" @> '{"backfill": true}'),
         'cobrancas', (SELECT count(*) FROM "boletos" x WHERE x."workspaceId" = b."workspaceId" AND x."issuerSnapshot" @> '{"backfill": true}'),
         'comissoes', (SELECT count(*) FROM "commissions" x WHERE x."workspaceId" = b."workspaceId" AND x."issuerSnapshot" @> '{"backfill": true}'),
         'propostas', (SELECT count(*) FROM "proposals" x WHERE x."workspaceId" = b."workspaceId" AND x."issuerSnapshot" @> '{"backfill": true}')
       ), NOW()
FROM "_issuer_bf" b;

DROP TABLE "_issuer_bf";

-- 3) Imutabilidade: depois de gravada, a cópia do emitente (e o texto congelado
--    do envelope) não pode mudar — nem por API, nem por script.
CREATE OR REPLACE FUNCTION "issuer_snapshot_immutable"() RETURNS trigger AS $$
BEGIN
  IF OLD."issuerSnapshot" IS NOT NULL AND NEW."issuerSnapshot" IS DISTINCT FROM OLD."issuerSnapshot" THEN
    RAISE EXCEPTION 'issuerSnapshot é imutável depois de emitido (%.%)', TG_TABLE_NAME, OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "envelope_document_immutable"() RETURNS trigger AS $$
BEGIN
  IF OLD."documentHtml" IS NOT NULL AND NEW."documentHtml" IS DISTINCT FROM OLD."documentHtml" THEN
    RAISE EXCEPTION 'documentHtml do envelope é imutável (%)', OLD."id" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "contracts_issuer_snapshot_immutable" BEFORE UPDATE ON "contracts"
  FOR EACH ROW EXECUTE FUNCTION "issuer_snapshot_immutable"();
CREATE TRIGGER "signature_envelopes_issuer_snapshot_immutable" BEFORE UPDATE ON "signature_envelopes"
  FOR EACH ROW EXECUTE FUNCTION "issuer_snapshot_immutable"();
CREATE TRIGGER "signature_envelopes_document_immutable" BEFORE UPDATE ON "signature_envelopes"
  FOR EACH ROW EXECUTE FUNCTION "envelope_document_immutable"();
CREATE TRIGGER "nfse_records_issuer_snapshot_immutable" BEFORE UPDATE ON "nfse_records"
  FOR EACH ROW EXECUTE FUNCTION "issuer_snapshot_immutable"();
CREATE TRIGGER "boletos_issuer_snapshot_immutable" BEFORE UPDATE ON "boletos"
  FOR EACH ROW EXECUTE FUNCTION "issuer_snapshot_immutable"();
CREATE TRIGGER "commissions_issuer_snapshot_immutable" BEFORE UPDATE ON "commissions"
  FOR EACH ROW EXECUTE FUNCTION "issuer_snapshot_immutable"();
CREATE TRIGGER "proposals_issuer_snapshot_immutable" BEFORE UPDATE ON "proposals"
  FOR EACH ROW EXECUTE FUNCTION "issuer_snapshot_immutable"();
