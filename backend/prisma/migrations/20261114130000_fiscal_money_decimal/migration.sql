-- Converte campos de DINHEIRO ainda em FLOAT para DECIMAL(15,2), no mesmo
-- padrão de Contract/FinancialEntry/Boleto (PR #7). Alteração de tipo de
-- coluna existente AUTORIZADA EXPLICITAMENTE pelo dono (nov/2026).
-- A conversão preserva os valores (arredonda para centavos). Campos de
-- taxa/percentual (issRate, irrfRate, rate, participationPct, alíquotas da
-- TaxConfig, juros/multa do boleto, SplitRule.value) continuam FLOAT.

ALTER TABLE "nfse_records"
  ALTER COLUMN "amount" TYPE DECIMAL(15,2) USING ROUND("amount"::numeric, 2),
  ALTER COLUMN "issAmount" TYPE DECIMAL(15,2) USING ROUND("issAmount"::numeric, 2);

ALTER TABLE "fiscal_obligations"
  ALTER COLUMN "amount" TYPE DECIMAL(15,2) USING ROUND("amount"::numeric, 2),
  ALTER COLUMN "paidAmount" TYPE DECIMAL(15,2) USING ROUND("paidAmount"::numeric, 2);

ALTER TABLE "dimob_records"
  ALTER COLUMN "monthlyValue" TYPE DECIMAL(15,2) USING ROUND("monthlyValue"::numeric, 2),
  ALTER COLUMN "totalValue" TYPE DECIMAL(15,2) USING ROUND("totalValue"::numeric, 2),
  ALTER COLUMN "commissionAmount" TYPE DECIMAL(15,2) USING ROUND("commissionAmount"::numeric, 2);

ALTER TABLE "irrf_records"
  ALTER COLUMN "grossAmount" TYPE DECIMAL(15,2) USING ROUND("grossAmount"::numeric, 2),
  ALTER COLUMN "irrfAmount" TYPE DECIMAL(15,2) USING ROUND("irrfAmount"::numeric, 2),
  ALTER COLUMN "netAmount" TYPE DECIMAL(15,2) USING ROUND("netAmount"::numeric, 2);

ALTER TABLE "carne_leao_records"
  ALTER COLUMN "grossIncome" TYPE DECIMAL(15,2) USING ROUND("grossIncome"::numeric, 2),
  ALTER COLUMN "deductions" TYPE DECIMAL(15,2) USING ROUND("deductions"::numeric, 2),
  ALTER COLUMN "deductions" SET DEFAULT 0,
  ALTER COLUMN "taxableBase" TYPE DECIMAL(15,2) USING ROUND("taxableBase"::numeric, 2),
  ALTER COLUMN "taxDue" TYPE DECIMAL(15,2) USING ROUND("taxDue"::numeric, 2),
  ALTER COLUMN "darfAmount" TYPE DECIMAL(15,2) USING ROUND("darfAmount"::numeric, 2);

ALTER TABLE "cnab_records"
  ALTER COLUMN "amount" TYPE DECIMAL(15,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "ad_campaigns"
  ALTER COLUMN "spend" TYPE DECIMAL(15,2) USING ROUND("spend"::numeric, 2),
  ALTER COLUMN "spend" SET DEFAULT 0,
  ALTER COLUMN "revenue" TYPE DECIMAL(15,2) USING ROUND("revenue"::numeric, 2),
  ALTER COLUMN "revenue" SET DEFAULT 0;
