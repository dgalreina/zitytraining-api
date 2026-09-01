import { IsEmail, IsNotEmpty, MinLength, IsDateString } from 'class-validator';

export class CreateUserDto {
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
}