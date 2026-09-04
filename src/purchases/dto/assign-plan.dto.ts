import { IsDateString, IsMongoId, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

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
}
