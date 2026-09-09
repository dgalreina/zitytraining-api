import { IsDateString, IsOptional } from 'class-validator';

// Para corregir una fecha mal introducida al asignar un plan a mano.
export class UpdatePurchaseDatesDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
