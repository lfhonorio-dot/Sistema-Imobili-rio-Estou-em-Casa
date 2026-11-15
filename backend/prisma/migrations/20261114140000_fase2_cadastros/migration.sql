-- Fase 2 — Cadastros. Somente ADITIVO: novas tabelas e novas colunas
-- opcionais. Nenhuma coluna existente é alterada ou removida.

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN     "marriageRegime" TEXT,
ADD COLUMN     "spouseContactId" TEXT;

-- AlterTable
ALTER TABLE "property_photos" ADD COLUMN     "fileId" TEXT;

-- AlterTable
ALTER TABLE "financial_entries" ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "property_owners" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sharePct" DECIMAL(5,2),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_authorizations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "commissionRate" DECIMAL(5,2),
    "askingPrice" DECIMAL(15,2),
    "captorUserId" TEXT,
    "documentId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_key_movements" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "keyLabel" TEXT,
    "holderName" TEXT NOT NULL,
    "holderContactId" TEXT,
    "userId" TEXT,
    "expectedReturnAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_key_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_price_history" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" DECIMAL(15,2),
    "newValue" DECIMAL(15,2),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "personType" TEXT NOT NULL DEFAULT 'PJ',
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "category" TEXT,
    "pixKeyType" TEXT,
    "pixKey" TEXT,
    "bankCode" TEXT,
    "agency" TEXT,
    "accountNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_interest_profiles" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "propertyTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "neighborhoods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minPrice" DECIMAL(15,2),
    "maxPrice" DECIMAL(15,2),
    "minBedrooms" INTEGER,
    "minParkingSpaces" INTEGER,
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_interest_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_owners_workspaceId_propertyId_idx" ON "property_owners"("workspaceId", "propertyId");

-- CreateIndex
CREATE INDEX "property_authorizations_workspaceId_validUntil_idx" ON "property_authorizations"("workspaceId", "validUntil");

-- CreateIndex
CREATE INDEX "property_key_movements_workspaceId_propertyId_idx" ON "property_key_movements"("workspaceId", "propertyId");

-- CreateIndex
CREATE INDEX "property_price_history_workspaceId_propertyId_idx" ON "property_price_history"("workspaceId", "propertyId");

-- CreateIndex
CREATE INDEX "stored_files_workspaceId_idx" ON "stored_files"("workspaceId");

-- CreateIndex
CREATE INDEX "suppliers_workspaceId_idx" ON "suppliers"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_interest_profiles_contactId_key" ON "contact_interest_profiles"("contactId");

-- CreateIndex
CREATE INDEX "contact_interest_profiles_workspaceId_idx" ON "contact_interest_profiles"("workspaceId");

-- AddForeignKey
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_authorizations" ADD CONSTRAINT "property_authorizations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_key_movements" ADD CONSTRAINT "property_key_movements_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_price_history" ADD CONSTRAINT "property_price_history_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_interest_profiles" ADD CONSTRAINT "contact_interest_profiles_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Copia o proprietário atual de cada imóvel (Property.ownerId) para a
-- nova tabela de proprietários, como proprietário principal.
INSERT INTO "property_owners" ("id", "workspaceId", "propertyId", "contactId", "isPrimary", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."workspaceId", p."id", p."ownerId", true, NOW(), NOW()
FROM "properties" p
WHERE p."ownerId" IS NOT NULL AND p."deletedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "property_owners" o WHERE o."propertyId" = p."id" AND o."contactId" = p."ownerId");
