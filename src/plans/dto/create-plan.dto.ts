import { IsEnum, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { PlanCategory } from '../plans.schema';

export class CreatePlanDto {
  @IsEnum(PlanCategory)
  category!: PlanCategory;

  @IsNotEmpty()
  label!: string;

  @IsNumber()
  @Min(0)
  monthlyPrice!: number;

  @IsNumber()
  @Min(0)
  sessionPrice!: number;

  @IsNumber()
  @Min(1)
  sessionCount!: number;
}
