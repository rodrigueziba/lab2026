import { Injectable, ForbiddenException } from '@nestjs/common';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { UpdatePostulacionDto } from './dto/update-postulacion.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificacionService } from 'src/notificacion/notificacion.service';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class PostulacionService {
  constructor(
    private prisma: PrismaService,
    private notificacionService: NotificacionService,
    private mailService: MailService // 📧 Inyectamos servicio de email
  ) {}

  async create(createPostulacionDto: CreatePostulacionDto, userId: number) {
    const existe = await this.prisma.postulacion.findFirst({
      where: {
        puestoId: createPostulacionDto.puestoId,
        postulanteId: userId
      }
    });

    if (existe) {
      throw new Error("Ya te has postulado a este puesto.");
    }

    const nuevaPostulacion = await this.prisma.postulacion.create({
      data: {
        proyectoId: createPostulacionDto.proyectoId,
        puestoId: createPostulacionDto.puestoId,
        mensaje: createPostulacionDto.mensaje,
        prestadorId: createPostulacionDto.prestadorId ?? null,
        postulanteId: userId,
        estado: 'Pendiente',
      },
    });

    // Buscamos el proyecto para saber quién es el dueño (userId)
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: createPostulacionDto.proyectoId }
    });

    if (proyecto) {
      // A. Notificación Interna (Campana)
      await this.notificacionService.crear(
        proyecto.userId, // ID del Productor
        "Nueva Postulación 📬",
        `Alguien se ha postulado para trabajar en "${proyecto.titulo}".`,
        `/mis-proyectos/candidatos/${proyecto.id}` // Link directo a la gestión
      );

      // B. Enviar Email al Productor 📧
      // Necesitamos buscar el email del productor
      const productor = await this.prisma.user.findUnique({
        where: { id: proyecto.userId }
      });

      if (productor && productor.email) {
        await this.mailService.enviarCorreo(
          productor.email,
          `Nueva Postulación: ${proyecto.titulo}`,
          `
            <div style="font-family: sans-serif; color: #333;">
              <h2 style="color: #ea580c;">¡Tienes un nuevo candidato! 🎬</h2>
              <p>Alguien se ha postulado para el puesto en tu proyecto <strong>${proyecto.titulo}</strong>.</p>
              <p>Ingresa a la plataforma para revisar su perfil y decidir.</p>
              <a href="http://localhost:3001/mis-proyectos/candidatos/${proyecto.id}" style="background-color: #ea580c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Candidatos</a>
            </div>
          `
        );
      }
    }

    return nuevaPostulacion;
  }

  async update(id: number, updatePostulacionDto: UpdatePostulacionDto, userId?: number) {
    if (userId != null) {
      const postulacion = await this.prisma.postulacion.findUnique({
        where: { id },
        include: { proyecto: { select: { userId: true } } },
      });
      if (!postulacion?.proyecto || postulacion.proyecto.userId !== userId) {
        throw new ForbiddenException('No tenés permiso para gestionar esta postulación.');
      }
    }
    const postulacionActualizada = await this.prisma.postulacion.update({
      where: { id },
      data: {
        estado: updatePostulacionDto.estado,
      },
      include: {
        proyecto: true,
        postulante: true // <--- IMPORTANTE: Traemos al postulante para tener su email
      }
    });

    if (updatePostulacionDto.estado === 'Aceptada') {
      
      // A. Notificación Interna (Campana)
      await this.notificacionService.crear(
        postulacionActualizada.postulanteId, // ID del Talento
        "¡Has sido Aceptado! 🎉",
        `¡Felicidades! Te han seleccionado para el proyecto "${postulacionActualizada.proyecto.titulo}".`,
        `/mis-postulaciones` // Link para que vea el estado
      );

      // B. Enviar Email al Talento 📧
      if (postulacionActualizada.postulante && postulacionActualizada.postulante.email) {
        await this.mailService.enviarCorreo(
          postulacionActualizada.postulante.email,
          `¡Fuiste Seleccionado! 🎉 - ${postulacionActualizada.proyecto.titulo}`,
          `
            <div style="font-family: sans-serif; color: #333;">
              <h2 style="color: #059669;">¡Felicidades! 🌟</h2>
              <p>Has sido aceptado para participar en el proyecto <strong>${postulacionActualizada.proyecto.titulo}</strong>.</p>
              <p>El productor pronto se pondrá en contacto contigo. Revisa tus postulaciones para más detalles.</p>
              <a href="http://localhost:3001/mis-postulaciones" style="background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Mis Postulaciones</a>
            </div>
          `
        );
      }
    }

    return postulacionActualizada;
  }

  async findAllByProject(proyectoId: number) {
    console.log(`🔎 Buscando postulaciones para Proyecto ID: ${proyectoId}`);

    const postulaciones = await this.prisma.postulacion.findMany({
      where: { proyectoId: proyectoId },
      include: {
        postulante: {
          select: { id: true, nombre: true, email: true } // Traemos email para la lógica
        },
        puesto: true
      }
    });

    console.log(`✅ Encontradas: ${postulaciones.length}`);

    // MÁSCARA DE PRIVACIDAD
    // Si no está aceptada, ocultamos el email real.
    return postulaciones.map(p => {
      if (p.estado !== 'Aceptada') {
        return {
          ...p,
          postulante: {
            ...p.postulante,
            email: '🔒 Contacto Oculto (Aceptar para ver)'
          }
        };
      }
      return p;
    });
  }


  async findAllByUser(userId: number) {
    return this.prisma.postulacion.findMany({
      where: { postulanteId: userId },
      include: {
        proyecto: true,
        puesto: true,
        prestador: { select: { id: true, nombre: true, rubro: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async marcarVista(id: number) {
    return this.prisma.postulacion.update({
      where: { id },
      data: { estado: 'Vista' },
    });
  }

  findAll() { return `This action returns all postulacion`; }
  findOne(id: number) { return `This action returns a #${id} postulacion`; }
  remove(id: number) { return `This action removes a #${id} postulacion`; }
}
