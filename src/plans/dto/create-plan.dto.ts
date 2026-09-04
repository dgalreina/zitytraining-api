import { IsEnum, IsNumber, Min } from 'class-validator';
import { PlanCategory } from '../plans.schema';

export class CreatePlanDto {
  @IsEnum(PlanCategory)
  category!: PlanCategory;

  @IsNumber()
  @Min(1)
  sessionsPerWeek!: number;

  @IsNumber()
  @Min(1)
  durationMinutes!: number;

  @IsNumber()
  @Min(0)
  monthlyPrice!: number;
}
