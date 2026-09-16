import { Module } from '@nestjs/common';
import { PortalsController } from './portals.controller';
import { PortalsService } from './portals.service';
import { PortalsFeedService } from './portals-feed.service';
import { CrmModule } from '../../crm/crm.module';

@Module({
  imports: [CrmModule],
  controllers: [PortalsController],
  providers: [PortalsService, PortalsFeedService],
  exports: [PortalsService],
})
export class PortalsModule {}
