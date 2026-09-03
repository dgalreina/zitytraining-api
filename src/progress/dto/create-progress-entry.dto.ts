import { IsDateString, IsMongoId, IsNumber, IsOptional } from 'class-validator';

export class CreateProgressEntryDto {
  @IsMongoId()
  client!: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsNumber()
  bodyFatPercent?: number;

  @IsOptional()
  @IsNumber()
  water?: number;

  @IsOptional()
  @IsNumber()
  muscleMass?: number;

  @IsOptional()
  @IsNumber()
  visceralFat?: number;

  @IsOptional()
  @IsNumber()
  boneMass?: number;
}
