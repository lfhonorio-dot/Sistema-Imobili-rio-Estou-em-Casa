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
}

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

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      message = (resp['message'] as string | string[]) || exception.message;
      error = (resp['error'] as string) || HttpStatus[statusCode] || 'Error';
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
    };

    response.status(statusCode).json(errorResponse);
  }
}
