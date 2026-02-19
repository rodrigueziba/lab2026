import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Ezequiel Admin' })
  nombre: string;

  @ApiProperty({ example: 'admin@film.com' })
  email: string;

  @ApiProperty({ example: 'admin123' })
  password: string;
}
