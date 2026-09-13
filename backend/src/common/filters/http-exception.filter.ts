// Filtro global de exceções HTTP
// Padroniza o formato de resposta de erros da API

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Interface de resposta padronizada de erro
interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
  // Campos extras vindos de exceções lançadas com corpo de objeto
  // (ex.: code, duplicates) — ver KNOWN_FIELDS abaixo.
  [extra: string]: unknown;
}

// Campos tratados explicitamente. O restante do corpo da exceção — quando ela é
// lançada com um objeto customizado, ex.:
// `throw new ConflictException({ message, code, duplicates })` — é repassado
// como veio, senão o frontend não teria como agir sobre esses dados.
const KNOWN_FIELDS = new Set(['statusCode', 'message', 'error']);

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = exception.getStatus();

    // Extrai mensagem da exceção
    const exceptionResponse = exception.getResponse();
    let message: string | string[];
    let error: string;
    let extraFields: Record<string, unknown> = {};

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      message = (resp['message'] as string | string[]) || exception.message;
      error = (resp['error'] as string) || HttpStatus[statusCode] || 'Error';
      extraFields = Object.fromEntries(
        Object.entries(resp).filter(([key]) => !KNOWN_FIELDS.has(key)),
      );
    } else {
      message = exception.message;
      error = HttpStatus[statusCode] || 'Error';
    }

    // Log do erro (sem dados sensíveis)
    if (statusCode >= 500) {
      this.logger.error(
        `[${statusCode}] ${request.method} ${request.path} - ${JSON.stringify(message)}`,
        exception.stack,
      );
    } else if (statusCode >= 400) {
      this.logger.warn(
        `[${statusCode}] ${request.method} ${request.path} - ${JSON.stringify(message)}`,
      );
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.path,
      ...extraFields,
    };

    response.status(statusCode).json(errorResponse);
  }
}
