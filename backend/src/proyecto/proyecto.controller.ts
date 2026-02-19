import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ProyectoService } from './proyecto.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { AuthGuard } from '@nestjs/passport'; // Seguridad
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Proyecto')
@Controller('proyecto')
export class ProyectoController {
  constructor(private readonly proyectoService: ProyectoService) {}

  // POST: Crear Proyecto (Protegido 🔒)
  @Post()
  @UseGuards(AuthGuard('jwt')) 
  @ApiBearerAuth()
  create(@Body() createProyectoDto: CreateProyectoDto, @Request() req) {
    // req.user viene del token JWT. Ahí está el ID del usuario.
    return this.proyectoService.create(createProyectoDto, req.user.userId);
  }

  // GET: Ver Todos (Público 🌍)
  @Get()
  findAll() {
    return this.proyectoService.findAll();
  }

  // GET: Ver Uno (Público 🌍)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proyectoService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt')) 
  @ApiBearerAuth()
  update(
    @Param('id') id: string, 
    @Body() updateProyectoDto: UpdateProyectoDto, 
    @Request() req: any
  ) {
    // Pasamos el ID del usuario y su rol al servicio
    return this.proyectoService.update(+id, updateProyectoDto, +req.user.userId, req.user.role);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt')) 
  @ApiBearerAuth()
  remove(@Param('id') id: string, @Request() req: any) {
    // Pasamos el ID del usuario y su rol al servicio
    return this.proyectoService.remove(+id, +req.user.userId, req.user.role);
  }

  // Endpoint para obtener coincidencias inteligentes
  @Get(':id/matches')
  findMatches(@Param('id') id: string) {
    return this.proyectoService.findMatches(+id);
  }
}
