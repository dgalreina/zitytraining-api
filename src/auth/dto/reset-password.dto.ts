import { IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  // Mismas exigencias que al cambiarla desde el perfil.
  @IsStrongPassword(
    { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 },
    {
      message:
        'La contraseña debe tener al menos 8 caracteres, con mayúsculas, minúsculas, números y algún símbolo',
    },
  )
  newPassword!: string;
}
