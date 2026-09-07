import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Workout } from './workouts.schema';
import { CreateWorkoutDto } from './dto/create-workout.dto';

@Injectable()
export class WorkoutsService {
  constructor(@InjectModel(Workout.name) private workoutModel: Model<Workout>) {}

  async create(data: CreateWorkoutDto): Promise<Workout> {
    const created = new this.workoutModel({
      name: data.name,
      slots: data.slots.map((slot) => ({
        exercise: slot.exerciseId,
        reps: slot.reps || [],
        supersetGroup: slot.supersetGroup,
        restPause: slot.restPause || false,
        notes: slot.notes,
      })),
    });
    return created.save();
  }

  async findAll(): Promise<Workout[]> {
    return this.workoutModel
      .find()
      .sort({ createdAt: -1 })
      .populate('slots.exercise', 'name category')
      .exec();
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.workoutModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Workout with id ${id} not found`);
    }
  }
}
