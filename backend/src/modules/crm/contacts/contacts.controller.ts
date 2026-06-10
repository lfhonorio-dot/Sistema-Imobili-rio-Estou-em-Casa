// Controller de Contatos - rotas REST
// Gerencia: CRUD, importação CSV, exportação, tags, timeline e merge

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
  Res,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactQueryDto,
  AddTagDto,
  MergeContactDto,
} from './contacts.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';

@ApiTags('contacts')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  // GET /contacts - lista com paginação e filtros
  @Get()
  @ApiOperation({ summary: 'Listar contatos com filtros e paginação' })
  findAll(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: ContactQueryDto,
  ) {
    return this.contactsService.findAll(workspaceId, query);
  }

  // GET /contacts/duplicates - lista possíveis duplicatas
  @Get('duplicates')
  @ApiOperation({ summary: 'Listar possíveis contatos duplicados' })
  findDuplicates(@Headers('x-workspace-id') workspaceId: string) {
    return this.contactsService.findDuplicates(workspaceId);
  }

  // GET /contacts/export - exporta CSV
  @Get('export')
  @ApiOperation({ summary: 'Exportar contatos como CSV' })
  async exportCsv(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const csv = await this.contactsService.exportCsv(workspaceId, user.sub, req.ip);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contatos.csv"');
    res.send(csv);
  }

  // POST /contacts/import - importa CSV
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Importar contatos via CSV' })
  importCsv(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingJson: string,
  ) {
    const mapping = mappingJson ? JSON.parse(mappingJson) as Record<string, string> : {};
    const content = file.buffer.toString('utf-8');
    return this.contactsService.importCsv(workspaceId, user.sub, content, mapping);
  }

  // GET /contacts/:id - detalhe do contato
  @Get(':id')
  @ApiOperation({ summary: 'Buscar contato por ID com relações completas' })
  findOne(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.contactsService.findOne(workspaceId, id);
  }

  // POST /contacts - cria contato
  @Post()
  @ApiOperation({ summary: 'Criar novo contato' })
  create(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.create(workspaceId, user.sub, dto);
  }

  // PATCH /contacts/:id - atualiza contato
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar contato' })
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(workspaceId, user.sub, id, dto);
  }

  // DELETE /contacts/:id - soft delete
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover contato (soft delete)' })
  remove(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.contactsService.remove(workspaceId, user.sub, id);
  }

  // POST /contacts/:id/tags - adiciona tag
  @Post(':id/tags')
  @ApiOperation({ summary: 'Adicionar tag ao contato' })
  addTag(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: AddTagDto,
  ) {
    return this.contactsService.addTag(workspaceId, id, dto.tagId);
  }

  // DELETE /contacts/:id/tags/:tagId - remove tag
  @Delete(':id/tags/:tagId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover tag do contato' })
  removeTag(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    return this.contactsService.removeTag(workspaceId, id, tagId);
  }

  // GET /contacts/:id/timeline - timeline de atividades
  @Get(':id/timeline')
  @ApiOperation({ summary: 'Timeline de atividades do contato' })
  getTimeline(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.contactsService.getTimeline(workspaceId, id);
  }

  // POST /contacts/:id/merge - merge de duplicatas
  @Post(':id/merge')
  @ApiOperation({ summary: 'Merge de contato duplicado no contato atual' })
  merge(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') targetId: string,
    @Body() dto: MergeContactDto,
  ) {
    return this.contactsService.mergeDuplicates(workspaceId, user.sub, targetId, dto.sourceId);
  }
}
