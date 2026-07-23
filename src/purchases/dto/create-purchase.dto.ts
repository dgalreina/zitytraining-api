import { IsEnum, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { PurchaseType, PaymentMode } from '../purchases.schema';

export class CreatePurchaseDto {
  @IsEnum(PurchaseType)
  type!: PurchaseType;

  @IsNotEmpty()
  itemId!: string;

  @IsNotEmpty()
  itemLabel!: string;

  @IsEnum(PaymentMode)
  paymentMode!: PaymentMode;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  sessionCount?: number;
}