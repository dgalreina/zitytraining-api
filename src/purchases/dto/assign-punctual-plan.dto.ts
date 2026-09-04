import { IsDateString, IsMongoId, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

// Igual que asignar un plan normal, pero con fecha de fin conocida: al
// llegar esa fecha se cierra solo y se retoma el plan que hubiera pausado.
export class AssignPunctualPlanDto {
  @IsMongoId()
  client!: string;

  @IsNotEmpty()
  itemId!: string;

  @IsNotEmpty()
  itemLabel!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsDateString()
  endDate!: string;
}
