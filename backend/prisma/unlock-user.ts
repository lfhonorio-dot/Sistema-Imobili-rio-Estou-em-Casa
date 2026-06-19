import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: npx ts-node prisma/unlock-user.ts <email>');
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  console.log(`Usuário ${user.email} desbloqueado com sucesso.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
