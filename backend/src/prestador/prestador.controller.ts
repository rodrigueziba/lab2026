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
import { ConfigService } from '@nestjs/config';
import { PrestadorService } from './prestador.service';
import { CreatePrestadorDto } from './dto/create-prestador.dto';
import { UpdatePrestadorDto } from './dto/update-prestador.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

@ApiTags('Prestador')
@Controller('prestador')
export class PrestadorController {
  constructor(
    private readonly prestadorService: PrestadorService,
    private readonly config: ConfigService,
  ) {}

  @Post('generar-bio-ia')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async generarBioIA(@Body() data: any) {
    const { nombre, fechaNacimiento, formacion, experiencias, rubro, tipoPerfil } = data;
    const edad = fechaNacimiento ? new Date().getFullYear() - new Date(fechaNacimiento).getFullYear() : 'no indicada';
    const expTexto = Array.isArray(experiencias) && experiencias.length > 0
      ? experiencias.map((e: { proyecto?: string; anio?: string; rol?: string }) => `${e.proyecto || 'Proyecto'} (${e.anio || '—'}), rol: ${e.rol || '—'}`).join('. ')
      : 'Sin experiencia previa registrada';
    const prompt = `Escribe una presentación profesional en primera persona (máximo 80 palabras, tono serio y conciso) para un perfil de la Film Commission de Tierra del Fuego. Incluye estos datos: Nombre: ${nombre}. Tipo de perfil: ${tipoPerfil || 'Profesional'}. Rubro principal: ${rubro}. Edad: ${edad}. Formación académica: ${formacion || 'Autodidacta'}. Experiencia previa: ${expTexto}. No repitas literalmente la lista; redacta una biografía fluida que integre nombre, edad, formación, tipo de perfil, rubro y experiencia.`;

    const geminiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        return { bio: result.response.text() };
      } catch (e1) {
        try {
          const genAI = new GoogleGenerativeAI(geminiKey);
          const model2 = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
          const result2 = await model2.generateContent(prompt);
          return { bio: result2.response.text() };
        } catch (e2) {
          console.warn('Gemini falló, intentando DeepSeek...');
        }
      }
    }

    const deepseekKey = this.config.get<string>('DEEPSEEK_API_KEY')?.trim();
    if (!deepseekKey) {
      console.warn('DEEPSEEK_API_KEY no configurada en .env');
      return { bio: `Soy ${nombre}, profesional en ${rubro}.` };
    }
    try {
      const res = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 250,
        }),
      });
      const raw = await res.text();
      if (!res.ok) {
        console.error('DeepSeek API error:', res.status, raw);
        return { bio: `Soy ${nombre}, profesional en ${rubro}.`, error: `IA: ${res.status}` };
      }
      const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data?.choices?.[0]?.message?.content?.trim() || '';
      if (text) return { bio: text };
    } catch (e) {
      console.error('DeepSeek request failed:', e);
    }
    return { bio: `Soy ${nombre}, profesional en ${rubro}.` };
  }

  @Post('solicitar-contacto/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async solicitarContacto(@Param('id') id: string, @Request() req: any) {
    return this.prestadorService.solicitarContacto(+req.user.userId, +id);
  }

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