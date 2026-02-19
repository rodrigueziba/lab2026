import { Module } from '@nestjs/common';
import { ProyectoService } from './proyecto.service';
import { ProyectoController } from './proyecto.controller';
import { PrismaModule } from '../prisma/prisma.module'; // <--- Ruta relativa correcta

@Module({
  imports: [PrismaModule], // <--- Importamos el módulo
  controllers: [ProyectoController],
  providers: [ProyectoService],
})
export class ProyectoModule {}