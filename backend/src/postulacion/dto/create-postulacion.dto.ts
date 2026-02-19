import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreatePostulacionDto {
  @IsInt()
  proyectoId: number;

  @IsInt()
  puestoId: number;

  @IsString()
  @IsOptional()
  mensaje?: string;
}