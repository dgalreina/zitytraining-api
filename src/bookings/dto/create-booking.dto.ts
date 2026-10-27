import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { WeightOverrideSlotDto } from './weight-override.dto';

export class CreateBookingDto {
  @IsMongoId()
  trainer!: string;

  // Vacio (u omitido) en sesiones privadas: no llevan clientes. Si no,
  // hasta 3 clientes, sin distinguir uno "principal" de los demás.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsMongoId({ each: true })
  clients?: string[];

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  // Implica isPrivate (lo fuerza el servicio aunque no venga).
  @IsOptional()
  @IsBoolean()
  isInterview?: boolean;

  // null explicito quita el entrenamiento asignado; omitido no lo toca.
  @IsOptional()
  @IsMongoId()
  workoutId?: string | null;

  // Omitido o "once": sesión puntual normal. "weekly": crea una serie que
  // se repite cada semana a esta misma hora, para siempre (hasta que se
  // pare a mano borrando "esta sesión y las futuras").
  @IsOptional()
  @IsIn(['once', 'weekly'])
  recurrence?: 'once' | 'weekly';

  // Marca esta sesión como recuperación de una clase debida: no cuenta en
  // Contabilidad para ninguno de sus clientes, y a cada uno se le da por
  // recuperada su clase debida más antigua.
  @IsOptional()
  @IsBoolean()
  isDebtSettlement?: boolean;

  // Pesos/reps reales de esta sesión (ver weight-override.schema.ts), por
  // si se editaron desde el lápiz del entrenamiento antes del primer
  // guardado. Si la sesión nace como serie semanal, se guardan también en
  // la plantilla de la serie para que las que se generen más adelante los
  // lleven.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeightOverrideSlotDto)
  weightOverrides?: WeightOverrideSlotDto[];
}
