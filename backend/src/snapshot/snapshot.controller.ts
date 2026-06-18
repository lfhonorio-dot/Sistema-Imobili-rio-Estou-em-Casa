import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { SnapshotService } from './snapshot.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('snapshots')
@UseGuards(JwtAuthGuard)
export class SnapshotController {
  constructor(private service: SnapshotService) {}

  @Get()
  getAll(@Request() req: any) { return this.service.getAll(req.user.id); }

  @Post()
  createSnapshot(@Request() req: any) { return this.service.createSnapshot(req.user.id); }
}
