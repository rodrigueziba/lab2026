import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class CreateLocacionDto {
  @IsString()
  nombre: string;

  @IsString()
  ciudad: string;

  @IsString()
  categoria: string;

  @IsString()
  @IsOptional()
  subcategoria?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsOptional()
  accesibilidad?: string;

  @IsString()
  @IsOptional()
  foto?: string;

  @IsArray()
  @IsOptional()
  galeria?: string[];

  // 👇 AGREGAR ESTOS
  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;
}
