// Configuração do Winston logger com mascaramento de dados sensíveis
// Dados como CPF, email, telefone e tokens são ofuscados nos logs

import * as winston from 'winston';

// Padrões de dados sensíveis para mascarar
const SENSITIVE_PATTERNS = [
  // CPF: 000.000.000-00 ou 00000000000
  { pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replacement: '***.***.***-**' },
  // E-mail
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: (match: string) => {
      const [local, domain] = match.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    },
  },
  // Telefone brasileiro: (XX) XXXXX-XXXX ou similar
  { pattern: /\(?(\d{2})\)?\s*\d{4,5}[-\s]?\d{4}\b/g, replacement: '(**) *****-****' },
  // JWT tokens (Bearer xxx.yyy.zzz)
  {
    pattern: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
    replacement: 'Bearer [REDACTED]',
  },
  // Campos de senha em JSON
  {
    pattern: /"(password|passwordHash|senha|secret|token|refreshToken|twoFactorSecret)"\s*:\s*"[^"]+"/g,
    replacement: '"$1":"[REDACTED]"',
  },
  // Chaves API / secrets em texto
  {
    pattern: /(api_key|apikey|api-key|secret|password|passwd|pwd)\s*[=:]\s*\S+/gi,
    replacement: '$1=[REDACTED]',
  },
];

// Função de mascaramento de dados sensíveis
function maskSensitiveData(message: string): string {
  let masked = message;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    if (typeof replacement === 'string') {
      masked = masked.replace(pattern, replacement);
    } else {
      masked = masked.replace(pattern, replacement as (match: string) => string);
    }
  }
  return masked;
}

// Formato customizado com mascaramento
const maskingFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = maskSensitiveData(info.message);
  }
  if (info.stack && typeof info.stack === 'string') {
    info.stack = maskSensitiveData(info.stack);
  }
  return info;
});

// Criação da instância do logger Winston
export function createWinstonLogger(): winston.LoggerOptions {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logDir = process.env.LOG_DIR || './logs';
  const logToFile = process.env.LOG_TO_FILE !== 'false';

  const transports: winston.transport[] = [
    // Console com cores em desenvolvimento
    new winston.transports.Console({
      format: winston.format.combine(
        maskingFormat(),
        winston.format.timestamp({ format: 'DD/MM/YYYY HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context, trace }) => {
          return `[${timestamp}] [${level}]${context ? ` [${context}]` : ''} ${message}${
            trace ? `\n${trace}` : ''
          }`;
        }),
      ),
    }),
  ];

  // Adiciona transporte para arquivo se habilitado
  if (logToFile) {
    // Log de erros em arquivo separado
    transports.push(
      new winston.transports.File({
        filename: `${logDir}/error.log`,
        level: 'error',
        format: winston.format.combine(
          maskingFormat(),
          winston.format.timestamp(),
          winston.format.json(),
        ),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
    );

    // Log combinado
    transports.push(
      new winston.transports.File({
        filename: `${logDir}/combined.log`,
        format: winston.format.combine(
          maskingFormat(),
          winston.format.timestamp(),
          winston.format.json(),
        ),
        maxsize: 20 * 1024 * 1024, // 20MB
        maxFiles: 10,
      }),
    );
  }

  return {
    level: logLevel,
    transports,
  };
}
