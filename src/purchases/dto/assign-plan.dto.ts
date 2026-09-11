import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { FinalMonthBilling } from '../purchases.schema';

// Entrenador/admin asignando un plan directamente a un cliente, pagado en
// mano (sin Stripe). Siempre es una suscripcion: se sabe cuando empieza,
// no cuando termina (hasta que se para).
export class AssignPlanDto {
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

  @IsOptional()
  @IsNumber()
  sessionCount?: number;

  // Solo para changePlan: cómo se factura, para el plan que se
  // sustituye, el mes a mitad del que se hace el cambio.
  @IsOptional()
  @IsEnum(FinalMonthBilling)
  finalMonthBilling?: FinalMonthBilling;
}
