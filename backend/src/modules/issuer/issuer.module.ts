import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IssuerController } from './issuer.controller';
import { IssuerService } from './issuer.service';

// Global: todo módulo que emite documento usa IssuerService.getCurrentSnapshot().
@Global()
@Module({
  imports: [AuditModule],
  controllers: [IssuerController],
  providers: [IssuerService],
  exports: [IssuerService],
})
export class IssuerModule {}
