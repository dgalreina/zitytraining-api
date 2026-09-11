import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { MonthlyPayment, MonthlyPaymentSchema } from './accounting.schema';
import { User, UserSchema } from '../users/users.schema';
import { Purchase, PurchaseSchema } from '../purchases/purchases.schema';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MonthlyPayment.name, schema: MonthlyPaymentSchema },
      { name: User.name, schema: UserSchema },
      { name: Purchase.name, schema: PurchaseSchema },
    ]),
    BookingsModule,
  ],
  controllers: [AccountingController],
  providers: [AccountingService],
})
export class AccountingModule {}
