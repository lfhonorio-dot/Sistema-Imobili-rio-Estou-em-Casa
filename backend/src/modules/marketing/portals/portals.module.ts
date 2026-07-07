import { Module } from '@nestjs/common';
import { PortalsController } from './portals.controller';
import { PortalsService } from './portals.service';
import { PortalsFeedService } from './portals-feed.service';

@Module({
  controllers: [PortalsController],
  providers: [PortalsService, PortalsFeedService],
  exports: [PortalsService],
})
export class PortalsModule {}
