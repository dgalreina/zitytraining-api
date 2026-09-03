import { IsString, IsStrongPassword } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsStrongPassword(
    { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 },
    {
      message:
        'La contraseña debe tener al menos 8 caracteres, con mayúsculas, minúsculas, números y algún símbolo',
    },
  )
  newPassword!: string;
}
