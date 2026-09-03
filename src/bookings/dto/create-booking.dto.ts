import { IsArray, IsBoolean, IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsMongoId()
  trainer!: string;

  // Vacio (u omitido) en sesiones privadas: no llevan clientes.
  @IsOptional()
  @IsArray()
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
}
