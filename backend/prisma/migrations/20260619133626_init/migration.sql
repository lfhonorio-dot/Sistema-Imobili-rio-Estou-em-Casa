/*
  Warnings:

  - You are about to drop the `activities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ad_campaigns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `api_keys` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `automation_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `automations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bank_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bank_reconciliations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bank_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `boletos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `carne_leao_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cnab_files` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cnab_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `commissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contact_company_links` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contact_tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contracts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `conversations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `custom_fields` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `deal_properties` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `deal_stage_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `deal_tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `deals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dimob_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `email_templates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `feature_flags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `financial_entries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fiscal_obligations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inspection_rooms` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inspections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invite_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `irrf_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lgpd_consents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lgpd_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `maintenance_orders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `marketing_integrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nfse_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notification_preferences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `onboarding_steps` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `password_reset_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_gateway_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pipeline_stages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pipelines` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `platform_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `portal_integrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `portal_publications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `privacy_policies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `properties` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `property_photos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `property_status_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `security_incidents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `signature_audit_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `signature_envelopes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `signature_signatories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `split_recipients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `split_rules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `split_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tax_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_endpoints` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `whatsapp_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspace_plans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspace_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspaces` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('RENDA_FIXA', 'FII', 'ACAO', 'PREVIDENCIA', 'COE', 'CAIXA', 'RECEBIVEIS');

-- CreateEnum
CREATE TYPE "Indexer" AS ENUM ('IPCA', 'CDI', 'SELIC', 'PREFIXADO', 'IGPM', 'OUTRO');

-- CreateEnum
CREATE TYPE "LiquidityType" AS ENUM ('D0', 'D1', 'NO_VENCIMENTO', 'ILIQUIDO');

-- CreateEnum
CREATE TYPE "PropertyClassification" AS ENUM ('PARA_RENDA', 'USO_PROPRIO', 'A_COMERCIALIZAR');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTAMENTO', 'CASA', 'SITIO', 'SALA_COMERCIAL', 'GALPAO', 'TERRENO', 'LOTE', 'RURAL');

-- CreateEnum
CREATE TYPE "RentAdjustmentIndex" AS ENUM ('IGPM', 'IPCA', 'OUTRO');

-- CreateEnum
CREATE TYPE "CashFlowCategory" AS ENUM ('ALUGUEL', 'RECEBIVEIS_LOTEAMENTO', 'APOSENTADORIA', 'RENDIMENTO_FII', 'RENDIMENTO_RENDA_FIXA', 'DIVIDENDO', 'SALARIO', 'OUTRAS_RECEITAS', 'IPTU', 'CONDOMINIO', 'SEGURO', 'MANUTENCAO_IMOVEL', 'IMPOSTOS_ESCRITORIO', 'IR_DARF', 'CUSTO_VIDA', 'PLANO_SAUDE', 'OUTRAS_DESPESAS');

-- CreateEnum
CREATE TYPE "CashFlowType" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "ImportFormat" AS ENUM ('OFX', 'CSV', 'XLS', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('EQI', 'BRADESCO', 'ITAU', 'SANTANDER', 'BB', 'CAIXA', 'XP', 'BTG', 'RICO', 'NUINVEST', 'B3', 'OUTRO');

-- CreateEnum
CREATE TYPE "TargetModule" AS ENUM ('CASH_FLOW', 'PORTFOLIO', 'RECEIVABLE');

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_contactId_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_dealId_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "ad_campaigns" DROP CONSTRAINT "ad_campaigns_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "automation_logs" DROP CONSTRAINT "automation_logs_automationId_fkey";

-- DropForeignKey
ALTER TABLE "automations" DROP CONSTRAINT "automations_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "bank_reconciliations" DROP CONSTRAINT "bank_reconciliations_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "bank_reconciliations" DROP CONSTRAINT "bank_reconciliations_bankTransactionId_fkey";

-- DropForeignKey
ALTER TABLE "bank_transactions" DROP CONSTRAINT "bank_transactions_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "boletos" DROP CONSTRAINT "boletos_financialEntryId_fkey";

-- DropForeignKey
ALTER TABLE "boletos" DROP CONSTRAINT "boletos_gatewayId_fkey";

-- DropForeignKey
ALTER TABLE "boletos" DROP CONSTRAINT "boletos_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "carne_leao_records" DROP CONSTRAINT "carne_leao_records_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "cnab_files" DROP CONSTRAINT "cnab_files_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "cnab_records" DROP CONSTRAINT "cnab_records_cnabFileId_fkey";

-- DropForeignKey
ALTER TABLE "commissions" DROP CONSTRAINT "commissions_contractId_fkey";

-- DropForeignKey
ALTER TABLE "commissions" DROP CONSTRAINT "commissions_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "contact_company_links" DROP CONSTRAINT "contact_company_links_companyId_fkey";

-- DropForeignKey
ALTER TABLE "contact_company_links" DROP CONSTRAINT "contact_company_links_personId_fkey";

-- DropForeignKey
ALTER TABLE "contact_tags" DROP CONSTRAINT "contact_tags_contactId_fkey";

-- DropForeignKey
ALTER TABLE "contact_tags" DROP CONSTRAINT "contact_tags_tagId_fkey";

-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_contactId_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "custom_fields" DROP CONSTRAINT "custom_fields_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "deal_properties" DROP CONSTRAINT "deal_properties_dealId_fkey";

-- DropForeignKey
ALTER TABLE "deal_properties" DROP CONSTRAINT "deal_properties_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "deal_stage_history" DROP CONSTRAINT "deal_stage_history_dealId_fkey";

-- DropForeignKey
ALTER TABLE "deal_stage_history" DROP CONSTRAINT "deal_stage_history_stageId_fkey";

-- DropForeignKey
ALTER TABLE "deal_tags" DROP CONSTRAINT "deal_tags_dealId_fkey";

-- DropForeignKey
ALTER TABLE "deal_tags" DROP CONSTRAINT "deal_tags_tagId_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_contactId_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_pipelineId_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_stageId_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "dimob_records" DROP CONSTRAINT "dimob_records_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_contactId_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_contractId_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "email_templates" DROP CONSTRAINT "email_templates_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "financial_entries" DROP CONSTRAINT "financial_entries_contractId_fkey";

-- DropForeignKey
ALTER TABLE "financial_entries" DROP CONSTRAINT "financial_entries_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "fiscal_obligations" DROP CONSTRAINT "fiscal_obligations_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "inspection_rooms" DROP CONSTRAINT "inspection_rooms_inspectionId_fkey";

-- DropForeignKey
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_contractId_fkey";

-- DropForeignKey
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "invite_tokens" DROP CONSTRAINT "invite_tokens_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "irrf_records" DROP CONSTRAINT "irrf_records_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "lgpd_consents" DROP CONSTRAINT "lgpd_consents_policyVersionId_fkey";

-- DropForeignKey
ALTER TABLE "lgpd_consents" DROP CONSTRAINT "lgpd_consents_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "lgpd_requests" DROP CONSTRAINT "lgpd_requests_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_orders" DROP CONSTRAINT "maintenance_orders_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_orders" DROP CONSTRAINT "maintenance_orders_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "marketing_integrations" DROP CONSTRAINT "marketing_integrations_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "nfse_records" DROP CONSTRAINT "nfse_records_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "onboarding_steps" DROP CONSTRAINT "onboarding_steps_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "payment_gateway_configs" DROP CONSTRAINT "payment_gateway_configs_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "pipeline_stages" DROP CONSTRAINT "pipeline_stages_pipelineId_fkey";

-- DropForeignKey
ALTER TABLE "pipelines" DROP CONSTRAINT "pipelines_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "portal_integrations" DROP CONSTRAINT "portal_integrations_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "portal_publications" DROP CONSTRAINT "portal_publications_portalId_fkey";

-- DropForeignKey
ALTER TABLE "portal_publications" DROP CONSTRAINT "portal_publications_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "portal_publications" DROP CONSTRAINT "portal_publications_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "privacy_policies" DROP CONSTRAINT "privacy_policies_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT "properties_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT "properties_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "property_photos" DROP CONSTRAINT "property_photos_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "property_status_history" DROP CONSTRAINT "property_status_history_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT "roles_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "security_incidents" DROP CONSTRAINT "security_incidents_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "signature_audit_events" DROP CONSTRAINT "signature_audit_events_signatoryId_fkey";

-- DropForeignKey
ALTER TABLE "signature_envelopes" DROP CONSTRAINT "signature_envelopes_contractId_fkey";

-- DropForeignKey
ALTER TABLE "signature_envelopes" DROP CONSTRAINT "signature_envelopes_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "signature_signatories" DROP CONSTRAINT "signature_signatories_envelopeId_fkey";

-- DropForeignKey
ALTER TABLE "split_recipients" DROP CONSTRAINT "split_recipients_gatewayId_fkey";

-- DropForeignKey
ALTER TABLE "split_recipients" DROP CONSTRAINT "split_recipients_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "split_rules" DROP CONSTRAINT "split_rules_contractId_fkey";

-- DropForeignKey
ALTER TABLE "split_rules" DROP CONSTRAINT "split_rules_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "split_transactions" DROP CONSTRAINT "split_transactions_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "tags" DROP CONSTRAINT "tags_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "tax_configs" DROP CONSTRAINT "tax_configs_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "user_sessions" DROP CONSTRAINT "user_sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_endpoints" DROP CONSTRAINT "webhook_endpoints_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_logs" DROP CONSTRAINT "webhook_logs_endpointId_fkey";

-- DropForeignKey
ALTER TABLE "whatsapp_configs" DROP CONSTRAINT "whatsapp_configs_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_plans" DROP CONSTRAINT "workspace_plans_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_users" DROP CONSTRAINT "workspace_users_roleId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_users" DROP CONSTRAINT "workspace_users_userId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_users" DROP CONSTRAINT "workspace_users_workspaceId_fkey";

-- DropTable
DROP TABLE "activities";

-- DropTable
DROP TABLE "ad_campaigns";

-- DropTable
DROP TABLE "api_keys";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "automation_logs";

-- DropTable
DROP TABLE "automations";

-- DropTable
DROP TABLE "bank_accounts";

-- DropTable
DROP TABLE "bank_reconciliations";

-- DropTable
DROP TABLE "bank_transactions";

-- DropTable
DROP TABLE "boletos";

-- DropTable
DROP TABLE "carne_leao_records";

-- DropTable
DROP TABLE "cnab_files";

-- DropTable
DROP TABLE "cnab_records";

-- DropTable
DROP TABLE "commissions";

-- DropTable
DROP TABLE "contact_company_links";

-- DropTable
DROP TABLE "contact_tags";

-- DropTable
DROP TABLE "contacts";

-- DropTable
DROP TABLE "contracts";

-- DropTable
DROP TABLE "conversations";

-- DropTable
DROP TABLE "custom_fields";

-- DropTable
DROP TABLE "deal_properties";

-- DropTable
DROP TABLE "deal_stage_history";

-- DropTable
DROP TABLE "deal_tags";

-- DropTable
DROP TABLE "deals";

-- DropTable
DROP TABLE "dimob_records";

-- DropTable
DROP TABLE "documents";

-- DropTable
DROP TABLE "email_templates";

-- DropTable
DROP TABLE "feature_flags";

-- DropTable
DROP TABLE "financial_entries";

-- DropTable
DROP TABLE "fiscal_obligations";

-- DropTable
DROP TABLE "inspection_rooms";

-- DropTable
DROP TABLE "inspections";

-- DropTable
DROP TABLE "invite_tokens";

-- DropTable
DROP TABLE "irrf_records";

-- DropTable
DROP TABLE "lgpd_consents";

-- DropTable
DROP TABLE "lgpd_requests";

-- DropTable
DROP TABLE "maintenance_orders";

-- DropTable
DROP TABLE "marketing_integrations";

-- DropTable
DROP TABLE "messages";

-- DropTable
DROP TABLE "nfse_records";

-- DropTable
DROP TABLE "notification_preferences";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "onboarding_steps";

-- DropTable
DROP TABLE "password_reset_tokens";

-- DropTable
DROP TABLE "payment_gateway_configs";

-- DropTable
DROP TABLE "pipeline_stages";

-- DropTable
DROP TABLE "pipelines";

-- DropTable
DROP TABLE "platform_configs";

-- DropTable
DROP TABLE "portal_integrations";

-- DropTable
DROP TABLE "portal_publications";

-- DropTable
DROP TABLE "privacy_policies";

-- DropTable
DROP TABLE "properties";

-- DropTable
DROP TABLE "property_photos";

-- DropTable
DROP TABLE "property_status_history";

-- DropTable
DROP TABLE "roles";

-- DropTable
DROP TABLE "security_incidents";

-- DropTable
DROP TABLE "signature_audit_events";

-- DropTable
DROP TABLE "signature_envelopes";

-- DropTable
DROP TABLE "signature_signatories";

-- DropTable
DROP TABLE "split_recipients";

-- DropTable
DROP TABLE "split_rules";

-- DropTable
DROP TABLE "split_transactions";

-- DropTable
DROP TABLE "tags";

-- DropTable
DROP TABLE "tax_configs";

-- DropTable
DROP TABLE "user_sessions";

-- DropTable
DROP TABLE "users";

-- DropTable
DROP TABLE "webhook_endpoints";

-- DropTable
DROP TABLE "webhook_logs";

-- DropTable
DROP TABLE "whatsapp_configs";

-- DropTable
DROP TABLE "workspace_plans";

-- DropTable
DROP TABLE "workspace_users";

-- DropTable
DROP TABLE "workspaces";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentAsset" (
    "id" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "issuer" TEXT,
    "broker" TEXT,
    "contractNumber" TEXT,
    "applicationDate" TIMESTAMP(3),
    "maturityDate" TIMESTAMP(3),
    "exDividendDate" TIMESTAMP(3),
    "investedAmount" DECIMAL(18,2) NOT NULL,
    "currentValue" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,6),
    "averagePrice" DECIMAL(18,6),
    "currentPrice" DECIMAL(18,6),
    "indexer" "Indexer",
    "rate" DECIMAL(10,4),
    "grossRate" DECIMAL(10,4),
    "isIRExempt" BOOLEAN NOT NULL DEFAULT false,
    "rating" TEXT,
    "liquidity" "LiquidityType",
    "segment" TEXT,
    "lastDividendPerShare" DECIMAL(18,6),
    "monthlyDY" DECIMAL(10,4),
    "pvp" DECIMAL(10,4),
    "beta" DECIMAL(10,4),
    "insurerName" TEXT,
    "planType" TEXT,
    "taxRegime" TEXT,
    "monthlyContribution" DECIMAL(18,2),
    "beneficiaries" TEXT,
    "minReturn" DECIMAL(18,2),
    "baseReturn" DECIMAL(18,2),
    "maxReturn" DECIMAL(18,2),
    "capitalProtected" BOOLEAN NOT NULL DEFAULT false,
    "underlyingAsset" TEXT,
    "lastImportedAt" TIMESTAMP(3),
    "importSource" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DividendHistory" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DividendHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classification" "PropertyClassification" NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "currentValuation" DECIMAL(18,2) NOT NULL,
    "lastValuationDate" TIMESTAMP(3),
    "notes" TEXT,
    "rentAmount" DECIMAL(18,2),
    "rentStatus" TEXT,
    "tenantName" TEXT,
    "contractEndDate" TIMESTAMP(3),
    "adjustmentIndex" "RentAdjustmentIndex",
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivablePortfolio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "developmentName" TEXT,
    "presentValue" DECIMAL(18,2) NOT NULL,
    "futureTotalReceivable" DECIMAL(18,2) NOT NULL,
    "averageRemainingTerm" INTEGER,
    "impliedMonthlyRate" DECIMAL(10,6),
    "monthlyReceivedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expectedMonthlyAmount" DECIMAL(18,2),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceivablePortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivableMonthlyHistory" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "expectedAmount" DECIMAL(18,2) NOT NULL,
    "receivedAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivableMonthlyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlowEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CashFlowType" NOT NULL,
    "category" "CashFlowCategory" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "date" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "propertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlowEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetirementPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "desiredMonthlyIncome" DECIMAL(18,2) NOT NULL,
    "estimatedMonthlyExpenses" DECIMAL(18,2) NOT NULL,
    "expectedIpca" DECIMAL(10,4) NOT NULL DEFAULT 4.5,
    "expectedCdi" DECIMAL(10,4) NOT NULL DEFAULT 10.5,
    "lifeExpectancy" INTEGER NOT NULL DEFAULT 85,
    "targetFixedIncome" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "targetFii" DECIMAL(10,2) NOT NULL DEFAULT 22.5,
    "targetStocks" DECIMAL(10,2) NOT NULL DEFAULT 12.5,
    "targetReceivables" DECIMAL(10,2) NOT NULL DEFAULT 12.5,
    "targetLiquidity" DECIMAL(10,2) NOT NULL DEFAULT 7.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetirementPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalPatrimony" DECIMAL(18,2) NOT NULL,
    "fixedIncomeTotal" DECIMAL(18,2) NOT NULL,
    "fiiTotal" DECIMAL(18,2) NOT NULL,
    "stocksTotal" DECIMAL(18,2) NOT NULL,
    "pensionTotal" DECIMAL(18,2) NOT NULL,
    "coeTotal" DECIMAL(18,2) NOT NULL,
    "cashTotal" DECIMAL(18,2) NOT NULL,
    "receivablesTotal" DECIMAL(18,2) NOT NULL,
    "propertiesRentTotal" DECIMAL(18,2) NOT NULL,
    "propertiesOwnTotal" DECIMAL(18,2) NOT NULL,
    "propertiesSaleTotal" DECIMAL(18,2) NOT NULL,
    "monthlyPassiveIncome" DECIMAL(18,2) NOT NULL,
    "monthlyExpenses" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" "ImportFormat" NOT NULL,
    "source" "ImportSource",
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordsTotal" INTEGER NOT NULL DEFAULT 0,
    "recordsDuplicate" INTEGER NOT NULL DEFAULT 0,
    "recordsError" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdatedPortfolio" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdatedCashFlow" INTEGER NOT NULL DEFAULT 0,
    "rollbackAvailable" BOOLEAN NOT NULL DEFAULT true,
    "rollbackData" JSONB,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementEntry" (
    "id" TEXT NOT NULL,
    "importLogId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "entryType" TEXT NOT NULL,
    "category" "CashFlowCategory",
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "targetModule" "TargetModule" NOT NULL,
    "targetCategory" "CashFlowCategory",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportMatchingRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "assetId" TEXT,
    "propertyId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportMatchingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "InvestmentAsset_type_idx" ON "InvestmentAsset"("type");

-- CreateIndex
CREATE INDEX "InvestmentAsset_maturityDate_idx" ON "InvestmentAsset"("maturityDate");

-- CreateIndex
CREATE INDEX "InvestmentAsset_deletedAt_idx" ON "InvestmentAsset"("deletedAt");

-- CreateIndex
CREATE INDEX "DividendHistory_assetId_year_month_idx" ON "DividendHistory"("assetId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "DividendHistory_assetId_year_month_key" ON "DividendHistory"("assetId", "year", "month");

-- CreateIndex
CREATE INDEX "Property_classification_idx" ON "Property"("classification");

-- CreateIndex
CREATE INDEX "Property_deletedAt_idx" ON "Property"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReceivableMonthlyHistory_portfolioId_year_month_key" ON "ReceivableMonthlyHistory"("portfolioId", "year", "month");

-- CreateIndex
CREATE INDEX "CashFlowEntry_userId_year_month_idx" ON "CashFlowEntry"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "CashFlowEntry_category_idx" ON "CashFlowEntry"("category");

-- CreateIndex
CREATE UNIQUE INDEX "RetirementPlan_userId_key" ON "RetirementPlan"("userId");

-- CreateIndex
CREATE INDEX "MonthlySnapshot_userId_year_month_idx" ON "MonthlySnapshot"("userId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySnapshot_userId_year_month_key" ON "MonthlySnapshot"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "BankStatementEntry_importLogId_idx" ON "BankStatementEntry"("importLogId");

-- CreateIndex
CREATE INDEX "ImportRule_userId_idx" ON "ImportRule"("userId");

-- CreateIndex
CREATE INDEX "ImportMatchingRule_userId_idx" ON "ImportMatchingRule"("userId");

-- AddForeignKey
ALTER TABLE "DividendHistory" ADD CONSTRAINT "DividendHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InvestmentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivableMonthlyHistory" ADD CONSTRAINT "ReceivableMonthlyHistory_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "ReceivablePortfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEntry" ADD CONSTRAINT "CashFlowEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetirementPlan" ADD CONSTRAINT "RetirementPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySnapshot" ADD CONSTRAINT "MonthlySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementEntry" ADD CONSTRAINT "BankStatementEntry_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "ImportLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRule" ADD CONSTRAINT "ImportRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMatchingRule" ADD CONSTRAINT "ImportMatchingRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
