import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProgressEntry } from './progress.schema';
import { CreateProgressEntryDto } from './dto/create-progress-entry.dto';

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(ProgressEntry.name) private progressModel: Model<ProgressEntry>,
  ) {}

  async create(data: CreateProgressEntryDto): Promise<ProgressEntry> {
    const created = new this.progressModel({
      ...data,
      date: data.date ? new Date(data.date) : new Date(),
    });
    return created.save();
  }

  async findByClient(clientId: string): Promise<ProgressEntry[]> {
    return this.progressModel.find({ client: clientId }).sort({ date: 1 }).exec();
  }
}
