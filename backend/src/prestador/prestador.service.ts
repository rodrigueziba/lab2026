import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CreatePrestadorDto } from './dto/create-prestador.dto';
import { UpdatePrestadorDto } from './dto/update-prestador.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class PrestadorService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}


  async create(createPrestadorDto: CreatePrestadorDto, userId: number) {
    const { experiencias, fechaNacimiento, ...restData } = createPrestadorDto;

    return this.prisma.prestador.create({
      data: {
        ...restData,
        userId: userId,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
        experiencias: experiencias ? {
          create: experiencias
        } : undefined
      },
    });
  }

  async update(id: number, updatePrestadorDto: UpdatePrestadorDto, userId: number, role?: string) {
    await this.findOneMine(id, userId, role); // Pasamos el rol aquí también

    const { experiencias, fechaNacimiento, ...restData } = updatePrestadorDto;

    const dataToUpdate: any = {
      ...restData,
      fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : undefined,
    };

    if (experiencias) {
      dataToUpdate.experiencias = {
        deleteMany: {}, 
        create: experiencias
      };
    }

    return this.prisma.prestador.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async solicitarContacto(solicitanteId: number, prestadorId: number) {
    // a) Buscar Prestador y su Dueño (incluyendo email del usuario)
    const prestador = await this.prisma.prestador.findUnique({
      where: { id: prestadorId },
      include: { user: true } // Necesitamos el email del dueño
    });

    if (!prestador) throw new NotFoundException('El perfil profesional no existe.');

    // b) Evitar auto-solicitud
    if (prestador.userId === solicitanteId) {
      throw new BadRequestException('No puedes solicitar contacto a tu propio perfil.');
    }

    // c) Verificar solicitud previa
    const existente = await this.prisma.solicitudContacto.findFirst({
      where: { solicitanteId, prestadorId }
    });

    if (existente) {
      throw new BadRequestException('Ya has enviado una solicitud a este profesional.');
    }

    // d) Obtener datos del solicitante (para el email)
    const solicitante = await this.prisma.user.findUnique({ where: { id: solicitanteId } });

    // e) Crear Solicitud en DB
    const solicitud = await this.prisma.solicitudContacto.create({
      data: {
        solicitanteId,
        prestadorId,
        estado: 'Pendiente'
      }
    });

    // f) Crear Notificación interna (Campanita)
    await this.prisma.notificacion.create({
      data: {
        usuarioId: prestador.userId,
        titulo: 'Nueva Solicitud de Contacto',
        mensaje: `${solicitante.nombre} quiere contactar contigo por tu perfil "${prestador.nombre}".`,
        link: '/mis-perfiles/solicitudes',
        leida: false
      }
    });

    // g) ENVIAR EMAIL 📧 (Restaurado)
    try {
        // Ajusta el nombre del método según tu MailService
        await this.mailService.sendSolicitudContacto(
            prestador.user.email, // Destinatario (Dueño del perfil)
            prestador.nombre,     // Nombre del Perfil
            solicitante.nombre,   // Nombre del Interesado
            solicitante.email     // Email del Interesado
        );
    } catch (error) {
        console.error("Error enviando email de notificación:", error);
        // No lanzamos error para no bloquear la solicitud si falla el mail server
    }

    return { message: 'Solicitud enviada. Se ha notificado al profesional.' };
  }

  findAll() {
    return this.prisma.prestador.findMany({
      include: { 
        user: { select: { nombre: true } },
        experiencias: true 
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findAllByUser(userId: number) {
    return this.prisma.prestador.findMany({ 
      where: { userId },
      include: { experiencias: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOneMine(id: number, userId: number, role?: string) {
    const prestador = await this.prisma.prestador.findUnique({ 
      where: { id },
      include: { experiencias: true }
    });
    
    if (!prestador) throw new NotFoundException('Perfil no encontrado');
    
    // LA COMPROBACIÓN CLAVE: Si no es el dueño Y TAMPOCO es administrador, bloqueamos.
    if (prestador.userId !== userId && role !== 'admin') {
      throw new ForbiddenException('No tienes permiso para modificar este perfil');
    }
    
    return prestador;
  }

  // Detalle Público (Censurado si no está aprobado - Lógica simple por ahora)
  async findOne(id: number) {
    const prestador = await this.prisma.prestador.findUnique({
      where: { id },
      include: { experiencias: true }
    });
    if (!prestador) return null;

    // Aquí mantenemos la censura por defecto para la vista pública general
    return {
      ...prestador,
      email: '🔒 Solicitar contacto', 
      telefono: '🔒 Solicitar contacto',
      _emailReal: prestador.email,
    };
  }

  async remove(id: number, userId: number, role?: string) {
    await this.findOneMine(id, userId, role); // Pasamos el rol
    return this.prisma.prestador.delete({ where: { id } });
  }
}