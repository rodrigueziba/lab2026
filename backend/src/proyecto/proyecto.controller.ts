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
import { ProyectoService } from './proyecto.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { AuthGuard } from '@nestjs/passport'; // Seguridad
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

@ApiTags('Proyecto')
@Controller('proyecto')
export class ProyectoController {
  constructor(
    private readonly proyectoService: ProyectoService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // POST: Sugerir puestos/vacantes según sinopsis y tipo (IA)
  @Post('sugerir-puestos')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async sugerirPuestos(@Body() body: { descripcion?: string; tipo?: string }) {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY')?.trim();
    if (!apiKey) {
      console.warn('DEEPSEEK_API_KEY no configurada en .env');
      return { puestos: [], message: 'Configura DEEPSEEK_API_KEY en el backend para sugerir puestos con IA.' };
    }
    const descripcion = body.descripcion || '';
    const tipo = body.tipo || 'Cortometraje';
    if (!descripcion.trim()) {
      return { puestos: [], message: 'Escribí la sinopsis para que la IA sugiera vacantes.' };
    }

    const prompt = `Para un proyecto audiovisual de la Film Commission de Tierra del Fuego.
Tipo de producción: ${tipo}.
Sinopsis: ${descripcion}

Genera una lista de roles o puestos que suele necesitar este tipo de proyecto (equipo técnico y artístico). Responde SOLO con un JSON válido, un array de objetos con exactamente dos propiedades: "nombre" (string, nombre del rol en español, ej. "Director de fotografía") y "descripcion" (string breve opcional, ej. "Equipo propio"). Entre 4 y 12 puestos. Sin texto adicional, solo el JSON. Ejemplo: [{"nombre":"Director/a","descripcion":""},{"nombre":"Sonidista","descripcion":"Equipo propio"}]`;

    try {
      const res = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
        }),
      });
      const raw = await res.text();
      if (!res.ok) {
        console.error('DeepSeek API error:', res.status, raw);
        return { puestos: [], message: 'Error al conectar con la IA. Revisá la consola del backend.' };
      }
      let data: { choices?: Array<{ message?: { content?: string } }> };
      try {
        data = JSON.parse(raw);
      } catch {
        console.error('DeepSeek response no es JSON:', raw?.slice(0, 200));
        return { puestos: [], message: 'La IA devolvió una respuesta inválida.' };
      }
      const text = data?.choices?.[0]?.message?.content?.trim() || '';
      // Intentar extraer JSON del texto (puede venir con markdown)
      let puestos: Array<{ nombre: string; descripcion?: string }> = [];
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          puestos = JSON.parse(jsonMatch[0]);
          if (!Array.isArray(puestos)) puestos = [];
          puestos = puestos.map((p: { nombre?: string; descripcion?: string }) => ({
            nombre: typeof p.nombre === 'string' ? p.nombre : String(p.nombre || ''),
            descripcion: typeof p.descripcion === 'string' ? p.descripcion : '',
          }));
        } catch {
          puestos = [];
        }
      }
      return { puestos };
    } catch (e) {
      console.error('Error sugiriendo puestos con IA:', e);
      return { puestos: [], message: 'Error al conectar con la IA.' };
    }
  }

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
    @Request() req: any,
  ) {
    // Pasamos el ID del usuario y su rol al servicio
    return this.proyectoService.update(
      +id,
      updateProyectoDto,
      +req.user.userId,
      req.user.role,
    );
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
