import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SecurityModule } from '../../../security/security.module';
import { EmailModule } from '../../hub/email/email.module';
import { PaymentsModule } from '../financial/payments.module';
import { NfseController } from './nfse.controller';
import { NfseService } from './nfse.service';
import { NfseConfigService } from './nfse-config.service';
import { SilAbrasf24Provider } from './sil-abrasf24.provider';

@Module({
  imports: [PrismaModule, SecurityModule, EmailModule, PaymentsModule],
  controllers: [NfseController],
  providers: [NfseService, NfseConfigService, SilAbrasf24Provider],
  exports: [NfseService, NfseConfigService],
})
export class NfseModule {}
