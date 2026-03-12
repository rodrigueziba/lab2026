import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificacionService } from 'src/notificacion/notificacion.service';

@Injectable()
export class ProyectoService {
  constructor(
    private prisma: PrismaService,
    private notificacionService: NotificacionService,
  ) {}

  // CREAR PROYECTO (Vinculado al usuario)
  async create(createProyectoDto: CreateProyectoDto, userId: number) {
    const { puestos, ...proyectoData } = createProyectoDto;
    const puestosData = puestos && puestos.length > 0 ? puestos : [{ nombre: 'Sin especificar', descripcion: '' }];

    const created = await this.prisma.proyecto.create({
      data: {
        ...proyectoData,
        esBorrador: proyectoData.esBorrador ?? false,
        esPlantilla: proyectoData.esPlantilla ?? false,
        userId,
        puestos: { create: puestosData },
      },
      include: { puestos: true },
    });

    if (!created.esBorrador && !created.esPlantilla) {
      await this.notifyMatchingPrestadores(created.id);
    }
    return created;
  }

  // Cartelera pública: solo publicados (no borrador, no plantilla)
  findAll() {
    return this.prisma.proyecto.findMany({
      where: {
        esBorrador: false,
        esPlantilla: false,
      },
      include: {
        puestos: true,
        user: { select: { nombre: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Todos los proyectos del usuario (incluye borradores y plantillas)
  async findMyProjects(userId: number) {
    return this.prisma.proyecto.findMany({
      where: { userId },
      include: {
        puestos: true,
        user: { select: { nombre: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // VER UNO
  findOne(id: number) {
    return this.prisma.proyecto.findUnique({
      where: { id },
      include: {
        puestos: true,
        user: { select: { nombre: true, email: true } },
      },
    });
  }

  async findOneMine(id: number, userId: number, role?: string) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
    });

    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    // Comprobación clave: Si no es el dueño Y TAMPOCO es administrador, bloqueamos.
    if (proyecto.userId !== userId && role !== 'admin') {
      throw new ForbiddenException(
        'No tienes permiso para modificar este proyecto',
      );
    }

    return proyecto;
  }

  async update(
    id: number,
    updateProyectoDto: UpdateProyectoDto,
    userId: number,
    role?: string,
  ) {
    const existing = await this.prisma.proyecto.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Proyecto no encontrado');
    if (existing.userId !== userId && role !== 'admin') {
      throw new ForbiddenException('No tienes permiso para modificar este proyecto');
    }
    const { puestos, esBorrador, esPlantilla, ...rest } = updateProyectoDto;
    const dataToUpdate: any = { ...rest };
    // Solo actualizar esBorrador/esPlantilla si vienen explícitamente (evita que se oculten proyectos del listado)
    if (esBorrador !== undefined) dataToUpdate.esBorrador = esBorrador;
    if (esPlantilla !== undefined) dataToUpdate.esPlantilla = esPlantilla;

    if (puestos) {
      dataToUpdate.puestos = {
        deleteMany: {},
        create: puestos,
      };
    }
    const updated = await this.prisma.proyecto.update({
      where: { id },
      data: dataToUpdate,
      include: { puestos: true },
    });
    if (existing.esBorrador && updated.esBorrador === false && !updated.esPlantilla) {
      await this.notifyMatchingPrestadores(updated.id);
    }
    return updated;
  }

  async duplicate(id: number, userId: number) {
    const original = await this.prisma.proyecto.findUnique({
      where: { id },
      include: { puestos: true },
    });
    if (!original) throw new NotFoundException('Proyecto no encontrado');
    if (original.userId !== userId) {
      throw new ForbiddenException('Solo podés duplicar tus propios proyectos');
    }
    return this.prisma.proyecto.create({
      data: {
        titulo: `${original.titulo} (copia)`,
        descripcion: original.descripcion,
        tipo: original.tipo,
        estado: original.estado,
        foto: original.foto,
        fotoProfundidad: original.fotoProfundidad,
        ciudad: original.ciudad,
        referencias: original.referencias,
        galeria: original.galeria,
        fechaInicio: original.fechaInicio,
        fechaFin: original.fechaFin,
        esEstudiante: original.esEstudiante,
        esRemunerado: original.esRemunerado,
        esBorrador: true,
        esPlantilla: false,
        userId,
        puestos: { create: original.puestos.map((p) => ({ nombre: p.nombre, descripcion: p.descripcion })) },
      },
      include: { puestos: true },
    });
  }

  private async notifyMatchingPrestadores(proyectoId: number) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: { puestos: true },
    });
    if (!proyecto || proyecto.puestos.length === 0) return;
    const rubroConditions = proyecto.puestos.map((p) => ({
      rubro: { contains: p.nombre.substring(0, Math.min(4, p.nombre.length)), mode: 'insensitive' as const },
    }));
    const prestadores = await this.prisma.prestador.findMany({
      where: {
        OR: rubroConditions,
        ciudad: proyecto.ciudad,
      },
      select: { userId: true },
    });
    const userIds = [...new Set(prestadores.map((p) => p.userId))];
    for (const uid of userIds) {
      await this.notificacionService.crear(
        uid,
        '¡Nuevo proyecto en tu área!',
        `Una productora está buscando perfiles como el tuyo: "${proyecto.titulo}".`,
        `/proyectos/${proyectoId}`,
      );
    }
  }

  async remove(id: number, userId: number, role?: string) {
    await this.findOneMine(id, userId, role);
    return this.prisma.proyecto.delete({
      where: { id },
    });
  }

  async findMatches(proyectoId: number) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: { puestos: true },
    });

    if (!proyecto || proyecto.puestos.length === 0) return [];
    const orConditions = proyecto.puestos.map((p) => ({
      rubro: {
        contains: p.nombre.substring(0, 4),
        mode: 'insensitive' as const,
      },
    }));
    const candidatos = await this.prisma.prestador.findMany({
      where: {
        OR: orConditions,
      },
    });

    return candidatos;
  }
}
