// Ponto de entrada da aplicação NestJS
// Configura segurança, validação, documentação e inicia o servidor

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import * as express from 'express';
import { WinstonModule } from 'nest-winston';
import { createWinstonLogger } from './config/logger.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  // Cria a aplicação NestJS com logger Winston personalizado
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(createWinstonLogger()),
  });

  // -----------------------------------------------
  // Segurança: Helmet com CSP configurado para produção
  // -----------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // Compressão Gzip das respostas
  app.use(compression());

  // Limite de tamanho de requisição (10MB)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // -----------------------------------------------
  // CORS configurado explicitamente (whitelist de origens)
  // -----------------------------------------------
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id'],
  });

  // Prefixo global da API com versionamento
  app.setGlobalPrefix('api/v1');

  // -----------------------------------------------
  // Validação global de DTOs com class-validator
  // -----------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Remove campos não declarados no DTO
      forbidNonWhitelisted: true,   // Rejeita requisições com campos extras
      transform: true,              // Transforma tipos automaticamente
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Filtros e interceptors globais
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // -----------------------------------------------
  // Documentação Swagger (apenas em desenvolvimento)
  // -----------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Plataforma Imobiliária API')
      .setDescription(
        'CRM + ERP Imobiliário - API Documentation\n\n' +
        'Estágio 1: Fundação, Segurança e Conformidade LGPD',
      )
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Workspace-Id' }, 'workspace-id')
      .addTag('auth', 'Autenticação e autorização')
      .addTag('users', 'Gestão de usuários e membros')
      .addTag('workspace', 'Configurações do workspace')
      .addTag('lgpd', 'Conformidade LGPD - consentimentos e direitos dos titulares')
      .addTag('audit', 'Logs de auditoria')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = process.env.APP_PORT || 3001;
  await app.listen(port);

  console.log(`Servidor rodando em: http://localhost:${port}/api/v1`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Documentação Swagger: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((err) => {
  console.error('Erro fatal ao iniciar a aplicação:', err);
  process.exit(1);
});
