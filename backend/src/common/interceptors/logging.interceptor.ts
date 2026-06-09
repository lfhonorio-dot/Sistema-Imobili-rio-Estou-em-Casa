// Interceptor de logging de requisições
// Registra entrada/saída de todas as requisições com mascaramento de dados sensíveis

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, path, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const now = Date.now();

    // Log de entrada da requisição (mascarando dados sensíveis)
    this.logger.log(
      `→ ${method} ${path} | IP: ${this.maskIp(ip || '')} | UA: ${userAgent.substring(0, 50)}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const delay = Date.now() - now;
          this.logger.log(
            `← ${method} ${path} [${response.statusCode}] ${delay}ms`,
          );
        },
        error: (error: Error) => {
          const delay = Date.now() - now;
          this.logger.error(
            `← ${method} ${path} [ERROR] ${delay}ms - ${error.message}`,
          );
        },
      }),
    );
  }

  // Mascara parte do IP para privacidade
  private maskIp(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
    // IPv6: mostra apenas os primeiros segmentos
    if (ip.includes(':')) {
      const segments = ip.split(':');
      return `${segments[0]}:${segments[1]}:****`;
    }
    return ip;
  }
}
