import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

// Solo para festivos locales (los nacionales/autonómicos se traen solos
// de la API); por eso no lleva "origin", siempre se crea como manual.
export class CreateHolidayDto {
  @IsDateString()
  date!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;
}
