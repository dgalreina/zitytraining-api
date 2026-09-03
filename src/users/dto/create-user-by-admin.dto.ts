import {
  IsEmail,
  IsNotEmpty,
  IsStrongPassword,
  IsArray,
  IsEnum,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Role } from '../users.schema';

export class CreateUserByAdminDto {
  @IsNotEmpty()
  firstName!: string;

  @IsNotEmpty()
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  // Obligatorio para admin/entrenador; para un cliente es opcional (no
  // puede entrar en la app todavía), pero si se da igualmente tiene que
  // tener forma de email.
  @ValidateIf((o) => !o.roles?.includes(Role.CLIENT) || !!o.email)
  @IsEmail()
  email?: string;

  // Solo hace falta para admin/entrenador, que sí pueden entrar en la
  // app; un cliente no necesita contraseña.
  @ValidateIf((o) => !o.roles?.includes(Role.CLIENT))
  @IsStrongPassword(
    { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 },
    {
      message:
        'La contraseña debe tener al menos 8 caracteres, con mayúsculas, minúsculas, números y algún símbolo',
    },
  )
  password?: string;

  @IsNotEmpty()
  phone!: string;

  @IsNotEmpty()
  address!: string;

  @IsArray()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}
