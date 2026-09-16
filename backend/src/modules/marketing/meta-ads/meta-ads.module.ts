import { Module } from '@nestjs/common';
import { MetaAdsController } from './meta-ads.controller';
import { MetaAdsService } from './meta-ads.service';
import { CrmModule } from '../../crm/crm.module';

@Module({
  imports: [CrmModule],
  controllers: [MetaAdsController],
  providers: [MetaAdsService],
  exports: [MetaAdsService],
})
export class MetaAdsModule {}
