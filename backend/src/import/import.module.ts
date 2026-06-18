import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { AuthModule } from '../auth/auth.module';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    AuthModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
