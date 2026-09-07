import { IsDateString, IsOptional } from 'class-validator';

export class CreateManualEntryDto {
  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @IsOptional()
  @IsDateString()
  clockOut?: string;
}
