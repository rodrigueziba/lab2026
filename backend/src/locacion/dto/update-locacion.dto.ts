import { PartialType } from '@nestjs/swagger';
import { CreateLocacionDto } from './create-locacion.dto';

export class UpdateLocacionDto extends PartialType(CreateLocacionDto) {}
