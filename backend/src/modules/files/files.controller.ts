// Entrega de arquivos por URL assinada (pública, mas só com assinatura
// HMAC válida e dentro da validade). Usado por <img> e downloads, que não
// conseguem enviar o cabeçalho Authorization.

import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Public()
  @Get(':id')
  async download(
    @Param('id') id: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    const file = await this.files.getSigned(id, exp, sig);
    const disposition = download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('Content-Disposition', `${disposition}; filename="${file.fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(Buffer.from(file.data));
  }
}
