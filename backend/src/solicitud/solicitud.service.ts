import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SolicitudService {
  constructor(private prisma: PrismaService) {}

  async create(solicitanteId: number, prestadorId: number) {
    const existe = await this.prisma.solicitudContacto.findFirst({
      where: { solicitanteId, prestadorId }
    });
    
    if (existe) throw new BadRequestException('Ya has enviado una solicitud a este profesional.');
    const prestador = await this.prisma.prestador.findUnique({ where: { id: prestadorId } });
    if (!prestador) throw new NotFoundException('El perfil no existe');
    if (prestador.userId === solicitanteId) {
        throw new BadRequestException('No puedes solicitar contacto a tu propio perfil.');
    }

    const solicitud = await this.prisma.solicitudContacto.create({
      data: { solicitanteId, prestadorId, estado: 'Pendiente' }
    });

    await this.prisma.notificacion.create({
        data: {
            usuarioId: prestador.userId,
            titulo: 'Nueva Solicitud de Contacto',
            mensaje: 'Alguien quiere acceder a tus datos. Revisa tus solicitudes.',
            link: '/mis-perfiles/solicitudes',
            leida: false
        }
    });

    return solicitud;
  }

  async checkAccess(solicitanteId: number, prestadorId: number) {
    const solicitud = await this.prisma.solicitudContacto.findFirst({
      where: { solicitanteId, prestadorId }
    });

    if (solicitud && solicitud.estado === 'Aprobada') {
      const prestador = await this.prisma.prestador.findUnique({
        where: { id: prestadorId },
        select: { email: true, telefono: true }
      });
      return { status: 'Aprobada', datos: prestador };
    }

    return { status: solicitud ? solicitud.estado : 'Ninguna', datos: null };
  }

  async findMyRequests(userId: number) {
    const misPrestadores = await this.prisma.prestador.findMany({ 
        where: { userId },
        select: { id: true } 
    });
    
    const idsPrestadores = misPrestadores.map(p => p.id);

    return this.prisma.solicitudContacto.findMany({
      where: { prestadorId: { in: idsPrestadores } },
      include: { 
        solicitante: { 
            select: { 
                nombre: true, 
                email: true,
                prestadores: { take: 1, select: { id: true, foto: true } } 
            } 
        },
        prestador: { select: { nombre: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // 4. Aceptar/Rechazar y NOTIFICAR
  async updateStatus(id: number, estado: 'Aprobada' | 'Rechazada') {
    const solicitud = await this.prisma.solicitudContacto.update({
      where: { id },
      data: { estado },
      include: { prestador: true }
    });

    const titulo = estado === 'Aprobada' ? '¡Solicitud Aprobada! 🎉' : 'Solicitud Rechazada ❌';
    const mensaje = estado === 'Aprobada' 
        ? `Ya puedes ver los datos de contacto de ${solicitud.prestador.nombre}.`
        : `El profesional ${solicitud.prestador.nombre} ha rechazado tu solicitud.`;
    
    const link = estado === 'Aprobada' ? `/prestador/${solicitud.prestadorId}` : null;

    await this.prisma.notificacion.create({
        data: {
            usuarioId: solicitud.solicitanteId,
            titulo,
            mensaje,
            link,
            leida: false
        }
    });

    return solicitud;
  }
}