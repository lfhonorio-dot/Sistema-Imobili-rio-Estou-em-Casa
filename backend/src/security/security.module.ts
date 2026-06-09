// Módulo de segurança - agrupa serviços de criptografia, HMAC e blacklist
// Exportado para uso em outros módulos

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { HmacService } from './hmac.service';
import { TokenBlacklistService } from './token-blacklist.service';

@Module({
  imports: [ConfigModule],
  providers: [EncryptionService, HmacService, TokenBlacklistService],
  exports: [EncryptionService, HmacService, TokenBlacklistService],
})
export class SecurityModule {}
