// Serviço de criptografia AES-256-GCM
// Usado para cifrar dados sensíveis antes de salvar no banco

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService implements OnModuleInit {
  private encryptionKey!: Buffer;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;   // 128 bits para AES-GCM
  private readonly TAG_LENGTH = 16;  // 128 bits de autenticação

  constructor(private configService: ConfigService) {}

  onModuleInit(): void {
    // Converte a chave hex de 64 chars para 32 bytes
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');
    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY inválida. Deve ter 64 caracteres hexadecimais (256 bits).',
      );
    }
    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  // Cifra um texto em AES-256-GCM e retorna base64: iv:tag:ciphertext
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.encryptionKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    // Formato: iv(hex):tag(hex):ciphertext(hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  // Decifra um texto no formato iv:tag:ciphertext
  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Formato de dados cifrados inválido.');
    }

    const [ivHex, tagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  // Gera hash SHA-256 irreversível (para anonimização LGPD)
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Gera bytes aleatórios criptograficamente seguros
  generateSecureBytes(length: number): Buffer {
    return crypto.randomBytes(length);
  }

  // Gera token URL-safe aleatório
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
