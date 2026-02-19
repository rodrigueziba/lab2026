import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Verificamos si existe el usuario y si su rol es 'admin'
    if (user && user.role === 'admin') {
      return true; // ¡Adelante!
    }
    
    // Si no, error 403
    throw new ForbiddenException('✋ Acceso denegado: Esta zona es solo para Administradores de la Film Commission.');
  }
}
