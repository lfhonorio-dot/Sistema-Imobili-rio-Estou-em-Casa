import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { CashFlowService } from './cash-flow.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cash-flow')
@UseGuards(JwtAuthGuard)
export class CashFlowController {
  constructor(private service: CashFlowService) {}

  @Get()
  findAll(@Request() req: any, @Query() q: { month?: string; year?: string; type?: string }) {
    return this.service.findAll(req.user.id, q);
  }

  @Get('summary')
  getMonthlySummary(@Request() req: any, @Query() q: { month?: string; year?: string }) {
    const now = new Date();
    return this.service.getMonthlySummary(
      req.user.id,
      q.month ? parseInt(q.month) : now.getMonth() + 1,
      q.year ? parseInt(q.year) : now.getFullYear(),
    );
  }

  @Get('evolution')
  getEvolution(@Request() req: any) {
    return this.service.getEvolution(req.user.id);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.id, body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
