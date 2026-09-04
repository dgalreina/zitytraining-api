import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan } from './plans.schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(@InjectModel(Plan.name) private planModel: Model<Plan>) {}

  async create(data: CreatePlanDto): Promise<Plan> {
    const created = new this.planModel(data);
    return created.save();
  }

  async findAll(): Promise<Plan[]> {
    return this.planModel.find().sort({ category: 1, monthlyPrice: 1 }).exec();
  }

  async update(id: string, data: UpdatePlanDto): Promise<Plan> {
    const updated = await this.planModel.findByIdAndUpdate(id, data, { new: true });
    if (!updated) {
      throw new NotFoundException(`Plan with id ${id} not found`);
    }
    return updated;
  }

  // Borrado normal (no blando): los planes ya asignados guardan su
  // propio nombre y precio en la compra (itemLabel/price), así que
  // borrar el plan del catálogo no afecta al historial.
  async remove(id: string): Promise<void> {
    const deleted = await this.planModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Plan with id ${id} not found`);
    }
  }
}
