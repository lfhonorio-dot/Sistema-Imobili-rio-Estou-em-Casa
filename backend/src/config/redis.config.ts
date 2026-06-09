// Configuração do cliente Redis (ioredis)
// Usado para cache, blacklist de tokens e filas de processamento

import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

// Cria instância do Redis a partir das configurações de ambiente
export function createRedisClient(configService: ConfigService): IORedis {
  const redisUrl = configService.get<string>('REDIS_URL');

  if (redisUrl) {
    // Usar URL completa se disponível
    return new IORedis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
        if (times > 10) {
          console.error('Redis: número máximo de tentativas de reconexão atingido');
          return null;
        }
        // Backoff exponencial: 50ms, 100ms, 200ms, ...
        return Math.min(times * 50, 2000);
      },
    });
  }

  // Configuração por partes individuais
  return new IORedis({
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
    password: configService.get<string>('REDIS_PASSWORD'),
    db: configService.get<number>('REDIS_DB', 0),
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > 10) {
        console.error('Redis: número máximo de tentativas de reconexão atingido');
        return null;
      }
      return Math.min(times * 50, 2000);
    },
  });
}

// Opções de cache para o CacheModule
export const redisCacheOptions = {
  ttl: 300, // 5 minutos padrão
  max: 1000, // máximo de itens em cache
};
