-- Índices únicos parciais para documento (CPF/CNPJ) por workspace.
-- Parciais: ignoram NULL e registros soft-deleted, permitindo histórico.
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspace_cpf_unique"
  ON "contacts" ("workspaceId", "cpf")
  WHERE "cpf" IS NOT NULL AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspace_cnpj_unique"
  ON "contacts" ("workspaceId", "cnpj")
  WHERE "cnpj" IS NOT NULL AND "deletedAt" IS NULL;
