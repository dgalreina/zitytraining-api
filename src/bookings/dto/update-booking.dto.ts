import { IsEnum, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateBookingDto } from './create-booking.dto';
import { BookingStatus } from '../bookings.schema';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  // Cancelar es distinto de borrar: la sesion se queda, solo cambia el
  // estado. No forma parte de CreateBookingDto a proposito, una sesion
  // nueva siempre empieza "active".
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}