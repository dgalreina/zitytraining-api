import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HealthForm } from './health-forms.schema';
import { CreateHealthFormDto } from './dto/create-health-form.dto';
import { UpdateHealthFormDto } from './dto/update-health-form.dto';

@Injectable()
export class HealthFormsService {
  constructor(
    @InjectModel(HealthForm.name) private healthFormModel: Model<HealthForm>,
  ) {}

  async create(data: CreateHealthFormDto): Promise<HealthForm> {
    const existing = await this.healthFormModel.findOne({ client: data.client });
    if (existing) {
      throw new ConflictException('Este cliente ya tiene una ficha de salud');
    }
    const created = new this.healthFormModel(data);
    return created.save();
  }

  async findByClient(clientId: string): Promise<HealthForm | null> {
    return this.healthFormModel.findOne({ client: clientId }).exec();
  }

  async update(id: string, data: UpdateHealthFormDto): Promise<HealthForm> {
    const updated = await this.healthFormModel.findByIdAndUpdate(id, data, { new: true });
    if (!updated) {
      throw new NotFoundException(`HealthForm with id ${id} not found`);
    }
    return updated;
  }
}
