import { IsArray, IsDateString, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsMongoId()
  trainer!: string;

  @IsArray()
  @IsMongoId({ each: true })
  clients!: string[];

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}