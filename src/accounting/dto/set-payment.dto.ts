import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class SetPaymentDto {
  @IsBoolean()
  received!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountReceived?: number;

  // Cuántas de las sesiones de más (por encima del cupo del plan) quiere
  // cobrar el admin como sueltas; el resto de sesiones de más no se cobra.
  @IsOptional()
  @IsNumber()
  @Min(0)
  chargedExtraSessions?: number;
}
