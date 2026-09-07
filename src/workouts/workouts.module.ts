import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkoutsService } from './workouts.service';
import { WorkoutsController } from './workouts.controller';
import { Workout, WorkoutSchema } from './workouts.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Workout.name, schema: WorkoutSchema }]),
  ],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
})
export class WorkoutsModule {}
