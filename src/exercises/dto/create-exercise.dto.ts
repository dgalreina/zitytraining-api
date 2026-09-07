import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ExerciseCategory } from '../exercises.schema';

export class CreateExerciseDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEnum(ExerciseCategory)
  category?: ExerciseCategory;
}
