import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProyectoService {
  constructor(private prisma: PrismaService) {}

  // CREAR PROYECTO (Vinculado al usuario)
  async create(createProyectoDto: CreateProyectoDto, userId: number) {
    const { puestos, ...proyectoData } = createProyectoDto;

    return this.prisma.proyecto.create({
      data: {
        ...proyectoData,
        userId, // El dueño del proyecto
        // Magia de Prisma: Crea los puestos en la tabla relacionada automáticamente
        puestos: {
          create: puestos,
        },
      },
      include: { puestos: true }, // Devolvemos el resultado completo
    });
  }

  // VER TODOS
  findAll() {
    return this.prisma.proyecto.findMany({
      include: {
        puestos: true,
        user: { select: { nombre: true, email: true } }, // Traemos datos del creador
      },
      orderBy: { createdAt: 'desc' }, // Los más nuevos primero
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
    await this.findOneMine(id, userId, role);
    const { puestos, ...proyectoData } = updateProyectoDto;
    const dataToUpdate: any = { ...proyectoData };

    if (puestos) {
      dataToUpdate.puestos = {
        deleteMany: {},
        create: puestos,
      };
    }
    return this.prisma.proyecto.update({
      where: { id },
      data: dataToUpdate,
      include: { puestos: true },
    });
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
