import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshToken, RefreshTokenSchema } from './refresh-token.schema';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: RefreshToken.name, schema: RefreshTokenSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        // Corto a propósito: la sesión de verdad la sostiene el refresh
        // token (30 días, ver refresh-token.schema.ts), que se renueva
        // solo desde el frontend sin pedir contraseña de nuevo.
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
