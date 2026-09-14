import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { ReminderLog, ReminderLogSchema } from './reminders.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ReminderLog.name, schema: ReminderLogSchema }]),
  ],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
