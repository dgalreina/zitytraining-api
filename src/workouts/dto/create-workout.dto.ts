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
  ValidateNested,
} from 'class-validator';

class WorkoutSlotDto {
  @IsMongoId()
  exerciseId!: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  reps?: number[];

  @IsOptional()
  @IsString()
  supersetGroup?: string;

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
