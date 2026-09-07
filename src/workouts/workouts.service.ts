import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Workout } from './workouts.schema';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';

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

  async update(id: string, data: UpdateWorkoutDto): Promise<Workout> {
    const existing = await this.workoutModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Workout with id ${id} not found`);
    }

    if (data.name !== undefined) {
      existing.name = data.name;
    }
    if (data.slots !== undefined) {
      existing.slots = data.slots.map((slot) => ({
        exercise: slot.exerciseId,
        reps: slot.reps || [],
        supersetGroup: slot.supersetGroup,
        restPause: slot.restPause || false,
        notes: slot.notes,
      })) as any;
    }

    return existing.save();
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
