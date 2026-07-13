import { IsOptional, IsEnum } from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserByAdminDto } from './create-user-by-admin.dto';
import { UserStatus } from '../users.schema';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserByAdminDto, ['password'] as const),
) {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}