import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBookingDto {
  @IsMongoId()
  trainer!: string;

  // Vacio (u omitido) en sesiones privadas: no llevan clientes. Si no,
  // el primero es el cliente principal (a quien se le hace el cobro) y
  // hasta 2 más son acompañantes.
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
}
