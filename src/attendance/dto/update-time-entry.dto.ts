import { IsDateString, IsOptional } from 'class-validator';

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @IsOptional()
  @IsDateString()
  clockOut?: string;
}
