import { Module } from '@nestjs/common';
import { MetaAdsModule } from './meta-ads/meta-ads.module';
import { GoogleAdsModule } from './google-ads/google-ads.module';
import { PortalsModule } from './portals/portals.module';

@Module({
  imports: [MetaAdsModule, GoogleAdsModule, PortalsModule],
})
export class MarketingModule {}
