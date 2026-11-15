-- Fase 4 — Contrato de venda e pós-venda. Somente ADITIVO: colunas novas
-- (contracts, financial_entries, dimob_records.deletedAt) e tabela de checklist.

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "cashAmount" DECIMAL(15,2),
ADD COLUMN     "cashInvolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cashReviewNote" TEXT,
ADD COLUMN     "cashReviewStatus" TEXT,
ADD COLUMN     "cashReviewedAt" TIMESTAMP(3),
ADD COLUMN     "cashReviewedById" TEXT,
ADD COLUMN     "commissionAmount" DECIMAL(15,2),
ADD COLUMN     "commissionPayerId" TEXT,
ADD COLUMN     "rescindedAt" TIMESTAMP(3),
ADD COLUMN     "rescissionReason" TEXT;

-- AlterTable
ALTER TABLE "financial_entries" ADD COLUMN     "beneficiaryUserId" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "sourceEntryId" TEXT;

-- AlterTable
ALTER TABLE "dimob_records" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "contract_checklist_items" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "responsibleId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_checklist_items_workspaceId_contractId_idx" ON "contract_checklist_items"("workspaceId", "contractId");

