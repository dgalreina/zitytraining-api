import { IsOptional, IsEnum, Matches } from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserByAdminDto } from './create-user-by-admin.dto';
import { UserStatus } from '../users.schema';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserByAdminDto, ['password'] as const),
) {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe ser un código hexadecimal, ej. #6aa842' })
  color?: string;
}