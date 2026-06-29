-- Índices únicos parciais para documento (CPF/CNPJ) por workspace.
-- Parciais: ignoram NULL e registros soft-deleted, permitindo histórico.

-- Passo 1: deduplica registros existentes ANTES de criar o índice único,
-- senão a criação do índice falharia e travaria o deploy.
-- Mantém o contato mais antigo (createdAt ASC) e faz soft-delete dos demais.
UPDATE "contacts" c SET "deletedAt" = now()
WHERE "deletedAt" IS NULL AND "cpf" IS NOT NULL
AND id NOT IN (
  SELECT DISTINCT ON ("workspaceId", "cpf") id FROM "contacts"
  WHERE "deletedAt" IS NULL AND "cpf" IS NOT NULL
  ORDER BY "workspaceId", "cpf", "createdAt" ASC
);

UPDATE "contacts" c SET "deletedAt" = now()
WHERE "deletedAt" IS NULL AND "cnpj" IS NOT NULL
AND id NOT IN (
  SELECT DISTINCT ON ("workspaceId", "cnpj") id FROM "contacts"
  WHERE "deletedAt" IS NULL AND "cnpj" IS NOT NULL
  ORDER BY "workspaceId", "cnpj", "createdAt" ASC
);

-- Passo 2: cria os índices únicos parciais.
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspace_cpf_unique"
  ON "contacts" ("workspaceId", "cpf")
  WHERE "cpf" IS NOT NULL AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspace_cnpj_unique"
  ON "contacts" ("workspaceId", "cnpj")
  WHERE "cnpj" IS NOT NULL AND "deletedAt" IS NULL;
