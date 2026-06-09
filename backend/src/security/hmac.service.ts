// Serviço HMAC-SHA256 para assinatura e verificação de integridade
// Usado para verificar integridade de dados e fingerprinting

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class HmacService implements OnModuleInit {
  private hmacSecret!: string;

  constructor(private configService: ConfigService) {}

  onModuleInit(): void {
    const secret = this.configService.get<string>('HMAC_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('HMAC_SECRET inválido. Mínimo de 32 caracteres.');
    }
    this.hmacSecret = secret;
  }

  // Gera assinatura HMAC-SHA256 de uma string
  sign(data: string): string {
    return crypto
      .createHmac('sha256', this.hmacSecret)
      .update(data)
      .digest('hex');
  }

  // Verifica assinatura HMAC usando comparação em tempo constante
  verify(data: string, signature: string): boolean {
    const expectedSignature = this.sign(data);
    // Comparação em tempo constante para evitar timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }

  // Gera fingerprint de sessão a partir de informações do cliente
  generateSessionFingerprint(
    userAgent: string,
    ipAddress: string,
    additionalData?: string,
  ): string {
    const data = [userAgent, ipAddress, additionalData || ''].join('|');
    return this.sign(data);
  }

  // Verifica fingerprint de sessão
  verifySessionFingerprint(
    userAgent: string,
    ipAddress: string,
    storedFingerprint: string,
    additionalData?: string,
  ): boolean {
    const generated = this.generateSessionFingerprint(
      userAgent,
      ipAddress,
      additionalData,
    );
    try {
      return crypto.timingSafeEqual(
        Buffer.from(generated, 'hex'),
        Buffer.from(storedFingerprint, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
