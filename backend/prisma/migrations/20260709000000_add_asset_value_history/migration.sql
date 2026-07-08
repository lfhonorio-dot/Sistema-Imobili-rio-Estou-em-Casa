CREATE TABLE "AssetValueHistory" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "currentValue" DECIMAL(18,2) NOT NULL,
    "referenceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetValueHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssetValueHistory_assetId_referenceDate_idx" ON "AssetValueHistory"("assetId", "referenceDate");

ALTER TABLE "AssetValueHistory" ADD CONSTRAINT "AssetValueHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InvestmentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Registra o valor atual de cada ativo existente como primeiro ponto do histórico
INSERT INTO "AssetValueHistory" ("id", "assetId", "currentValue", "referenceDate")
SELECT 'avh_' || md5(random()::text || id), id, "currentValue", COALESCE("lastImportedAt", "createdAt")
FROM "InvestmentAsset" WHERE "deletedAt" IS NULL;
