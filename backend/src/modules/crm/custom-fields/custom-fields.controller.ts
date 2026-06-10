// Controller de Campos Personalizados
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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { CustomFieldsService } from './custom-fields.service';
import {
  CreateCustomFieldDto,
  UpdateCustomFieldDto,
  CustomFieldQueryDto,
} from './custom-fields.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@ApiTags('custom-fields')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  findAll(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: CustomFieldQueryDto,
  ) {
    return this.customFieldsService.findAll(workspaceId, query);
  }

  @Post()
  create(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.customFieldsService.create(workspaceId, dto);
  }

  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFieldsService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.customFieldsService.remove(workspaceId, id);
  }
}
