import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@film.com' })
  email: string;

  @ApiProperty({ example: 'admin123' })
  password: string;
}
