import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsArray, IsEnum } from 'class-validator';
import { Role } from '../users.schema';

export class CreateUserDto {
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @MinLength(4)
  password!: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  roles?: Role[];
}