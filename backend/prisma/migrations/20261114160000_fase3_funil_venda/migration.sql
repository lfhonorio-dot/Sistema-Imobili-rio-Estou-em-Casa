-- Fase 3 — Funil de venda. Somente ADITIVO (tabelas visits e proposals,
-- colunas opcionais pipeline_stages.stageKey e contracts.dealId).

-- AlterTable
ALTER TABLE "pipeline_stages" ADD COLUMN     "stageKey" TEXT;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "dealId" TEXT;

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dealId" TEXT,
    "contactId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "brokerId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "feedback" TEXT,
    "interestLevel" TEXT,
    "cancelReason" TEXT,
    "activityId" TEXT,
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OFFER',
    "amount" DECIMAL(15,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "downPayment" DECIMAL(15,2),
    "financedAmount" DECIMAL(15,2),
    "fgtsAmount" DECIMAL(15,2),
    "exchangeDescription" TEXT,
    "conditions" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visits_workspaceId_scheduledAt_idx" ON "visits"("workspaceId", "scheduledAt");

-- CreateIndex
CREATE INDEX "proposals_workspaceId_dealId_idx" ON "proposals"("workspaceId", "dealId");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Marca o papel das etapas que já existem, pelo nome (só onde ainda não há marca).
UPDATE "pipeline_stages" s SET "stageKey" = CASE
    WHEN s."isWon" THEN 'WON'
    WHEN s."isLost" THEN 'LOST'
    WHEN lower(s."name") IN ('novo lead', 'novo') THEN 'NEW_LEAD'
    WHEN lower(s."name") IN ('contato feito', 'atendimento', 'em atendimento') THEN 'ATTENDANCE'
    WHEN lower(s."name") = 'visita agendada' THEN 'VISIT_SCHEDULED'
    WHEN lower(s."name") = 'visita realizada' THEN 'VISIT_DONE'
    WHEN lower(s."name") = 'proposta' THEN 'PROPOSAL'
    WHEN lower(s."name") IN ('negociação', 'negociacao') THEN 'NEGOTIATION'
    WHEN lower(s."name") IN ('documentação', 'documentacao') THEN 'DOCUMENTATION'
    ELSE NULL END
FROM "pipelines" p
WHERE p."id" = s."pipelineId" AND p."type" = 'SALE' AND s."stageKey" IS NULL;

-- Cria o "Funil de Venda" padrão (decisão do dono) em cada workspace que ainda
-- não o tem. Funis antigos e seus negócios ficam como estão.
DO $$
DECLARE w RECORD; pid TEXT;
BEGIN
  FOR w IN SELECT "id" FROM "workspaces" WHERE "deletedAt" IS NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM "pipelines" WHERE "workspaceId" = w."id" AND "name" = 'Funil de Venda' AND "deletedAt" IS NULL) THEN
      pid := gen_random_uuid()::text;
      UPDATE "pipelines" SET "isDefault" = false WHERE "workspaceId" = w."id" AND "type" = 'SALE';
      INSERT INTO "pipelines" ("id", "workspaceId", "name", "type", "isDefault", "order", "createdAt", "updatedAt")
      VALUES (pid, w."id", 'Funil de Venda', 'SALE', true, 0, NOW(), NOW());
      INSERT INTO "pipeline_stages" ("id", "pipelineId", "name", "color", "order", "isWon", "isLost", "stageKey", "createdAt", "updatedAt") VALUES
        (gen_random_uuid()::text, pid, 'Novo lead',        '#6366f1', 0, false, false, 'NEW_LEAD',        NOW(), NOW()),
        (gen_random_uuid()::text, pid, 'Atendimento',      '#8b5cf6', 1, false, false, 'ATTENDANCE',      NOW(), NOW()),
        (gen_random_uuid()::text, pid, 'Visita agendada',  '#f59e0b', 2, false, false, 'VISIT_SCHEDULED', NOW(), NOW()),
        (gen_random_uuid()::text, pid, 'Visita realizada', '#eab308', 3, false, false, 'VISIT_DONE',      NOW(), NOW()),
        (gen_random_uuid()::text, pid, 'Proposta',         '#3b82f6', 4, false, false, 'PROPOSAL',        NOW(), NOW()),
        (gen_random_uuid()::text, pid, 'Negociação',       '#0ea5e9', 5, false, false, 'NEGOTIATION',     NOW(), NOW()),
        (gen_random_uuid()::text, pid, 'Documentação',     '#10b981', 6, false, false, 'DOCUMENTATION',   NOW(), NOW()),
        (gen_random_uuid()::text, pid, 'Ganho',            '#22c55e', 7, true,  false, 'WON',             NOW(), NOW()),
        (gen_random_uuid()::text, pid, 'Perdido',          '#ef4444', 8, false, true,  'LOST',            NOW(), NOW());
    END IF;
  END LOOP;
END $$;
