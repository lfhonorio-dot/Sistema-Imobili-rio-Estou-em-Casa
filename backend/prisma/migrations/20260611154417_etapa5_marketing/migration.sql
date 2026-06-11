-- CreateTable
CREATE TABLE "marketing_integrations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "accountId" TEXT,
    "pageId" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_integrations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "portal" TEXT NOT NULL,
    "apiKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_publications" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_integrations_workspaceId_provider_key" ON "marketing_integrations"("workspaceId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ad_campaigns_workspaceId_provider_externalId_key" ON "ad_campaigns"("workspaceId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "portal_integrations_workspaceId_portal_key" ON "portal_integrations"("workspaceId", "portal");

-- CreateIndex
CREATE UNIQUE INDEX "portal_publications_portalId_propertyId_key" ON "portal_publications"("portalId", "propertyId");

-- AddForeignKey
ALTER TABLE "marketing_integrations" ADD CONSTRAINT "marketing_integrations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_integrations" ADD CONSTRAINT "portal_integrations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_publications" ADD CONSTRAINT "portal_publications_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_publications" ADD CONSTRAINT "portal_publications_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "portal_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_publications" ADD CONSTRAINT "portal_publications_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
