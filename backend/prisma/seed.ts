// Seed do banco de dados - dados iniciais para desenvolvimento
// Cria workspace de demonstração com usuário admin e papéis padrão

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // -----------------------------------------------
  // Workspace de desenvolvimento
  // -----------------------------------------------
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { slug: 'demo-imobiliaria' },
  });

  if (existingWorkspace) {
    console.log('Workspace de demo já existe. Pulando seed.');
    return;
  }

  console.log('Criando workspace de demonstração...');

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Demo Imobiliária Ltda',
      slug: 'demo-imobiliaria',
      cnpj: '00.000.000/0001-00',
      address: 'Rua das Flores, 123 - São Paulo, SP',
      phone: '(11) 99999-9999',
      dpoEmail: 'dpo@demo-imobiliaria.com.br',
      dpoName: 'João Silva (DPO)',
    },
  });

  console.log(`Workspace criado: ${workspace.name} (${workspace.id})`);

  // -----------------------------------------------
  // Papéis de sistema padrão
  // -----------------------------------------------
  const adminRole = await prisma.role.create({
    data: {
      workspaceId: workspace.id,
      name: 'Administrador',
      isSystem: true,
      permissions: {
        'users:read': true,
        'users:write': true,
        'users:delete': true,
        'workspace:read': true,
        'workspace:write': true,
        'lgpd:read': true,
        'lgpd:write': true,
        'audit:read': true,
        'roles:read': true,
        'roles:write': true,
      },
    },
  });

  const gerente = await prisma.role.create({
    data: {
      workspaceId: workspace.id,
      name: 'Gerente',
      isSystem: true,
      permissions: {
        'users:read': true,
        'users:write': true,
        'workspace:read': true,
        'lgpd:read': true,
        'audit:read': true,
        'roles:read': true,
      },
    },
  });

  await prisma.role.create({
    data: {
      workspaceId: workspace.id,
      name: 'Corretor',
      isSystem: true,
      permissions: {
        'users:read': true,
        'workspace:read': true,
      },
    },
  });

  console.log('Papéis criados: Administrador, Gerente, Corretor');

  // -----------------------------------------------
  // Usuário administrador padrão
  // Senha: Admin@123456 (deve ser alterada em produção)
  // -----------------------------------------------
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 12);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@demo-imobiliaria.com.br',
      name: 'Administrador Demo',
      passwordHash: adminPasswordHash,
    },
  });

  await prisma.workspaceUser.create({
    data: {
      workspaceId: workspace.id,
      userId: adminUser.id,
      roleId: adminRole.id,
      isOwner: true,
    },
  });

  console.log(`Usuário admin criado: ${adminUser.email}`);

  // -----------------------------------------------
  // Usuário gerente de demonstração
  // -----------------------------------------------
  const gerentePasswordHash = await bcrypt.hash('Gerente@123456', 12);

  const gerenteUser = await prisma.user.create({
    data: {
      email: 'gerente@demo-imobiliaria.com.br',
      name: 'Maria Santos',
      passwordHash: gerentePasswordHash,
    },
  });

  await prisma.workspaceUser.create({
    data: {
      workspaceId: workspace.id,
      userId: gerenteUser.id,
      roleId: gerente.id,
      isOwner: false,
    },
  });

  console.log(`Usuário gerente criado: ${gerenteUser.email}`);

  // -----------------------------------------------
  // Política de privacidade inicial
  // -----------------------------------------------
  await prisma.privacyPolicy.create({
    data: {
      workspaceId: workspace.id,
      version: '1.0',
      effectiveAt: new Date(),
      content: `
# Política de Privacidade - Demo Imobiliária

## 1. Coleta de Dados
Coletamos seus dados pessoais para fins de prestação de serviços imobiliários...

## 2. Uso dos Dados
Seus dados são utilizados exclusivamente para:
- Intermediação de compra, venda e locação de imóveis
- Comunicação sobre imóveis de interesse
- Cumprimento de obrigações legais

## 3. Direitos dos Titulares (LGPD Art. 18)
Você tem direito a:
- Acesso aos seus dados pessoais
- Correção de dados incorretos
- Exclusão de dados pessoais
- Portabilidade dos dados
- Informações sobre compartilhamento

## 4. Contato DPO
Para exercer seus direitos: dpo@demo-imobiliaria.com.br

Versão: 1.0 - Vigência: ${new Date().toLocaleDateString('pt-BR')}
      `.trim(),
    },
  });

  console.log('Política de privacidade criada.');

  console.log('\n=== SEED CONCLUÍDO ===');
  console.log('Workspace: demo-imobiliaria');
  console.log('Admin: admin@demo-imobiliaria.com.br / Admin@123456');
  console.log('Gerente: gerente@demo-imobiliaria.com.br / Gerente@123456');
  console.log('ATENÇÃO: Altere as senhas antes de usar em produção!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
