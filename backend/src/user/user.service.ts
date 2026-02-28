import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async update(id: number, updateUserDto: UpdateUserDto) {
    if (updateUserDto.email) {
      const existe = await this.prisma.user.findUnique({ 
        where: { email: updateUserDto.email } 
      });
      if (existe && existe.id !== id) {
        throw new ConflictException('Este email ya está en uso por otro usuario.');
      }
    }
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }
  
  create(_dto: unknown) { return 'Acción no permitida'; }
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
        createdAt: 'desc'
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
