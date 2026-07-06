import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserByAdminDto } from './create-user-by-admin.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserByAdminDto, ['password'] as const),
) {}