import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateOwedSessionDto {
  @IsMongoId()
  client!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
