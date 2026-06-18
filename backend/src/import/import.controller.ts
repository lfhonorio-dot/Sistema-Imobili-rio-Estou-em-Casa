import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('import')
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private service: ImportService) {}

  @Get('logs')
  getLogs(@Request() req: any) { return this.service.getLogs(req.user.id); }

  @Get('rules')
  getRules(@Request() req: any) { return this.service.getRules(req.user.id); }

  @Post('rules')
  createRule(@Request() req: any, @Body() body: any) { return this.service.createRule(req.user.id, body); }

  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) { return this.service.deleteRule(id); }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@Request() req: any, @UploadedFile() file: Express.Multer.File, @Body() body: any) {
    return this.service.processUpload(req.user.id, file, body.source);
  }

  @Post(':logId/confirm')
  confirmImport(@Request() req: any, @Param('logId') logId: string, @Body() body: { entries: any[] }) {
    return this.service.confirmImport(req.user.id, logId, body.entries);
  }

  @Post(':logId/rollback')
  rollback(@Param('logId') logId: string) { return this.service.rollback(logId); }
}
