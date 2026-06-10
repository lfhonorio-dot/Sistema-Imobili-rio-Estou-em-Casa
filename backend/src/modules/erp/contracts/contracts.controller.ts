// Controller de Contratos - rotas REST

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import {
  CreateContractDto,
  UpdateContractDto,
  ContractQueryDto,
  ChangeContractStatusDto,
  GenerateInstallmentsDto,
} from './contracts.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';

@ApiTags('contracts')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: ContractQueryDto,
  ) {
    return this.contractsService.findAll(workspaceId, query);
  }

  @Post()
  create(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateContractDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contractsService.create(workspaceId, dto, user.sub);
  }

  @Get('expiring')
  findExpiring(@Headers('x-workspace-id') workspaceId: string) {
    return this.contractsService.findExpiring(workspaceId);
  }

  @Get(':id')
  findOne(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.contractsService.findOne(workspaceId, id);
  }

  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contractsService.update(workspaceId, id, dto, user.sub);
  }

  @Delete(':id')
  remove(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contractsService.remove(workspaceId, id, user.sub);
  }

  @Patch(':id/status')
  changeStatus(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: ChangeContractStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contractsService.changeStatus(workspaceId, id, dto, user.sub);
  }

  @Post(':id/generate-installments')
  generateInstallments(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: GenerateInstallmentsDto,
  ) {
    return this.contractsService.generateInstallments(workspaceId, id, dto);
  }

  @Get(':id/statement')
  getStatement(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.contractsService.getStatement(workspaceId, id);
  }
}
