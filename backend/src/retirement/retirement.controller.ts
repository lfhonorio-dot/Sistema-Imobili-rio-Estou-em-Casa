import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { RetirementService } from './retirement.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('retirement')
@UseGuards(JwtAuthGuard)
export class RetirementController {
  constructor(private service: RetirementService) {}

  @Get()
  getPlan(@Request() req: any) { return this.service.getPlan(req.user.id); }

  @Post()
  savePlan(@Request() req: any, @Body() body: any) { return this.service.upsertPlan(req.user.id, body); }

  @Get('simulation')
  simulate(@Request() req: any) { return this.service.simulate(req.user.id); }

  @Get('rebalance')
  rebalance(@Request() req: any) { return this.service.rebalance(req.user.id); }
}
