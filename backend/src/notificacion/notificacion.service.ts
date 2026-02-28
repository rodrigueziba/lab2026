import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificacionService {
  constructor(private prisma: PrismaService) {}

  async crear(usuarioId: number, titulo: String, mensaje: String, link?: string) {
    return this.prisma.notificacion.create({
      data: {
        usuarioId,
        titulo: String(titulo),
        mensaje: String(mensaje),
        link
      }
    });
  }

  async findAllByUser(usuarioId: number) {
    return this.prisma.notificacion.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  async marcarLeida(id: number) {
    return this.prisma.notificacion.update({
      where: { id },
      data: { leida: true }
    });
  }

  async contarNoLeidas(usuarioId: number) {
    return this.prisma.notificacion.count({
      where: { usuarioId, leida: false }
    });
  }
}