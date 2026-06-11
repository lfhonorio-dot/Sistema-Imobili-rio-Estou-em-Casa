// Controller de WhatsApp
import {
  Controller, Get, Post, Put, Body, Query, Headers,
  UseGuards, HttpCode, HttpStatus, Res, Param,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { SaveWhatsAppConfigDto, SendWhatsAppMessageDto } from './whatsapp.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly service: WhatsAppService) {}

  // Rota pública — verificação do webhook pelo Meta
  @Get('webhook/:workspaceId')
  verifyWebhook(
    @Param('workspaceId') workspaceId: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    // Token de verificação configurado via env por enquanto
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || '';
    const result = this.service.verifyWebhook(mode, token, challenge, verifyToken);
    if (result) return res.status(200).send(result);
    return res.status(403).send('Forbidden');
  }

  // Rota pública — receber mensagens do Meta
  @Post('webhook/:workspaceId')
  @HttpCode(HttpStatus.OK)
  receiveWebhook(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
  ) {
    return this.service.handleWebhook(workspaceId, body);
  }

  // Rotas autenticadas
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('config')
  getConfig(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getConfig(workspaceId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Put('config')
  saveConfig(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: SaveWhatsAppConfigDto,
  ) {
    return this.service.saveConfig(workspaceId, dto);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('send')
  @HttpCode(HttpStatus.OK)
  sendMessage(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendWhatsAppMessageDto,
  ) {
    return this.service.sendMessage(workspaceId, user.sub, dto);
  }
}
