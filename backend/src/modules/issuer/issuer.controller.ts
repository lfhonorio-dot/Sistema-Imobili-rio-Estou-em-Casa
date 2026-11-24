import { Body, Controller, Get, Headers, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Access, ADMIN_ONLY, STAFF } from '../../common/access/access';
import { IssuerService } from './issuer.service';
import { ChangeIdentityDto, ChecklistItemDto } from './issuer.dto';

@ApiTags('issuer')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...STAFF)
@Controller('issuer')
export class IssuerController {
  constructor(private readonly issuer: IssuerService) {}

  // GET /issuer — dados vigentes + histórico + checklist
  @Get()
  async get(@Headers('x-workspace-id') workspaceId: string) {
    const [history, checklist] = await Promise.all([this.issuer.history(workspaceId), this.issuer.checklist(workspaceId)]);
    return { current: history.find((h) => !h.validTo) ?? null, history, checklist };
  }

  // POST /issuer/change — troca de CNPJ/razão social (encerra o vigente e cria outro)
  @Access(...ADMIN_ONLY)
  @Post('change')
  change(@Headers('x-workspace-id') workspaceId: string, @CurrentUser() user: JwtPayload, @Body() dto: ChangeIdentityDto) {
    return this.issuer.changeIdentity(workspaceId, user.sub, dto);
  }

  @Access(...ADMIN_ONLY)
  @Put('checklist')
  checklist(@Headers('x-workspace-id') workspaceId: string, @CurrentUser() user: JwtPayload, @Body() dto: ChecklistItemDto) {
    return this.issuer.setChecklistItem(workspaceId, user.sub, dto.key, dto.done);
  }
}
