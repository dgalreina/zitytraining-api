import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { Role, UserStatus } from '../users/users.schema';
import { RefreshToken } from './refresh-token.schema';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshToken>,
  ) {}

  private async issueTokens(user: { _id: any; email?: string; roles: Role[] }) {
    const payload = { sub: user._id, email: user.email, roles: user.roles };
    const access_token = this.jwtService.sign(payload);

    const refreshTokenRaw = crypto.randomBytes(32).toString('hex');
    await this.refreshTokenModel.create({
      user: user._id,
      tokenHash: hashToken(refreshTokenRaw),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return { access_token, refresh_token: refreshTokenRaw };
  }

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
      throw new UnauthorizedException('Tu cuenta está inhabilitada');
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

    const tokens = await this.issueTokens(user);

    return {
      ...tokens,
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

  // Rotacion: el refresh token usado se borra y se emite uno nuevo junto
  // con el access token. Si alguien reutiliza uno ya rotado (robado o
  // duplicado), no encuentra nada valido y falla, en vez de servir un
  // token viejo indefinidamente.
  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const existing = await this.refreshTokenModel.findOne({ tokenHash });

    if (!existing || existing.expiresAt.getTime() < Date.now()) {
      // TODO: quitar este log de depuración cuando se confirme que el refresco funciona bien.
      console.log('[refresh-token] intento con token invalido o caducado');
      throw new UnauthorizedException('Sesión caducada, inicia sesión de nuevo');
    }

    const user = await this.usersService.findOne(existing.user.toString()).catch(() => null);
    if (!user || user.status !== UserStatus.ACTIVE) {
      await existing.deleteOne();
      // TODO: quitar este log de depuración cuando se confirme que el refresco funciona bien.
      console.log('[refresh-token] usuario ya no valido, se rechaza el refresco');
      throw new UnauthorizedException('Sesión caducada, inicia sesión de nuevo');
    }

    await existing.deleteOne();
    // TODO: quitar este log de depuración cuando se confirme que el refresco funciona bien.
    console.log(`[refresh-token] rotado correctamente para ${user.email || user._id} a las ${new Date().toISOString()}`);
    return this.issueTokens(user);
  }

  // Revoca el refresh token al cerrar sesion. Si ya no existe (caducado,
  // ya usado) no pasa nada, el resultado que le importa al cliente es
  // el mismo: dejar de poder usarlo.
  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenModel.deleteOne({ tokenHash: hashToken(refreshToken) });
  }
}
