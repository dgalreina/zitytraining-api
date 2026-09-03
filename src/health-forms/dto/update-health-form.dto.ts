import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateHealthFormDto } from './create-health-form.dto';

export class UpdateHealthFormDto extends PartialType(
  OmitType(CreateHealthFormDto, ['client'] as const),
) {}
