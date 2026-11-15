import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, SupplierQueryDto, UpdateSupplierDto } from './suppliers.dto';
import { Access, ALL, STAFF, FINANCE_AREA, FINANCE_CONFIG, MANAGEMENT, ADMIN_ONLY } from '../../../common/access/access';

@ApiTags('suppliers')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...FINANCE_AREA)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  findAll(@Headers('x-workspace-id') ws: string, @Query() query: SupplierQueryDto) {
    return this.service.findAll(ws, query);
  }

  @Get(':id')
  findOne(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.findOne(ws, id);
  }

  @Post()
  create(@Headers('x-workspace-id') ws: string, @Body() dto: CreateSupplierDto) {
    return this.service.create(ws, dto);
  }

  @Patch(':id')
  update(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.update(ws, id, dto);
  }

  @Delete(':id')
  remove(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.remove(ws, id);
  }
}
