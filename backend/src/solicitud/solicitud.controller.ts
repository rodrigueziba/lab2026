import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { SolicitudService } from './solicitud.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('solicitud')
export class SolicitudController {
  constructor(private readonly solicitudService: SolicitudService) {}

  @UseGuards(JwtAuthGuard)
  @Post() // Crear solicitud
  create(@Body() body: { prestadorId: number }, @Req() req: any) {
    return this.solicitudService.create(+req.user.userId, body.prestadorId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check/:prestadorId') // Verificar estado y obtener datos si aprobado
  checkAccess(@Param('prestadorId') prestadorId: string, @Req() req: any) {
    return this.solicitudService.checkAccess(+req.user.userId, +prestadorId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recibidas') // Ver quién me quiere contactar
  findMyRequests(@Req() req: any) {
    return this.solicitudService.findMyRequests(+req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id') // Aceptar/Rechazar
  updateStatus(@Param('id') id: string, @Body() body: { estado: 'Aprobada' | 'Rechazada' }) {
    return this.solicitudService.updateStatus(+id, body.estado);
  }
}
