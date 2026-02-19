import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class LocacionService {
  constructor(private prisma: PrismaService) {}

  create(data: Prisma.LocacionCreateInput) {
    return this.prisma.locacion.create({ data });
  }

  findAll() {
    return this.prisma.locacion.findMany();
  }

  findOne(id: number) {
    return this.prisma.locacion.findUnique({ where: { id } });
  }

  update(id: number, data: Prisma.LocacionUpdateInput) {
    return this.prisma.locacion.update({
      where: { id },
      data,
    });
  }

  remove(id: number) {
    return this.prisma.locacion.delete({ where: { id } });
  }
}
