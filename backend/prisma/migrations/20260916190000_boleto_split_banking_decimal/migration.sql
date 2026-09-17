-- Corrige campos monetários guardados como FLOAT (ponto flutuante binário,
-- sujeito a erro de arredondamento em somas) para DECIMAL(15,2), mesmo padrão
-- já usado em Contract/FinancialEntry/Commission. Não altera campos de
-- taxa/percentual (Boleto.fine/interest/discount, SplitRule.value), que
-- continuam FLOAT de propósito.

ALTER TABLE "boletos"
  ALTER COLUMN "amount" TYPE DECIMAL(15,2) USING "amount"::numeric(15,2),
  ALTER COLUMN "paidAmount" TYPE DECIMAL(15,2) USING "paidAmount"::numeric(15,2);

ALTER TABLE "split_transactions"
  ALTER COLUMN "amount" TYPE DECIMAL(15,2) USING "amount"::numeric(15,2);

ALTER TABLE "bank_accounts"
  ALTER COLUMN "balance" TYPE DECIMAL(15,2) USING "balance"::numeric(15,2),
  ALTER COLUMN "balance" SET DEFAULT 0;

ALTER TABLE "bank_transactions"
  ALTER COLUMN "amount" TYPE DECIMAL(15,2) USING "amount"::numeric(15,2),
  ALTER COLUMN "balance" TYPE DECIMAL(15,2) USING "balance"::numeric(15,2);
