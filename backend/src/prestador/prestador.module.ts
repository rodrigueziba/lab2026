import { Module } from '@nestjs/common';
import { PrestadorService } from './prestador.service';
import { PrestadorController } from './prestador.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [PrestadorController],
  providers: [PrestadorService, PrismaService], // <--- 2. Se la entregamos al módulo
})
export class PrestadorModule {}
