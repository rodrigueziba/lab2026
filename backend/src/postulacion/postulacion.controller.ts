import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { PostulacionService } from './postulacion.service';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { UpdatePostulacionDto } from './dto/update-postulacion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('postulacion')
export class PostulacionController {
  constructor(private readonly postulacionService: PostulacionService) {}

  // 🚨 IMPORTANTE: Este método DEBE ir antes de las rutas con :id
  @UseGuards(JwtAuthGuard)
  @Get('mis-postulaciones')
  findAllByUser(@Req() req: any) {
    return this.postulacionService.findAllByUser(+req.user.userId);
  }

  @Get('proyecto/:id')
  findAllByProject(@Param('id') id: string) {
    return this.postulacionService.findAllByProject(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createPostulacionDto: CreatePostulacionDto, @Req() req: any) {
    return this.postulacionService.create(createPostulacionDto, +req.user.userId);
  }


  @Get()
  findAll() {
    return this.postulacionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postulacionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePostulacionDto: UpdatePostulacionDto) {
    return this.postulacionService.update(+id, updatePostulacionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.postulacionService.remove(+id);
  }
}
