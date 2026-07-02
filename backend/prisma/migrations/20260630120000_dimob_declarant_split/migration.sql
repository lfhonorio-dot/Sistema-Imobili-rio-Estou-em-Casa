-- DIMOB: campos de declarante (rateio proporcional por CNPJ) e vínculo de comissão
ALTER TABLE "dimob_records" ADD COLUMN "declarantDoc"    TEXT;
ALTER TABLE "dimob_records" ADD COLUMN "declarantName"   TEXT;
ALTER TABLE "dimob_records" ADD COLUMN "declarantType"   TEXT;   -- PJ, PF
ALTER TABLE "dimob_records" ADD COLUMN "participationPct" DOUBLE PRECISION;
ALTER TABLE "dimob_records" ADD COLUMN "eventDate"       TIMESTAMP(3);
ALTER TABLE "dimob_records" ADD COLUMN "referenceMonth"  INTEGER;   -- locação: mês de competência
CREATE INDEX IF NOT EXISTS "dimob_records_declarant_year_idx" ON "dimob_records" ("workspaceId", "declarantDoc", "year");
