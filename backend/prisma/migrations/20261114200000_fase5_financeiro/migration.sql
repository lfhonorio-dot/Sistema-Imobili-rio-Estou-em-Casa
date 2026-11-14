-- Fase 5 — Financeiro. Somente aditiva (colunas e tabelas novas) + dados.

-- AlterTable
ALTER TABLE "financial_entries" ADD COLUMN     "competence" TEXT,
ADD COLUMN     "costCenterId" TEXT,
ADD COLUMN     "recurrenceId" TEXT;

-- AlterTable
ALTER TABLE "boletos" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "entryRef" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'BOLETO',
ADD COLUMN     "lastSentAt" TIMESTAMP(3),
ADD COLUMN     "lastSentChannels" TEXT;

-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN     "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "openingDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "bank_transactions" ADD COLUMN     "paymentId" TEXT;

-- CreateTable
CREATE TABLE "financial_payments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "principal" DECIMAL(15,2) NOT NULL,
    "interest" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fine" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "bankAccountId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "gatewayPaymentId" TEXT,
    "receiptFileId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "reversedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_entries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "contactId" TEXT,
    "supplierId" TEXT,
    "costCenterId" TEXT,
    "propertyId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCompetence" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_financial_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "finePct" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "interestMonthlyPct" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_financial_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_webhook_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "paymentId" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_payments_workspaceId_paidAt_idx" ON "financial_payments"("workspaceId", "paidAt");

-- CreateIndex
CREATE INDEX "financial_payments_entryId_idx" ON "financial_payments"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_categories_workspaceId_type_code_key" ON "financial_categories"("workspaceId", "type", "code");

-- CreateIndex
CREATE INDEX "cost_centers_workspaceId_idx" ON "cost_centers"("workspaceId");

-- CreateIndex
CREATE INDEX "recurring_entries_workspaceId_isActive_idx" ON "recurring_entries"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_financial_settings_workspaceId_key" ON "workspace_financial_settings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_webhook_events_workspaceId_eventId_key" ON "gateway_webhook_events"("workspaceId", "eventId");


-- ── Dados ─────────────────────────────────────────────────────────

-- 1) Baixas existentes: cada lançamento PAGO ganha um registro de baixa
--    (origem LEGACY), para o fluxo de caixa e o DRE enxergarem o histórico.
INSERT INTO "financial_payments" ("id","workspaceId","entryId","principal","interest","fine","discount","total","paidAt","method","source","createdAt")
SELECT gen_random_uuid()::text, e."workspaceId", e."id", e."amount",
       GREATEST(COALESCE(e."paidAmount", e."amount") - e."amount", 0), 0,
       GREATEST(e."amount" - COALESCE(e."paidAmount", e."amount"), 0),
       COALESCE(e."paidAmount", e."amount"),
       COALESCE(e."paidAt", e."updatedAt"), e."paymentMethod", 'LEGACY', CURRENT_TIMESTAMP
FROM "financial_entries" e
WHERE e."status" = 'PAID' AND e."deletedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "financial_payments" p WHERE p."entryId" = e."id");

-- 2) Boletos: guarda o lançamento de origem em entryRef (sobrevive ao cancelamento).
UPDATE "boletos" SET "entryRef" = "financialEntryId" WHERE "entryRef" IS NULL AND "financialEntryId" IS NOT NULL;

-- 3) Plano de categorias padrão (de sistema) para cada imobiliária.
INSERT INTO "financial_categories" ("id","workspaceId","type","code","name","isSystem","createdAt","updatedAt")
SELECT gen_random_uuid()::text, w."id", c.type, c.code, c.name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES
  ('RECEIVABLE','COMMISSION','Comissão de venda'),
  ('RECEIVABLE','SALE','Venda (valor do imóvel)'),
  ('RECEIVABLE','RENT','Aluguel'),
  ('RECEIVABLE','ADMINISTRATION','Taxa de administração'),
  ('RECEIVABLE','OTHER','Outras receitas'),
  ('PAYABLE','COMMISSION','Comissão de corretores'),
  ('PAYABLE','TAXES','Impostos'),
  ('PAYABLE','PAYROLL','Pessoal e pró-labore'),
  ('PAYABLE','RENT_OFFICE','Aluguel do escritório'),
  ('PAYABLE','UTILITIES','Água, luz, internet e telefone'),
  ('PAYABLE','MARKETING','Marketing e portais'),
  ('PAYABLE','MAINTENANCE','Manutenção'),
  ('PAYABLE','SERVICES','Serviços de terceiros (contador, advogado)'),
  ('PAYABLE','BANK_FEES','Tarifas bancárias'),
  ('PAYABLE','OTHER','Outras despesas')
) AS c(type, code, name)
ON CONFLICT ("workspaceId","type","code") DO NOTHING;

-- 4) Padrões de multa/juros para cada imobiliária.
INSERT INTO "workspace_financial_settings" ("id","workspaceId","updatedAt")
SELECT gen_random_uuid()::text, w."id", CURRENT_TIMESTAMP FROM "workspaces" w
ON CONFLICT ("workspaceId") DO NOTHING;

-- 5) Correção em lote dos contratos de venda antigos (autorizada pelo dono).
--    Antes da Fase 4, criar um contrato de VENDA/INTERMEDIAÇÃO gerava um
--    "a receber" com o VALOR DO IMÓVEL, como se a imobiliária fosse receber
--    o preço da casa. Esse dinheiro é do vendedor, não da imobiliária.
--    Cancelamos (sem apagar) os que ainda estão em aberto e sem boleto ativo,
--    registrando o motivo. Lançamentos já pagos não são tocados.
UPDATE "financial_entries" e
SET "status" = 'CANCELLED',
    "cancelledAt" = CURRENT_TIMESTAMP,
    "cancelReason" = 'Correção automática (Fase 5): a receber criado pelo sistema antigo com o valor do imóvel; a imobiliária recebe apenas a comissão.',
    "updatedAt" = CURRENT_TIMESTAMP
FROM "contracts" c
WHERE e."contractId" = c."id"
  AND c."type" IN ('SALE','BROKERAGE')
  AND e."type" = 'RECEIVABLE'
  AND e."category" = 'SALE'
  AND e."status" IN ('PENDING','OVERDUE')
  AND e."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "boletos" b
    WHERE b."financialEntryId" = e."id" AND b."deletedAt" IS NULL
      AND b."status" NOT IN ('CANCELLED','PAID')
  );
