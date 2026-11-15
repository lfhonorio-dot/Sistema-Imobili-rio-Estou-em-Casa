// Armazenamento de arquivos (Fase 2): fotos de imóveis e documentos.
//
// Os arquivos ficam no próprio PostgreSQL (tabela stored_files), sem
// depender de um serviço externo. São servidos por URL assinada (HMAC) com
// validade curta — mesmo padrão stateless dos outros endpoints públicos
// (assinatura, portal do proprietário). Sem a assinatura válida, 403.

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { HmacService } from '../../security/hmac.service';

export interface UploadedFileInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export type FileKind = 'IMAGE' | 'DOCUMENT';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
/** Validade padrão dos links assinados: 2 horas. */
const DEFAULT_TTL_SECONDS = 2 * 60 * 60;

/** Prefixo gravado em PropertyPhoto.url / Document.url para arquivos internos. */
export const FILE_URL_PREFIX = 'file:';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private hmac: HmacService,
  ) {}

  validate(file: UploadedFileInput | undefined, kind: FileKind): asserts file is UploadedFileInput {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Nenhum arquivo foi enviado.');
    }
    const allowed = kind === 'IMAGE' ? IMAGE_TYPES : DOCUMENT_TYPES;
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        kind === 'IMAGE'
          ? 'Formato de imagem não aceito. Envie JPG, PNG ou WEBP.'
          : 'Formato não aceito. Envie PDF, JPG, PNG ou WEBP.',
      );
    }
    const max = kind === 'IMAGE' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
    if (file.size > max) {
      throw new BadRequestException(
        `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). O limite é ${max / 1024 / 1024} MB.`,
      );
    }
  }

  async store(workspaceId: string, file: UploadedFileInput, kind: FileKind, userId?: string) {
    this.validate(file, kind);
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    return this.prisma.storedFile.create({
      data: {
        workspaceId,
        fileName: sanitizeFileName(file.originalname),
        mimeType: file.mimetype,
        size: file.size,
        sha256,
        data: file.buffer,
        createdById: userId,
      },
      select: { id: true, fileName: true, mimeType: true, size: true },
    });
  }

  /** Fase 6: grava um arquivo gerado pelo próprio sistema (XML/PDF da NFS-e), sem a validação de upload. */
  async storeGenerated(workspaceId: string, buffer: Buffer, fileName: string, mimeType: string, userId?: string) {
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    return this.prisma.storedFile.create({
      data: { workspaceId, fileName: sanitizeFileName(fileName), mimeType, size: buffer.length, sha256, data: buffer, createdById: userId },
      select: { id: true, fileName: true, mimeType: true, size: true },
    });
  }

  /** Conteúdo de um arquivo do workspace (uso interno: anexos de e-mail). */
  async read(workspaceId: string, fileId: string) {
    const f = await this.prisma.storedFile.findFirst({ where: { id: fileId, workspaceId, deletedAt: null } });
    if (!f) throw new NotFoundException('Arquivo não encontrado.');
    return { fileName: f.fileName, mimeType: f.mimeType, data: Buffer.from(f.data) };
  }

  /** Caminho relativo assinado: /files/:id?exp=...&sig=... */
  signedPath(fileId: string, ttlSeconds = DEFAULT_TTL_SECONDS, now = Date.now()): string {
    const exp = Math.floor(now / 1000) + ttlSeconds;
    const sig = this.hmac.sign(`file:${fileId}:${exp}`);
    return `/files/${fileId}?exp=${exp}&sig=${sig}`;
  }

  /** Converte a url gravada ("file:<id>" ou URL externa) em URL utilizável. */
  resolveUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith(FILE_URL_PREFIX)) return this.signedPath(url.slice(FILE_URL_PREFIX.length));
    return url;
  }

  async getSigned(fileId: string, exp: string | undefined, sig: string | undefined, now = Date.now()) {
    const expNum = Number(exp);
    if (!exp || !sig || !Number.isFinite(expNum) || !/^[0-9a-f]{64}$/i.test(sig)) {
      throw new ForbiddenException('Link de arquivo inválido.');
    }
    if (expNum * 1000 < now) {
      throw new ForbiddenException('Link de arquivo expirado. Recarregue a página.');
    }
    if (!this.hmac.verify(`file:${fileId}:${expNum}`, sig)) {
      throw new ForbiddenException('Link de arquivo inválido.');
    }
    const file = await this.prisma.storedFile.findFirst({
      where: { id: fileId, deletedAt: null },
      select: { fileName: true, mimeType: true, size: true, data: true },
    });
    if (!file) throw new NotFoundException('Arquivo não encontrado.');
    return file;
  }

  async softDelete(workspaceId: string, fileId: string) {
    await this.prisma.storedFile.updateMany({
      where: { id: fileId, workspaceId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}

export function sanitizeFileName(name: string): string {
  const cleaned = (name || 'arquivo')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\- ]+/g, '_')
    .trim();
  return cleaned.slice(0, 120) || 'arquivo';
}
