import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class SetPaymentDto {
  @IsBoolean()
  received!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountReceived?: number;
}
