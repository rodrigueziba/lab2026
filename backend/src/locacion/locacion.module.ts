import { Module } from '@nestjs/common';
import { LocacionService } from './locacion.service';
import { LocacionController } from './locacion.controller';
import { PrismaService } from '../prisma/prisma.service'; // <--- Importar

@Module({
  controllers: [LocacionController],
  providers: [LocacionService, PrismaService], // <--- Agregar aquí
})
export class LocacionModule {}
