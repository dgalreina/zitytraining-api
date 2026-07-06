import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsArray, IsEnum, IsDateString, IsString } from 'class-validator';
import { Role } from '../users.schema';

export class CreateUserByAdminDto {
  @IsNotEmpty()
  firstName!: string;

  @IsNotEmpty()
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsEmail()
  email!: string;

  @MinLength(4)
  password!: string;

  @IsNotEmpty()
  phone!: string;

  @IsNotEmpty()
  address!: string;

  @IsArray()
  @IsEnum(Role, { each: true })
  roles!: Role[];

  @IsOptional()
  @IsString()
  membershipNumber?: string;
}