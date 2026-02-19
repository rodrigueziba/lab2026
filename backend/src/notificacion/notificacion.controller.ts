import { Controller, Get, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { NotificacionService } from './notificacion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notificacion')
@UseGuards(JwtAuthGuard)
export class NotificacionController {
  constructor(private readonly notificacionService: NotificacionService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.notificacionService.findAllByUser(+req.user.userId);
  }

  @Get('badge') // Para el numerito rojo
  countUnread(@Req() req: any) {
    return this.notificacionService.contarNoLeidas(+req.user.userId);
  }

  @Patch(':id/leer')
  marcarLeida(@Param('id') id: string) {
    return this.notificacionService.marcarLeida(+id);
  }
}