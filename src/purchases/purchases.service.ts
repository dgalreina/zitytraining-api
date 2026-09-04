import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Purchase, PurchaseStatus, PurchaseType, PaymentMode } from './purchases.schema';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { AssignPunctualPlanDto } from './dto/assign-punctual-plan.dto';

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
      createdBy: clientId, // autoservicio: el cliente se lo compra a sí mismo
    });
    return created.save();
  }

  // Entrenador/admin asignando un plan directamente, pagado en mano: se
  // activa al momento, sin pasar por Stripe. Siempre suscripcion mensual.
  async assignPlan(data: AssignPlanDto, actorId: string): Promise<Purchase> {
    const created = new this.purchaseModel({
      client: data.client,
      type: PurchaseType.PLAN,
      itemId: data.itemId,
      itemLabel: data.itemLabel,
      paymentMode: PaymentMode.MONTHLY,
      price: data.price,
      status: PurchaseStatus.ACTIVE,
      activatedAt: data.startDate ? new Date(data.startDate) : new Date(),
      assignedInPerson: true,
      createdBy: actorId,
    });
    return created.save();
  }

  // Plan puntual: tiene fecha de fin conocida de antemano. Si el cliente
  // ya tenía un plan activo, se pausa mientras dura el puntual, y se
  // retoma solo (sin cambiar su fecha de inicio original) cuando el
  // puntual acaba, ya sea por caducar o por pararlo a mano.
  async assignPunctualPlan(data: AssignPunctualPlanDto, actorId: string): Promise<Purchase> {
    const currentActive = await this.purchaseModel.findOne({
      client: data.client,
      type: PurchaseType.PLAN,
      status: PurchaseStatus.ACTIVE,
    });

    if (currentActive) {
      currentActive.status = PurchaseStatus.PAUSED;
      await currentActive.save();
    }

    const created = new this.purchaseModel({
      client: data.client,
      type: PurchaseType.PLAN,
      itemId: data.itemId,
      itemLabel: data.itemLabel,
      paymentMode: PaymentMode.MONTHLY,
      price: data.price,
      status: PurchaseStatus.ACTIVE,
      activatedAt: data.startDate ? new Date(data.startDate) : new Date(),
      scheduledEndDate: new Date(data.endDate),
      pausedPlan: currentActive ? currentActive._id : undefined,
      assignedInPerson: true,
      createdBy: actorId,
    });
    return created.save();
  }

  // Admin o entrenador: sustituye el plan activo por otro directamente.
  // A diferencia del puntual, es definitivo: el plan anterior (y el que
  // este a su vez tuviera pausado, si lo hubiera) queda cerrado para
  // siempre, no se retoma nada.
  async changePlan(data: AssignPlanDto, actorId: string): Promise<Purchase> {
    const currentActive = await this.purchaseModel.findOne({
      client: data.client,
      type: PurchaseType.PLAN,
      status: PurchaseStatus.ACTIVE,
    });

    if (currentActive) {
      if (!currentActive.assignedInPerson) {
        throw new BadRequestException(
          'El plan activo se pagó por Stripe, no se puede cambiar desde aquí',
        );
      }

      currentActive.status = PurchaseStatus.CANCELLED;
      currentActive.endedAt = new Date();
      currentActive.endedBy = actorId as any;
      currentActive.endReason = 'changed';
      currentActive.replacedByLabel = data.itemLabel;
      await currentActive.save();

      if (currentActive.pausedPlan) {
        await this.purchaseModel.findByIdAndUpdate(currentActive.pausedPlan, {
          status: PurchaseStatus.CANCELLED,
          endedAt: new Date(),
          endedBy: actorId,
          endReason: 'changed',
          replacedByLabel: data.itemLabel,
        });
      }
    }

    return this.assignPlan(data, actorId);
  }

  // Para un plan asignado a mano en cualquier momento; se queda como
  // historial con la fecha de inicio y de fin. Si era un plan puntual que
  // había pausado otro, se retoma el pausado.
  async cancel(id: string, actorId: string): Promise<Purchase> {
    const existing = await this.purchaseModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase with id ${id} not found`);
    }
    if (!existing.assignedInPerson) {
      // Un plan pagado por Stripe no se para desde aquí: seguiría
      // cobrando de verdad aunque en la BD quedara como cancelado.
      throw new BadRequestException(
        'Este plan se pagó por Stripe, no se puede parar desde aquí',
      );
    }

    existing.status = PurchaseStatus.CANCELLED;
    existing.endedAt = new Date();
    existing.endedBy = actorId as any;
    existing.endReason = 'cancelled';
    await existing.save();

    if (existing.pausedPlan) {
      await this.purchaseModel.findByIdAndUpdate(existing.pausedPlan, {
        status: PurchaseStatus.ACTIVE,
      });
    }

    return existing;
  }

  // Cierra solos los planes puntuales cuya fecha de fin ya pasó, y
  // retoma lo que hubieran pausado. Se llama de pasada al listar, no hay
  // tarea programada aparte (ver nota en el commit).
  private async resolveExpiredPunctualPlans(clientId: string): Promise<void> {
    const expired = await this.purchaseModel.find({
      client: clientId,
      status: PurchaseStatus.ACTIVE,
      scheduledEndDate: { $lte: new Date() },
    });

    for (const plan of expired) {
      plan.status = PurchaseStatus.COMPLETED;
      plan.endedAt = plan.scheduledEndDate;
      await plan.save();

      if (plan.pausedPlan) {
        await this.purchaseModel.findByIdAndUpdate(plan.pausedPlan, {
          status: PurchaseStatus.ACTIVE,
        });
      }
    }
  }

  async findByClient(clientId: string): Promise<Purchase[]> {
    await this.resolveExpiredPunctualPlans(clientId);
    return this.purchaseModel
      .find({ client: clientId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'firstName lastName color')
      .populate('endedBy', 'firstName lastName color')
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