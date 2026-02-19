import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificacionService {
  constructor(private prisma: PrismaService) {}

  // 1. Crear una notificación (Uso interno)
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

  // 2. Obtener mis notificaciones (Para el Frontend)
  async findAllByUser(usuarioId: number) {
    return this.prisma.notificacion.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      take: 20 // Traemos solo las últimas 20
    });
  }

  // 3. Marcar como leída
  async marcarLeida(id: number) {
    return this.prisma.notificacion.update({
      where: { id },
      data: { leida: true }
    });
  }

  // 4. Contar no leídas 
  async contarNoLeidas(usuarioId: number) {
    return this.prisma.notificacion.count({
      where: { usuarioId, leida: false }
    });
  }
}