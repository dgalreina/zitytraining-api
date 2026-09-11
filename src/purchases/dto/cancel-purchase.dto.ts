import { IsEnum, IsOptional } from 'class-validator';
import { FinalMonthBilling } from '../purchases.schema';

// Solo relevante al parar un plan mensual a mitad de mes: cómo se
// factura ese mes (ver FinalMonthBilling). Sin valor cuando no aplica
// (planes puntuales, sesiones libres, o parada justo al acabar el mes).
export class CancelPurchaseDto {
  @IsOptional()
  @IsEnum(FinalMonthBilling)
  finalMonthBilling?: FinalMonthBilling;
}
