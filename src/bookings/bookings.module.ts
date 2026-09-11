import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking, BookingSchema } from './bookings.schema';
import { BookingSeries, BookingSeriesSchema } from './booking-series.schema';
import { Holiday, HolidaySchema } from '../holidays/holidays.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: BookingSeries.name, schema: BookingSeriesSchema },
      { name: Holiday.name, schema: HolidaySchema },
    ]),
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}