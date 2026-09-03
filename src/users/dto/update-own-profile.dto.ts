import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, Matches } from 'class-validator';
import { CreateUserByAdminDto } from './create-user-by-admin.dto';

export class UpdateOwnProfileDto extends PartialType(
  OmitType(CreateUserByAdminDto, ['password', 'roles'] as const),
) {
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe ser un código hexadecimal, ej. #6aa842' })
  color?: string;
}