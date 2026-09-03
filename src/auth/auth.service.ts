import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { Role, UserStatus } from '../users/users.schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    // Sin password (típicamente un cliente, que no lo necesita) no hay
    // nada que comparar: bcrypt.compare fallaría igualmente con un hash
    // vacío, mejor cortar aquí con el mismo mensaje genérico de siempre.
    if (!user || !user.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tu cuenta aún no ha sido aprobada');
    }

    // Por ahora la app solo es para admin y entrenadores; los clientes
    // puros (sin ninguno de esos dos roles) no pueden entrar todavía.
    const canLogin = user.roles?.some(
      (role) => role === Role.ADMIN || role === Role.TRAINER,
    );
    if (!canLogin) {
      throw new UnauthorizedException(
        'Esta app todavía no está disponible para clientes',
      );
    }

    const payload = {
      sub: user._id,
      email: user.email,
      roles: user.roles,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: user.roles,
        color: user.color || null,
      },
    };
  }
}