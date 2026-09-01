import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '../../users/users.schema';

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
    });
  }

  async validate(payload: any) {
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

    // Esto es lo que Nest inyectará en `req.user`
    return {
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles,
    };
  }
}