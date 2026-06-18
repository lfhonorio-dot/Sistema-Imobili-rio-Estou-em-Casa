import { Module } from '@nestjs/common';
import { RetirementController } from './retirement.controller';
import { RetirementService } from './retirement.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RetirementController],
  providers: [RetirementService],
})
export class RetirementModule {}
