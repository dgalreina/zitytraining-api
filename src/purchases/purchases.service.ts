import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Purchase, PurchaseStatus, PurchaseType } from './purchases.schema';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(@InjectModel(Purchase.name) private purchaseModel: Model<Purchase>) {}

  async create(clientId: string, data: CreatePurchaseDto): Promise<Purchase> {
    const created = new this.purchaseModel({
      ...data,
      client: clientId,
      status: PurchaseStatus.PENDING,
    });
    return created.save();
  }

  async findByClient(clientId: string): Promise<Purchase[]> {
    return this.purchaseModel
      .find({ client: clientId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findActivePlan(clientId: string): Promise<Purchase | null> {
    return this.purchaseModel
      .findOne({ client: clientId, type: PurchaseType.PLAN, status: PurchaseStatus.ACTIVE })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(id: string, status: PurchaseStatus): Promise<Purchase> {
    const update: any = { status };
    if (status === PurchaseStatus.ACTIVE) {
      update.activatedAt = new Date();
    }

    const updated = await this.purchaseModel.findByIdAndUpdate(id, update, { new: true });
    if (!updated) {
      throw new NotFoundException(`Purchase with id ${id} not found`);
    }
    return updated;
  }
}