// Serviço Prisma - cliente do banco de dados
// Gerencia conexão, desconexão e extensões do Prisma ORM

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
      errorFormat: 'colorless',
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Conectando ao banco de dados PostgreSQL...');
    await this.$connect();
    this.logger.log('Conexão com o banco de dados estabelecida.');

    // Log de queries lentas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).$on('query', (event: { query: string; duration: number }) => {
        if (event.duration > 1000) {
          this.logger.warn(
            `Query lenta detectada (${event.duration}ms): ${event.query.substring(0, 100)}...`,
          );
        }
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Desconectando do banco de dados...');
    await this.$disconnect();
  }

  // Exclusão lógica: atualiza deletedAt em vez de deletar fisicamente
  async softDelete(
    model: string,
    id: string,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this as any)[model].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
