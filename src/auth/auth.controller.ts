import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  // Sin JwtAuthGuard a propósito: el access token ya puede haber
  // caducado cuando se llama a esto, lo que autentica aquí es el
  // refresh token del body.
  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  async logout(@Body() body: RefreshTokenDto) {
    await this.authService.logout(body.refreshToken);
    return { success: true };
  }
}
