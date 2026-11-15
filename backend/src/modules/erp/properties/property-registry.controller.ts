// Fase 2 — rotas dos cadastros do imóvel (proprietários, autorização de
// venda, chaves, histórico de preço, upload de fotos/documentos e
// clientes compatíveis).

import {
  Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { MAX_DOCUMENT_BYTES, UploadedFileInput } from '../../files/files.service';
import { PropertyRegistryService } from './property-registry.service';
import {
  AddOwnerDto, CancelAuthorizationDto, CreateAuthorizationDto, KeyMovementDto, UploadDocumentDto, UploadPhotoDto,
} from './property-registry.dto';

// Limite do multer um pouco acima do maior limite aceito; a mensagem
// amigável de "arquivo muito grande" vem do FilesService.
const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES + 1024 * 1024, files: 1 },
});

@ApiTags('properties')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('properties')
export class PropertyRegistryController {
  constructor(private readonly service: PropertyRegistryService) {}

  // Autorizações de venda vencendo (todas os imóveis do workspace)
  @Get('authorizations/expiring')
  expiring(@Headers('x-workspace-id') ws: string, @Query('days') days?: string) {
    const d = Math.min(Math.max(Number(days) || 30, 1), 180);
    return this.service.expiringAuthorizations(ws, d);
  }

  // Proprietários
  @Get(':id/owners')
  listOwners(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.listOwners(ws, id);
  }

  @Post(':id/owners')
  addOwner(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: AddOwnerDto, @CurrentUser() user: JwtPayload) {
    return this.service.addOwner(ws, id, dto, user.sub);
  }

  @Delete(':id/owners/:ownerId')
  removeOwner(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Param('ownerId') ownerId: string, @CurrentUser() user: JwtPayload) {
    return this.service.removeOwner(ws, id, ownerId, user.sub);
  }

  // Autorização de venda
  @Get(':id/authorizations')
  listAuthorizations(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.listAuthorizations(ws, id);
  }

  @Post(':id/authorizations')
  createAuthorization(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: CreateAuthorizationDto, @CurrentUser() user: JwtPayload) {
    return this.service.createAuthorization(ws, id, dto, user.sub);
  }

  @Patch(':id/authorizations/:authId/cancel')
  cancelAuthorization(
    @Headers('x-workspace-id') ws: string, @Param('id') id: string, @Param('authId') authId: string,
    @Body() dto: CancelAuthorizationDto, @CurrentUser() user: JwtPayload,
  ) {
    return this.service.cancelAuthorization(ws, id, authId, dto, user.sub);
  }

  // Chaves
  @Get(':id/keys')
  listKeys(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.listKeyMovements(ws, id);
  }

  @Post(':id/keys')
  keyMovement(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: KeyMovementDto, @CurrentUser() user: JwtPayload) {
    return this.service.registerKeyMovement(ws, id, dto, user.sub);
  }

  // Histórico de preço
  @Get(':id/price-history')
  priceHistory(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.listPriceHistory(ws, id);
  }

  // Upload de foto (multipart, campo "file")
  @Post(':id/photos/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(uploadInterceptor)
  uploadPhoto(
    @Headers('x-workspace-id') ws: string, @Param('id') id: string,
    @UploadedFile() file: UploadedFileInput, @Body() dto: UploadPhotoDto, @CurrentUser() user: JwtPayload,
  ) {
    return this.service.uploadPhoto(ws, id, file, dto, user.sub);
  }

  // Documentos (matrícula, IPTU, certidões...)
  @Get(':id/documents')
  listDocuments(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.listDocuments(ws, id);
  }

  @Post(':id/documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(uploadInterceptor)
  uploadDocument(
    @Headers('x-workspace-id') ws: string, @Param('id') id: string,
    @UploadedFile() file: UploadedFileInput, @Body() dto: UploadDocumentDto, @CurrentUser() user: JwtPayload,
  ) {
    return this.service.uploadDocument(ws, id, file, dto, user.sub);
  }

  @Delete(':id/documents/:documentId')
  removeDocument(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Param('documentId') documentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.removeDocument(ws, id, documentId, user.sub);
  }

  // Clientes compatíveis com o imóvel
  @Get(':id/matching-contacts')
  matchingContacts(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.matchingContacts(ws, id);
  }
}
