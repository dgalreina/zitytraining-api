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
        sets: slot.sets || [],
        linkedToNext: slot.linkedToNext || false,
        restPause: slot.restPause || false,
        notes: slot.notes,
      })),
    });
    await created.save();
    // Igual que findAll: el front pinta el nombre/categoria del ejercicio
    // de cada slot, así que el doc que se devuelve tiene que venir ya
    // poblado (si no, "Ejercicio eliminado" aunque exista de verdad).
    return created.populate('slots.exercise', 'name category');
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
        sets: slot.sets || [],
        linkedToNext: slot.linkedToNext || false,
        restPause: slot.restPause || false,
        notes: slot.notes,
      })) as any;
    }

    await existing.save();
    return existing.populate('slots.exercise', 'name category');
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
