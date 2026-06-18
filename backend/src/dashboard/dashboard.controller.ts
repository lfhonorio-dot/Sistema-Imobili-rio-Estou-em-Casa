import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get()
  getDashboard(@Request() req: any) {
    return this.service.getDashboard(req.user.id);
  }

  @Get('alerts')
  getAlerts(@Request() req: any) {
    return this.service.getAlerts(req.user.id);
  }
}
