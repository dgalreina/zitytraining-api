import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class WorkoutSetDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  reps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;
}

class WorkoutSlotDto {
  @IsMongoId()
  exerciseId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetDto)
  sets?: WorkoutSetDto[];

  @IsOptional()
  @IsBoolean()
  linkedToNext?: boolean;

  @IsOptional()
  @IsBoolean()
  restPause?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateWorkoutDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkoutSlotDto)
  slots!: WorkoutSlotDto[];
}
