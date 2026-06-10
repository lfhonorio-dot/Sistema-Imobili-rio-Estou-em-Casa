// Serviço de Tags - CRUD simples
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto, UpdateTagDto, TagQueryDto } from './tags.dto';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId: string, query: TagQueryDto) {
    const tags = await this.prisma.tag.findMany({
      where: {
        workspaceId,
        ...(query.module && { module: query.module }),
      },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { contacts: true, deals: true } },
      },
    });

    return tags;
  }

  async create(workspaceId: string, dto: CreateTagDto) {
    const tag = await this.prisma.tag.create({
      data: {
        workspaceId,
        name: dto.name,
        color: dto.color ?? '#6366f1',
        module: dto.module,
      },
    });

    return tag;
  }

  async update(workspaceId: string, id: string, dto: UpdateTagDto) {
    const tag = await this.prisma.tag.findFirst({ where: { id, workspaceId } });

    if (!tag) throw new NotFoundException('Tag não encontrada');

    const updated = await this.prisma.tag.update({
      where: { id },
      data: { ...dto },
    });

    return updated;
  }

  async remove(workspaceId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id, workspaceId } });

    if (!tag) throw new NotFoundException('Tag não encontrada');

    await this.prisma.tag.delete({ where: { id } });

    return { deleted: true };
  }
}
