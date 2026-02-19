import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { LocacionService } from './locacion.service';
import { CreateLocacionDto } from './dto/create-locacion.dto';
import { UpdateLocacionDto } from './dto/update-locacion.dto';
import { AuthGuard } from '@nestjs/passport'; // El guardia básico (¿estás logueado?)
import { AdminGuard } from 'src/auth/admin.guard'; // El guardia VIP (¿eres jefe?)
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Locacion')
@Controller('locacion')
export class LocacionController {
  constructor(private readonly locacionService: LocacionService) {}


  @Post()
  @UseGuards(AuthGuard('jwt'), AdminGuard) // <--- Doble seguridad
  @ApiBearerAuth()
  create(@Body() createLocacionDto: CreateLocacionDto) {
    return this.locacionService.create(createLocacionDto);
  }


  @Get()
  findAll() {
    return this.locacionService.findAll();
  }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locacionService.findOne(+id);
  }


  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() updateLocacionDto: UpdateLocacionDto) {
    return this.locacionService.update(+id, updateLocacionDto);
  }

  
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.locacionService.remove(+id);
  }
}