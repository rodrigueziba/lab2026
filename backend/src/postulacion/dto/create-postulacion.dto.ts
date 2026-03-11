import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreatePostulacionDto {
  @IsInt()
  proyectoId: number;

  @IsInt()
  puestoId: number;

  @IsInt()
  @IsOptional()
  prestadorId?: number; // Perfil con el que se postula (opcional)

  @IsString()
  @IsOptional()
  mensaje?: string;
}