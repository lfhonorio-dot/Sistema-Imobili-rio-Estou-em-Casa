// Controller de Imóveis - rotas REST
// Gerencia: CRUD, fotos, status, duplicação, QR code

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
import { PropertiesService } from './properties.service';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyQueryDto,
  ChangeStatusDto,
  AddPhotosDto,
  ReorderPhotosDto,
} from './properties.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';

@ApiTags('properties')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  // GET /properties - lista com filtros e paginação
  @Get()
  findAll(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: PropertyQueryDto,
  ) {
    return this.propertiesService.findAll(workspaceId, query);
  }

  // POST /properties - cria novo imóvel
  @Post()
  create(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.propertiesService.create(workspaceId, dto, user.sub);
  }

  // GET /properties/:id - detalhe completo
  // Sugestão de preço por comparáveis (mediana do preço/m²)
  @Get(':id/price-suggestion')
  priceSuggestion(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.propertiesService.priceSuggestion(workspaceId, id);
  }

  @Get(':id')
  findOne(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.propertiesService.findOne(workspaceId, id);
  }

  // PATCH /properties/:id - atualiza imóvel
  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.propertiesService.update(workspaceId, id, dto, user.sub);
  }

  // DELETE /properties/:id - soft delete
  @Delete(':id')
  remove(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.propertiesService.remove(workspaceId, id, user.sub);
  }

  // PATCH /properties/:id/status - altera status
  @Patch(':id/status')
  changeStatus(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.propertiesService.changeStatus(workspaceId, id, dto, user.sub);
  }

  // POST /properties/:id/photos - adiciona fotos
  @Post(':id/photos')
  addPhotos(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: AddPhotosDto,
  ) {
    return this.propertiesService.addPhotos(workspaceId, id, dto);
  }

  // DELETE /properties/:id/photos/:photoId - remove foto
  @Delete(':id/photos/:photoId')
  removePhoto(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.propertiesService.removePhoto(workspaceId, id, photoId);
  }

  // PATCH /properties/:id/photos/reorder - reordena fotos
  @Patch(':id/photos/reorder')
  reorderPhotos(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: ReorderPhotosDto,
  ) {
    return this.propertiesService.reorderPhotos(workspaceId, id, dto);
  }

  // GET /properties/:id/duplicate - duplica imóvel
  @Get(':id/duplicate')
  duplicateProperty(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.propertiesService.duplicateProperty(workspaceId, id, user.sub);
  }

  // GET /properties/:id/qrcode - gera QR code
  @Get(':id/qrcode')
  generateQrCode(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.propertiesService.generateQrCode(workspaceId, id);
  }
}
