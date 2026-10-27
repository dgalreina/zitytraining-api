import { Type } from 'class-transformer';
import { IsArray, IsMongoId, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';

export class WeightOverrideSetDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  reps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;
}

export class WeightOverrideSlotDto {
  @IsMongoId()
  exerciseId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeightOverrideSetDto)
  sets!: WeightOverrideSetDto[];
}
