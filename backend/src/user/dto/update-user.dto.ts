import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  email?: string;
  password?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
}
