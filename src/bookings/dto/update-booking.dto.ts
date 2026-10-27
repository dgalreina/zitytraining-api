import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateBookingDto } from './create-booking.dto';
import { WeightOverrideSlotDto } from './weight-override.dto';
import { BookingStatus } from '../bookings.schema';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  // Cancelar es distinto de borrar: la sesion se queda, solo cambia el
  // estado. No forma parte de CreateBookingDto a proposito, una sesion
  // nueva siempre empieza "active".
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  // Para desmarcar (o volver a marcar) que esta sesión concreta de una
  // serie no cuenta como dada por caer en festivo.
  @IsOptional()
  @IsBoolean()
  holidaySkip?: boolean;

  // Solo tiene efecto si esta sesión pertenece a una serie y además se
  // manda workoutId: aplica el entrenamiento (o su borrado) también a
  // las demás sesiones ya generadas de la serie a partir de esta fecha,
  // y a la plantilla de la serie, para que las que se generen más
  // adelante también lo lleven.
  @IsOptional()
  @IsBoolean()
  applyWorkoutToSeries?: boolean;

  // Solo tiene efecto si esta sesión pertenece a una serie y además se
  // manda un startTime nuevo: aplica el mismo cambio de día/hora a las
  // demás sesiones ya generadas de la serie a partir de esta fecha (antes
  // de moverla), y deja la serie anclada al nuevo patrón para las que se
  // generen más adelante.
  @IsOptional()
  @IsBoolean()
  applyTimeToSeries?: boolean;

  // Pesos/reps reales de esta sesion (ver weight-override.schema.ts).
  // undefined = no tocar; [] = quitar overrides y volver a los de la
  // plantilla. Si la sesion es de una serie, se propaga siempre a esta y
  // a las futuras (nunca a las pasadas): no hace falta un flag como
  // applyWorkoutToSeries, es automatico (ver BookingsService.update).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeightOverrideSlotDto)
  weightOverrides?: WeightOverrideSlotDto[];
}