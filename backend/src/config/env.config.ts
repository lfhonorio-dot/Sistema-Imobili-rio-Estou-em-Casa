// Configuração e validação de variáveis de ambiente com Zod
// Garante que todas as variáveis obrigatórias estejam presentes na inicialização

import { z } from 'zod';

// Schema de validação das variáveis de ambiente
const envSchema = z.object({
  // Aplicação
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Banco de dados
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_URL: z.string().optional(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Segurança / Criptografia
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY deve ter exatamente 64 caracteres hex (256 bits)'),
  HMAC_SECRET: z.string().min(32, 'HMAC_SECRET deve ter pelo menos 32 caracteres'),

  // E-mail
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().default('Plataforma Imobiliária'),
  SMTP_FROM_EMAIL: z.string().email().optional(),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minio_senha_segura'),
  MINIO_BUCKET_NAME: z.string().default('plataforma-imobiliaria'),
  MINIO_PUBLIC_URL: z.string().optional(),

  // Rate Limiting
  THROTTLE_GLOBAL_TTL: z.coerce.number().default(60),
  THROTTLE_GLOBAL_LIMIT: z.coerce.number().default(100),
  THROTTLE_AUTH_TTL: z.coerce.number().default(60),
  THROTTLE_AUTH_LIMIT: z.coerce.number().default(10),

  // Logs
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  LOG_TO_FILE: z.coerce.boolean().default(true),
  LOG_DIR: z.string().default('./logs'),

  // LGPD
  LGPD_RESPONSE_DEADLINE_DAYS: z.coerce.number().default(15),
  DPO_EMAIL: z.string().email().optional(),
});

// Tipo inferido do schema
export type EnvConfig = z.infer<typeof envSchema>;

// Função de validação chamada pelo ConfigModule
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${errors}`);
  }

  return result.data;
}
