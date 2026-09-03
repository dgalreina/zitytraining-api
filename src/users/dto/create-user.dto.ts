import { IsEmail, IsNotEmpty, IsStrongPassword, IsDateString } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  firstName!: string;

  @IsNotEmpty()
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsEmail()
  email!: string;

  @IsStrongPassword(
    { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 },
    {
      message:
        'La contraseña debe tener al menos 8 caracteres, con mayúsculas, minúsculas, números y algún símbolo',
    },
  )
  password!: string;

  @IsNotEmpty()
  phone!: string;

  @IsNotEmpty()
  address!: string;
}