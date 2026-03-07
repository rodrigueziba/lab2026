import { IsString, IsNotEmpty, IsOptional, IsArray, IsEmail, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

// Clase auxiliar para validar cada renglón de experiencia
export class ExperienciaDto {
  @IsString()
  @IsNotEmpty()
  proyecto: string;

  @IsString()
  @IsNotEmpty()
  anio: string;

  @IsString()
  @IsNotEmpty()
  rol: string;
}

export class CreatePrestadorDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  tipoPerfil: string;

  @IsString()
  @IsNotEmpty()
  rubro: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  web?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsString()
  @IsOptional()
  facebook?: string;

  @IsString()
  @IsOptional()
  twitter?: string;

  @IsString()
  @IsOptional()
  linkedin?: string;

  @IsString()
  @IsOptional()
  tiktok?: string;

  @IsString()
  @IsOptional()
  foto?: string;

  @IsString()
  @IsOptional()
  fotoProfundidad?: string;

  @IsString()
  @IsOptional()
  ciudad?: string;

  @IsString()
  @IsOptional()
  colorTema?: string;

  @IsString()
  @IsOptional()
  videoReel?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  galeria?: string[];

  @IsString()
  @IsOptional()
  formacion?: string;

  @IsDateString() // Valida formato YYYY-MM-DD
  @IsOptional()
  fechaNacimiento?: string;

  @IsArray()
  @ValidateNested({ each: true }) // Valida cada objeto dentro del array
  @Type(() => ExperienciaDto) // Convierte el JSON a la clase ExperienciaDto
  @IsOptional()
  experiencias?: ExperienciaDto[];
}
