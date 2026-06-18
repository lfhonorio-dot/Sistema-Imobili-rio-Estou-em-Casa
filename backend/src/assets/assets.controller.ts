import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private service: AssetsService) {}

  @Get()
  findAll(@Query() query: { type?: string; broker?: string; search?: string }) {
    return this.service.findAll(query);
  }

  @Get('summary')
  getSummary() {
    return this.service.getSummary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/dividends')
  addDividend(@Param('id') id: string, @Body() body: any) {
    return this.service.addDividend(id, body);
  }

  @Get(':id/dividends')
  getDividends(@Param('id') id: string) {
    return this.service.getDividends(id);
  }
}
