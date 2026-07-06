ALTER TABLE "RetirementPlan" ADD COLUMN "monthlyContribution" DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE TABLE "PropertyValuationHistory" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "valuationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyValuationHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyValuationHistory_propertyId_valuationDate_idx" ON "PropertyValuationHistory"("propertyId", "valuationDate");

ALTER TABLE "PropertyValuationHistory" ADD CONSTRAINT "PropertyValuationHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Registra o valor atual de cada imóvel existente como primeiro ponto do histórico
INSERT INTO "PropertyValuationHistory" ("id", "propertyId", "value", "valuationDate", "notes")
SELECT 'pvh_' || md5(random()::text || id), id, "currentValuation", COALESCE("lastValuationDate", "createdAt"), 'Registro inicial (migração)'
FROM "Property" WHERE "deletedAt" IS NULL;
