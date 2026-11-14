-- Fase 1 — Perfil de operação por workspace (somente ADITIVO).
-- VENDA: mostra só o fluxo de venda (locação, vistorias, manutenção, split,
-- Open Finance, automações e agentes de IA ficam ocultos; nada é apagado).
-- VENDA_E_LOCACAO: mostra tudo.
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "operationProfile" TEXT NOT NULL DEFAULT 'VENDA';

-- Decisão do dono: regime tributário da imobiliária = LUCRO PRESUMIDO.
-- Grava a configuração fiscal para os workspaces que ainda não têm uma
-- (não altera a coluna nem o default dela). As alíquotas continuam
-- editáveis na tela Fiscal.
INSERT INTO "tax_configs" ("id", "workspaceId", "regime", "updatedAt")
SELECT gen_random_uuid()::text, w."id", 'LUCRO_PRESUMIDO', NOW()
FROM "workspaces" w
WHERE NOT EXISTS (SELECT 1 FROM "tax_configs" t WHERE t."workspaceId" = w."id");
