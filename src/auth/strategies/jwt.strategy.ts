import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '../../users/users.schema';

// Lo único que puede hacer alguien que todavía arrastra la contraseña que
// le puso el admin: mirar quién es y cambiarla. Todo lo demás se le
// rechaza hasta que elija una suya.
const PERMITIDO_SIN_CAMBIAR = [
  { method: 'PATCH', path: '/users/me/password' },
  { method: 'GET', path: '/users/me' },
];

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
      // Hace falta el request para saber a dónde va la petición y dejar
      // pasar solo el cambio de contraseña.
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    // Se consulta el usuario en cada request (no solo el payload firmado) para que
    // un cambio de estado/roles hecho por un admin surta efecto de inmediato,
    // sin esperar a que expire el token ya emitido.
    let user;
    try {
      user = await this.usersService.findOne(payload.sub);
    } catch {
      throw new UnauthorizedException();
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tu cuenta ya no está activa');
    }

    if (user.mustChangePassword) {
      const ruta = (req.originalUrl || req.url || '').split('?')[0];
      const permitido = PERMITIDO_SIN_CAMBIAR.some(
        (r) => r.method === req.method && r.path === ruta,
      );
      if (!permitido) {
        // 403 y no 401 a propósito: con un 401 el frontend da la sesión
        // por caducada y lo devuelve al login, que es justo de donde
        // viene.
        throw new ForbiddenException('Tienes que cambiar tu contraseña antes de seguir');
      }
    }

    // Esto es lo que Nest inyectará en `req.user`
    return {
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
