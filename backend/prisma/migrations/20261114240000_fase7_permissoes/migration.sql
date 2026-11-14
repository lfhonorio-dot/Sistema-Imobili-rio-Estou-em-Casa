-- Fase 7 — papéis, responsável do contato, notificações. Somente aditiva.

-- AlterTable
ALTER TABLE "workspace_users" ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "systemKey" TEXT;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "assigneeId" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "emailError" TEXT,
ADD COLUMN     "emailStatus" TEXT,
ADD COLUMN     "link" TEXT;

-- CreateIndex
CREATE INDEX "notifications_workspaceId_userId_readAt_idx" ON "notifications"("workspaceId", "userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_workspaceId_userId_dedupeKey_key" ON "notifications"("workspaceId", "userId", "dedupeKey");


-- ── Dados ─────────────────────────────────────────────────────────

-- 1) Papéis de sistema existentes
UPDATE "roles" SET "systemKey" = 'ADMIN'  WHERE "systemKey" IS NULL AND "name" = 'Administrador';
UPDATE "roles" SET "systemKey" = 'BROKER' WHERE "systemKey" IS NULL AND "name" = 'Corretor';

-- 2) Novos papéis em cada imobiliária: Financeiro e Gerente
INSERT INTO "roles" ("id","workspaceId","name","isSystem","permissions","systemKey","createdAt","updatedAt")
SELECT gen_random_uuid()::text, w."id", r.name, true, '{"users:read": true, "workspace:read": true}'::jsonb, r.key, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES ('Financeiro','FINANCE'), ('Gerente','MANAGER')) AS r(name, key)
ON CONFLICT ("workspaceId","name") DO NOTHING;
UPDATE "roles" SET "systemKey" = 'FINANCE' WHERE "systemKey" IS NULL AND "name" = 'Financeiro';
UPDATE "roles" SET "systemKey" = 'MANAGER' WHERE "systemKey" IS NULL AND "name" = 'Gerente';

-- 3) Corretor responsável pelo contato = responsável do negócio mais recente dele
UPDATE "contacts" c SET "assigneeId" = d."assigneeId"
FROM (
  SELECT DISTINCT ON ("contactId") "contactId", "assigneeId"
  FROM "deals"
  WHERE "assigneeId" IS NOT NULL AND "deletedAt" IS NULL
  ORDER BY "contactId", "createdAt" DESC
) d
WHERE c."id" = d."contactId" AND c."assigneeId" IS NULL;
