// Controller de Conversas — inbox multicanal
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  Headers, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import {
  CreateConversationDto, UpdateConversationDto, ConversationQueryDto,
  ChangeStatusDto, AssignDto, SendMessageDto,
} from './conversations.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';

@ApiTags('conversations')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  findAll(@Headers('x-workspace-id') workspaceId: string, @Query() query: ConversationQueryDto) {
    return this.service.findAll(workspaceId, query);
  }

  @Get('search')
  search(@Headers('x-workspace-id') workspaceId: string, @Query('q') q: string) {
    return this.service.searchMessages(workspaceId, q || '');
  }

  @Get('unread-count')
  unreadCount(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getUnreadCount(workspaceId);
  }

  @Post()
  create(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConversationDto,
  ) {
    return this.service.create(workspaceId, user.sub, dto);
  }

  @Get(':id')
  findOne(@Headers('x-workspace-id') workspaceId: string, @Param('id') id: string) {
    return this.service.findOne(workspaceId, id);
  }

  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.service.changeStatus(workspaceId, user.sub, id, dto);
  }

  @Patch(':id/assign')
  assign(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: AssignDto,
  ) {
    return this.service.assign(workspaceId, id, dto);
  }

  @Get(':id/messages')
  getMessages(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getMessages(workspaceId, id, Number(page) || 1, Number(limit) || 50);
  }

  @Post(':id/messages')
  sendMessage(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(workspaceId, user.sub, id, dto);
  }
}
