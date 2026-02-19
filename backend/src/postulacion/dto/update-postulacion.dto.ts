import { PartialType } from '@nestjs/mapped-types';
import { CreatePostulacionDto } from './create-postulacion.dto';
import { IsString, IsOptional } from 'class-validator';

export class UpdatePostulacionDto extends PartialType(CreatePostulacionDto) {
    @IsString()
    @IsOptional()
    estado?: string;
}