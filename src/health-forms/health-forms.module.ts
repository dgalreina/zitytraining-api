import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthFormsService } from './health-forms.service';
import { HealthFormsController } from './health-forms.controller';
import { HealthForm, HealthFormSchema } from './health-forms.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HealthForm.name, schema: HealthFormSchema }]),
  ],
  controllers: [HealthFormsController],
  providers: [HealthFormsService],
})
export class HealthFormsModule {}
