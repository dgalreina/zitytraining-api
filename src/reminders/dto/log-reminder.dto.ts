import { IsDateString, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class LogReminderDto {
  @IsMongoId()
  client!: string;

  // Lunes de la semana avisada, en ISO.
  @IsDateString()
  weekStart!: string;

  @IsString()
  @IsNotEmpty()
  sessionsFingerprint!: string;
}
