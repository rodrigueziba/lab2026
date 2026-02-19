import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerAuthDto: RegisterAuthDto) {
    // Pasamos el OBJETO entero, no las variables sueltas
    return this.authService.register(registerAuthDto);
  }

  @Post('login')
  login(@Body() loginAuthDto: LoginAuthDto) {
    // Pasamos el OBJETO entero
    return this.authService.login(loginAuthDto);
  }
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  // 1. RUTA PARA INICIAR (Lleva a Google)
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    // No hace nada, el Guard redirige automáticamente
  }

  // 2. RUTA DE RETORNO (Vuelve de Google)
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
    // req.user ya tiene el token generado por AuthService
    const { access_token, user } = req.user;
    
    // Redirigimos al Frontend (puerto 3001) pasando el token en la URL
    // Usamos encodeURIComponent para que los datos viajen seguros
    const userData = encodeURIComponent(JSON.stringify(user));
    
    res.redirect(`http://localhost:3001/login?token=${access_token}&user=${userData}`);
  }
}
