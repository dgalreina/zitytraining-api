import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { Role, UserStatus } from '../users/users.schema';
import { RefreshToken } from './refresh-token.schema';
import { PasswordResetToken } from './password-reset-token.schema';
import { User } from '../users/users.schema';
import { MailService } from '../mail/mail.service';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
// Corto a propósito: un enlace que cambia la contraseña sin más pruebas
// no debería seguir sirviendo horas después de pedirlo.
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshToken>,
    @InjectModel(PasswordResetToken.name)
    private passwordResetModel: Model<PasswordResetToken>,
    @InjectModel(User.name) private userModel: Model<User>,
    private mailService: MailService,
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
        // Si sigue con la contraseña que le puso el admin, la app tiene
        // que llevarle a cambiarla antes de dejarle hacer nada.
        mustChangePassword: user.mustChangePassword,
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

  // Responde siempre lo mismo, exista el correo o no: si distinguiera,
  // cualquiera podría averiguar qué direcciones están dadas de alta
  // probando una a una.
  async forgotPassword(email: string): Promise<{ success: true }> {
    const user = await this.userModel.findOne({
      email: email.toLowerCase().trim(),
      status: UserStatus.ACTIVE,
    });

    // Sin contraseña es que nunca ha entrado (clientes dados de alta a
    // mano): no hay nada que recuperar.
    if (user && user.password) {
      const raw = crypto.randomBytes(32).toString('hex');

      // Solo vale el último enlace pedido: los anteriores dejan de servir.
      await this.passwordResetModel.deleteMany({ user: user._id });
      await this.passwordResetModel.create({
        user: user._id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      });

      const base = process.env.APP_URL || 'http://localhost:3000';
      const enlace = `${base}/reset-password?token=${raw}`;
      await this.mailService.send(
        user.email!,
        'Recuperar tu contraseña de ZityTraining',
        [
          `<p>Hola ${user.firstName},</p>`,
          '<p>Has pedido cambiar la contraseña de tu cuenta de ZityTraining.</p>',
          `<p><a href="${enlace}">Pulsa aquí para elegir una nueva</a></p>`,
          '<p>El enlace caduca en una hora y solo se puede usar una vez.</p>',
          '<p>Si no has sido tú, no hace falta que hagas nada: tu contraseña sigue igual.</p>',
        ].join(''),
        [
          `Hola ${user.firstName},`,
          '',
          'Has pedido cambiar la contraseña de tu cuenta de ZityTraining.',
          'Abre este enlace para elegir una nueva:',
          enlace,
          '',
          'El enlace caduca en una hora y solo se puede usar una vez.',
          'Si no has sido tú, no hace falta que hagas nada: tu contraseña sigue igual.',
        ].join('\n'),
      );
    }

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: true }> {
    const registro = await this.passwordResetModel.findOne({ tokenHash: hashToken(token) });
    if (!registro || registro.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('El enlace no es válido o ha caducado');
    }

    const user = await this.userModel.findById(registro.user);
    if (!user) {
      throw new UnauthorizedException('El enlace no es válido o ha caducado');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    // La ha elegido él por su cuenta, así que tampoco arrastra ya la del
    // admin.
    user.mustChangePassword = false;
    await user.save();

    // De un solo uso, y además se cierran las sesiones abiertas: si alguien
    // había entrado con la contraseña vieja, deja de tener acceso.
    await this.passwordResetModel.deleteMany({ user: user._id });
    await this.refreshTokenModel.deleteMany({ user: user._id });

    return { success: true };
  }
}
