// Serviço de blacklist de tokens JWT no Redis
// Tokens invalidados por logout ficam na blacklist até expirarem

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { createRedisClient } from '../config/redis.config';

@Injectable()
export class TokenBlacklistService implements OnModuleInit {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private redis!: IORedis;
  private readonly PREFIX = 'blacklist:token:';

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.redis = createRedisClient(this.configService);
    try {
      await this.redis.connect();
      this.logger.log('Conexão com Redis estabelecida (blacklist de tokens)');
    } catch (error) {
      this.logger.error('Erro ao conectar com Redis:', error);
    }
  }

  // Adiciona token à blacklist com TTL em segundos
  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    try {
      const key = `${this.PREFIX}${this.hashToken(token)}`;
      await this.redis.setex(key, ttlSeconds, '1');
      this.logger.debug(`Token adicionado à blacklist (TTL: ${ttlSeconds}s)`);
    } catch {
      this.logger.warn('Redis indisponível — token não pôde ser adicionado à blacklist');
    }
  }

  // Verifica se token está na blacklist
  async isBlacklisted(token: string): Promise<boolean> {
    try {
      const key = `${this.PREFIX}${this.hashToken(token)}`;
      const result = await this.redis.get(key);
      return result !== null;
    } catch {
      // Redis indisponível — assume token não está na blacklist
      return false;
    }
  }

  // Hash do token para não armazenar o token completo no Redis
  private hashToken(token: string): string {
    const crypto = require('crypto') as typeof import('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Remove token da blacklist (raramente necessário)
  async removeFromBlacklist(token: string): Promise<void> {
    const key = `${this.PREFIX}${this.hashToken(token)}`;
    await this.redis.del(key);
  }
}
