import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt'; // Necesario para encriptar

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async update(id: number, updateUserDto: UpdateUserDto) {
    // 1. Si intenta cambiar el email, verificamos que no esté ocupado por otro
    if (updateUserDto.email) {
      const existe = await this.prisma.user.findUnique({ 
        where: { email: updateUserDto.email } 
      });
      // Si existe Y no es el mismo usuario (es otro robando el email)
      if (existe && existe.id !== id) {
        throw new ConflictException('Este email ya está en uso por otro usuario.');
      }
    }

    // 2. Si intenta cambiar el password, lo encriptamos
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // 3. Actualizamos
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }
  
  // Métodos placeholder que genera Nest (puedes dejarlos o borrarlos)
  create(dto: any) { return 'Acción no permitida'; }
  async findAll() { 
    return this.prisma.user.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc' // Los más recientes primero
      }
    }); 
  }


  async updateRole(id: number, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
      }
    });
  }
  findOne(id: number) { return this.prisma.user.findUnique({ where: { id } }); }
  remove(id: number) { return `This action removes a #${id} user`; }
}
