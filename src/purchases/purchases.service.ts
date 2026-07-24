import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Purchase, PurchaseStatus } from './purchases.schema';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  private stripe: Stripe;

  constructor(
    @InjectModel(Purchase.name) private purchaseModel: Model<Purchase>,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY')!);
  }

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

  async createCheckoutSession(purchaseId: string, userId: string): Promise<{ url: string }> {
    const purchase = await this.purchaseModel.findById(purchaseId);
    if (!purchase) {
      throw new NotFoundException(`Purchase with id ${purchaseId} not found`);
    }
    if (purchase.client.toString() !== userId) {
      throw new NotFoundException(`Purchase with id ${purchaseId} not found`);
    }

    const isRecurring = purchase.paymentMode === 'monthly';
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const session = await this.stripe.checkout.sessions.create({
      mode: isRecurring ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: purchase.itemLabel },
            unit_amount: Math.round(purchase.price * 100),
            ...(isRecurring ? { recurring: { interval: 'month' as const } } : {}),
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/dashboard/pagos?success=true`,
      cancel_url: `${frontendUrl}/dashboard/pagos?canceled=true`,
      metadata: { purchaseId: (purchase._id as any).toString() },
    });

    return { url: session.url! };
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET')!;
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Firma de webhook inválida: ${err.message}`);
    }
  }

  async handleStripeEvent(event: Stripe.Event): Promise<{ received: true }> {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const purchaseId = session.metadata?.purchaseId;
      if (purchaseId) {
        await this.updateStatus(purchaseId, PurchaseStatus.ACTIVE);
      }
    }
    return { received: true };
  }
}