-- Fase 6 — NFS-e (SIL Tecnologia / ABRASF 2.04). Somente aditiva.

-- AlterTable
ALTER TABLE "tax_configs" ADD COLUMN     "autoIssueOnReceipt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoIssueSince" TIMESTAMP(3),
ADD COLUMN     "certPasswordEnc" TEXT,
ADD COLUMN     "certPfxEnc" TEXT,
ADD COLUMN     "certSubject" TEXT,
ADD COLUMN     "certValidUntil" TIMESTAMP(3),
ADD COLUMN     "cnae" TEXT,
ADD COLUMN     "codigoMunicipioIbge" TEXT NOT NULL DEFAULT '3516200',
ADD COLUMN     "codigoTributacaoMunicipio" TEXT,
ADD COLUMN     "exigibilidadeIss" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "incentivoFiscal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemListaServico" TEXT,
ADD COLUMN     "nfseSoapNamespace" TEXT NOT NULL DEFAULT 'http://nfse.abrasf.org.br',
ADD COLUMN     "nfseWsUrlHomolog" TEXT,
ADD COLUMN     "nfseWsUrlProd" TEXT,
ADD COLUMN     "optanteSimples" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productionAuthorizedAt" TIMESTAMP(3),
ADD COLUMN     "productionAuthorizedById" TEXT,
ADD COLUMN     "razaoSocial" TEXT,
ADD COLUMN     "regimeEspecialTributacao" INTEGER,
ADD COLUMN     "retCofinsPct" DECIMAL(7,4) NOT NULL DEFAULT 3,
ADD COLUMN     "retCsllPct" DECIMAL(7,4) NOT NULL DEFAULT 1,
ADD COLUMN     "retIrPct" DECIMAL(7,4) NOT NULL DEFAULT 1.5,
ADD COLUMN     "retMinAmount" DECIMAL(15,2) NOT NULL DEFAULT 10,
ADD COLUMN     "retPisPct" DECIMAL(7,4) NOT NULL DEFAULT 0.65,
ADD COLUMN     "retainIssWhenPj" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retentionsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rpsNextNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rpsSerie" TEXT NOT NULL DEFAULT '1';

-- AlterTable
ALTER TABLE "nfse_records" ADD COLUMN     "autoIssued" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "baseAmount" DECIMAL(15,2),
ADD COLUMN     "cancelCode" TEXT,
ADD COLUMN     "cofinsRetained" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "competence" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "csllRetained" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "emailedAt" TIMESTAMP(3),
ADD COLUMN     "environment" TEXT,
ADD COLUMN     "irRetained" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "issDue" DECIMAL(15,2),
ADD COLUMN     "issRetainedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "netAmount" DECIMAL(15,2),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "pdfFileId" TEXT,
ADD COLUMN     "pisRetained" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "retentionPaymentId" TEXT,
ADD COLUMN     "retentionWarning" TEXT,
ADD COLUMN     "rpsNumber" INTEGER,
ADD COLUMN     "rpsSerie" TEXT,
ADD COLUMN     "takerContactId" TEXT,
ADD COLUMN     "takerEmail" TEXT,
ADD COLUMN     "takerType" TEXT,
ADD COLUMN     "totalRetained" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "xmlFileId" TEXT;

-- CreateIndex
CREATE INDEX "nfse_records_status_nextAttemptAt_idx" ON "nfse_records"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "nfse_records_workspaceId_rpsSerie_rpsNumber_key" ON "nfse_records"("workspaceId", "rpsSerie", "rpsNumber");

