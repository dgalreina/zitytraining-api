import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
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
  //
  // Sin exigencias de fortaleza a propósito: esta es la contraseña que le
  // pone el admin al darle de alta, para que entre la primera vez. En
  // cuanto la cambia él mismo (o la recupera por correo) sí se le piden
  // mayúsculas, números y símbolo.
  @ValidateIf((o) => !o.roles?.includes(Role.CLIENT))
  @IsString()
  @IsNotEmpty({ message: 'Ponle una contraseña para que pueda entrar la primera vez' })
  password?: string;

  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsArray()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}
