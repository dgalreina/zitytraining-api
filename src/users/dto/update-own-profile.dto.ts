import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserByAdminDto } from './create-user-by-admin.dto';

export class UpdateOwnProfileDto extends PartialType(
  OmitType(CreateUserByAdminDto, ['password', 'roles', 'membershipNumber'] as const),
) {}