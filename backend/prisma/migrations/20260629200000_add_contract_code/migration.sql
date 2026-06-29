-- Adiciona código sequencial aos contratos (C-{ano}-{NNNN})
ALTER TABLE "contracts" ADD COLUMN "code" TEXT;

-- Índice único por workspace (NULLs são distintos no Postgres, então contratos antigos sem código coexistem)
CREATE UNIQUE INDEX "contracts_workspaceId_code_key" ON "contracts"("workspaceId", "code");
