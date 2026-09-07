import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class WorkoutSlotDto {
  @IsMongoId()
  exerciseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  reps!: number[];
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
