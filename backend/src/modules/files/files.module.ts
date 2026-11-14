import { Global, Module } from '@nestjs/common';
import { SecurityModule } from '../../security/security.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

// Global: imóveis, documentos e (no futuro) NFS-e usam o mesmo armazenamento.
@Global()
@Module({
  imports: [SecurityModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
