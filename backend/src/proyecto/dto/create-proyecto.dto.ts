import { IsString, IsArray, IsOptional, ValidateNested, IsNotEmpty, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class CreatePuestoDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}

export class CreateProyectoDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsOptional()
  foto?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  referencias?: string[]; // Array de links

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  galeria?: string[]; // Array de fotos

  @IsDateString() // Valida que sea fecha ISO (2026-05-20)
  @IsOptional()
  fechaInicio?: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @IsBoolean()
  @IsOptional()
  esEstudiante?: boolean;

  @IsBoolean()
  @IsOptional()
  esRemunerado?: boolean;

  @IsString()
  @IsNotEmpty()
  ciudad: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePuestoDto)
  @IsOptional()
  puestos?: CreatePuestoDto[];
}
