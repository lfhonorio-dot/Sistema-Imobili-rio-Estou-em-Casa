/**
 * Limpeza de dados operacionais — para recomeçar testes com a base limpa.
 *
 * APAGA todos os registros de negócio (contatos, imóveis, contratos, financeiro,
 * comissões, splits, fiscal, boletos, assinaturas, conversas, marketing...).
 *
 * PRESERVA a estrutura e o que faz o sistema funcionar:
 *   - usuários, workspaces, papéis e vínculos (você continua logado)
 *   - configurações: gateway de pagamento, fiscal, WhatsApp, integrações,
 *     portais, API keys, webhooks, templates de e-mail, automações, planos
 *   - histórico de migrations do Prisma
 *
 * Uso (exige confirmação explícita):
 *   DATABASE_URL="postgresql://..." CONFIRM_RESET=SIM npx ts-node prisma/reset-data.ts
 *
 * Para limitar a um workspace específico (multiempresa):
 *   ... WORKSPACE_ID="<uuid>" CONFIRM_RESET=SIM npx ts-node prisma/reset-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Tabelas de dados operacionais, em ordem segura de dependência
// (filhas antes das pais). TRUNCATE ... CASCADE cobre o resto.
const OPERATIONAL_TABLES = [
  // Assinatura eletrônica
  'signature_audit_events', 'signature_signatories', 'signature_envelopes',
  // Fiscal
  'dimob_records', 'irrf_records', 'carne_leao_records', 'nfse_records', 'fiscal_obligations',
  // Cobrança e bancos
  'cnab_records', 'cnab_files', 'boletos',
  'bank_reconciliations', 'bank_transactions', 'bank_accounts',
  // Split de comissão
  'split_transactions', 'split_rules', 'split_recipients',
  // Financeiro
  'commissions', 'financial_entries',
  // Vistorias e manutenção
  'inspection_rooms', 'inspections', 'maintenance_orders',
  // Contratos
  'contracts',
  // Imóveis
  'property_photos', 'property_status_history', 'portal_publications', 'properties',
  // CRM
  'deal_properties', 'deal_stage_history', 'deal_tags', 'deals',
  'activities', 'contact_tags', 'contact_company_links', 'contacts',
  // Documentos anexados (contratos, contatos, imóveis)
  'documents',
  'pipeline_stages', 'pipelines',
  // Comunicação
  'messages', 'conversations', 'notifications',
  // Marketing
  'ad_campaigns',
  // Logs e auditoria dos dados de teste
  'automation_logs', 'webhook_logs', 'audit_logs',
  // LGPD (registros gerados pelos testes)
  'lgpd_consents', 'lgpd_requests', 'security_incidents',
];

// Preservadas de propósito: auth/configuração/estrutura
const PRESERVED_TABLES = [
  'users', 'user_sessions', 'password_reset_tokens', 'workspaces', 'workspace_users',
  'roles', 'invite_tokens', 'workspace_plans', 'onboarding_steps',
  'payment_gateway_configs', 'tax_configs', 'whatsapp_configs',
  'marketing_integrations', 'portal_integrations', 'api_keys', 'webhook_endpoints',
  'email_templates', 'automations', 'notification_preferences',
  'custom_fields', 'tags', 'privacy_policies', 'platform_configs', 'feature_flags',
  '_prisma_migrations',
];

async function main() {
  if (process.env.CONFIRM_RESET !== 'SIM') {
    console.error(
      '\nAbortado: esta operação APAGA dados de forma irreversível.\n' +
      'Para confirmar, rode novamente com CONFIRM_RESET=SIM\n',
    );
    process.exit(1);
  }

  const workspaceId = process.env.WORKSPACE_ID?.trim();
  const db = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  console.log(`\nBanco: ${db[0]?.current_database}`);
  console.log(workspaceId ? `Escopo: workspace ${workspaceId}` : 'Escopo: TODOS os workspaces');

  // Contagem antes, para o relatório
  const before = await countRows(OPERATIONAL_TABLES);
  const totalBefore = Object.values(before).reduce((a, b) => a + b, 0);
  console.log(`Registros operacionais encontrados: ${totalBefore}\n`);

  if (totalBefore === 0) {
    console.log('Nada a limpar. Base já está vazia de dados operacionais.\n');
    return;
  }

  if (workspaceId) {
    // Limpeza por workspace: DELETE respeitando a coluna workspaceId quando existir
    for (const table of OPERATIONAL_TABLES) {
      const hasWorkspace = await columnExists(table, 'workspaceId');
      try {
        if (hasWorkspace) {
          await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "workspaceId" = $1`, workspaceId);
        } else {
          // Tabelas-filhas sem workspaceId são removidas em cascata pelas pais
          continue;
        }
      } catch (e) {
        console.warn(`  aviso em ${table}: ${(e as Error).message}`);
      }
    }
  } else {
    // Limpeza global: TRUNCATE em bloco (rápido e resolve dependências)
    const list = OPERATIONAL_TABLES.map((t) => `"${t}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }

  const after = await countRows(OPERATIONAL_TABLES);
  console.log('Tabelas limpas:');
  for (const t of OPERATIONAL_TABLES) {
    if ((before[t] ?? 0) > 0) console.log(`  ${t}: ${before[t]} -> ${after[t] ?? 0}`);
  }

  // Sanidade: o acesso continua de pé?
  const [users, workspaces] = await Promise.all([
    prisma.user.count(), prisma.workspace.count(),
  ]);
  console.log(`\nPreservados: ${users} usuário(s), ${workspaces} workspace(s).`);

  // Avisa sobre tabelas do banco não cobertas por nenhuma das listas
  const known = new Set([...OPERATIONAL_TABLES, ...PRESERVED_TABLES]);
  const all = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const uncovered = all.map((r) => r.tablename).filter((t) => !known.has(t));
  if (uncovered.length) {
    console.log(`\nAviso — tabelas não classificadas (não foram tocadas): ${uncovered.join(', ')}`);
  }

  console.log('\nLimpeza concluída.\n');
}

async function countRows(tables: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of tables) {
    try {
      const r = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${t}"`);
      out[t] = Number(r[0]?.count ?? 0);
    } catch {
      out[t] = 0; // tabela ainda não existe nesta versão do schema
    }
  }
  return out;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
    ) AS exists
  `;
  return Boolean(r[0]?.exists);
}

main()
  .catch((e) => {
    console.error('\nFalha na limpeza:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
