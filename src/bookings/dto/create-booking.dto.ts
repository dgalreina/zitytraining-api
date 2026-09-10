import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';

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
}
