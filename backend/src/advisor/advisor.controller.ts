import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AdvisorService } from './advisor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('advisor')
@UseGuards(JwtAuthGuard)
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Post('analyze')
  analyze(@Req() req: any) {
    return this.advisorService.generateAnalysis(req.user.id);
  }

  @Get('analyses')
  list(@Req() req: any) {
    return this.advisorService.listAnalyses(req.user.id);
  }

  @Get('analyses/:id')
  get(@Param('id') id: string, @Req() req: any) {
    return this.advisorService.getAnalysis(id, req.user.id);
  }

  @Post('analyses/:id/chat')
  chat(@Param('id') id: string, @Body() body: { question: string }, @Req() req: any) {
    return this.advisorService.chat(id, body.question, req.user.id);
  }

  @Post('chat')
  quickChat(@Body() body: { question: string }, @Req() req: any) {
    return this.advisorService.quickChat(body.question, req.user.id);
  }

  @Get('usage')
  usage(@Req() req: any) {
    return this.advisorService.getUsage(req.user.id);
  }
}
