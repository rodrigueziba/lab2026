import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { MailService } from 'src/mail/mail.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  private async generateToken(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      },
    };
  }

  async register(registerAuthDto: RegisterAuthDto) {
    const { email, password, nombre } = registerAuthDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nombre,
        role: 'user',
      },
    });
  }

  async login(loginAuthDto: LoginAuthDto) {
    const { email, password } = loginAuthDto;
    
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generateToken(user);
  }

  async validateGoogleUser(googleUser: any) {
    const { email, firstName, lastName, picture, googleId } = googleUser;

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      if (!user.googleId) {
         await this.prisma.user.update({
            where: { id: user.id },
            data: { googleId }
         });
      }
      return this.generateToken(user);
    }
    console.log(`Creando usuario nuevo de Google: ${email}`);
    
    const randomPassword = uuidv4();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const newUser = await this.prisma.user.create({
      data: {
        email,
        nombre: `${firstName} ${lastName || ''}`.trim(),
        password: hashedPassword,
        googleId: googleId,
        avatar: picture,
        role: 'user'
      },
    });

    return this.generateToken(newUser);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('No existe un usuario con este email.');

    const token = uuidv4();
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry
      }
    });

    const resetLink = `http://localhost:3001/reset-password?token=${token}`; 
    
    await this.mailService.enviarCorreo(
      user.email,
      'Recuperar Contraseña - TDF Film 🔑',
      `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Recuperación de Cuenta</h1>
          <p>Has solicitado restablecer tu contraseña. Haz clic aquí:</p>
          <a href="${resetLink}">Restablecer Contraseña</a>
        </div>
      `
    );

    return { message: 'Correo enviado.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) throw new BadRequestException('Token inválido.');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    return { message: 'Contraseña actualizada.' };
  }
}