import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PrestadorService } from './prestador.service';
import { CreatePrestadorDto } from './dto/create-prestador.dto';
import { UpdatePrestadorDto } from './dto/update-prestador.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GoogleGenerativeAI } from '@google/generative-ai';

@ApiTags('Prestador')
@Controller('prestador')
export class PrestadorController {
  constructor(private readonly prestadorService: PrestadorService) {}

 // ... imports

  @Post('generar-bio-ia')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async generarBioIA(@Body() data: any) {
    const { nombre, fechaNacimiento, formacion, experiencias, rubro } = data;
    const edad = fechaNacimiento ? new Date().getFullYear() - new Date(fechaNacimiento).getFullYear() : '';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { bio: "Error: Falta API Key." };

    const genAI = new GoogleGenerativeAI(apiKey); 
    
    // Prompt limpio
    const prompt = `Escribe una presentación profesional (1ra persona, max 60 palabras, tono serio) para ${nombre}. Rubro: ${rubro}. Edad: ${edad}. Formación: ${formacion || 'Autodidacta'}. Experiencia: ${JSON.stringify(experiencias)}.`;

    try {
      // INTENTO 1: Flash (Rápido)
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      return { bio: result.response.text() };
    } catch (e1) {
      console.warn("⚠️ Falló 1.5-flash");
      
      try {
        // INTENTO 2: 1.0 Pro (El más compatible)
        const model2 = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
        const result2 = await model2.generateContent(prompt);
        return { bio: result2.response.text() };
      } catch (e2) {
        console.warn("⚠️ Falló 1.0-pro, intentando legacy...");
        
        try {
            // INTENTO 3: Legacy (Pro a secas)
            const model3 = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result3 = await model3.generateContent(prompt);
            return { bio: result3.response.text() };
        } catch (e3) {
            console.error("❌ ERROR TOTAL IA:", e3.message);
            return { bio: `Soy ${nombre}, profesional en ${rubro}.` };
        }
      }
    }
  }
  // --- 2. ENDPOINT SOLICITAR CONTACTO  ---
  @Post('solicitar-contacto/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async solicitarContacto(@Param('id') id: string, @Request() req: any) {
    // req.user.userId es el solicitante
    // id es el ID del PRESTADOR
    return this.prestadorService.solicitarContacto(+req.user.userId, +id);
  }

  // --- 3. CRUD NORMAL ---

  @Get()
  findAll() {
    return this.prestadorService.findAll();
  }

  @Get('detalle/:id')
  findOne(@Param('id') id: string) {
    return this.prestadorService.findOne(+id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  create(@Body() createPrestadorDto: CreatePrestadorDto, @Request() req: any) {
    return this.prestadorService.create(createPrestadorDto, +req.user.userId);
  }

  @Get('mis-perfiles')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  findMyProfiles(@Request() req: any) {
    return this.prestadorService.findAllByUser(+req.user.userId);
  }

  @Get('mis-perfiles/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  findOneMine(@Param('id') id: string, @Request() req: any) {
    return this.prestadorService.findOneMine(+id, +req.user.userId);
  }

 @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  update(
    @Param('id') id: string,
    @Body() updatePrestadorDto: UpdatePrestadorDto,
    @Request() req: any
  ) {
    // AGREGAMOS req.user.role al final
    return this.prestadorService.update(+id, updatePrestadorDto, +req.user.userId, req.user.role);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  remove(@Param('id') id: string, @Request() req: any) {
    // AGREGAMOS req.user.role al final
    return this.prestadorService.remove(+id, +req.user.userId, req.user.role);
  }
}