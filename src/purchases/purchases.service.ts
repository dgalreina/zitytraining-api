import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { Purchase, PurchaseStatus, PurchaseType, PaymentMode, FinalMonthBilling } from './purchases.schema';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { AssignPunctualPlanDto } from './dto/assign-punctual-plan.dto';
import { UpdatePurchaseDatesDto } from './dto/update-purchase-dates.dto';

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
      sessionCount: data.sessionCount,
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
      sessionCount: data.sessionCount,
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

      // La elección de cómo facturar el último mes es para el plan
      // mensual que se queda cojo. Si lo que está activo es un puntual
      // (precio cerrado, no hay nada que elegir), el mensual cojo es el
      // que ese puntual tenía pausado, y la elección va para él.
      const isPunctual = !!currentActive.scheduledEndDate;

      currentActive.status = PurchaseStatus.CANCELLED;
      currentActive.endedAt = new Date();
      currentActive.endedBy = actorId as any;
      currentActive.endReason = 'changed';
      currentActive.replacedByLabel = data.itemLabel;
      currentActive.finalMonthBilling = isPunctual ? undefined : data.finalMonthBilling;
      await currentActive.save();

      if (currentActive.pausedPlan) {
        await this.purchaseModel.findByIdAndUpdate(currentActive.pausedPlan, {
          status: PurchaseStatus.CANCELLED,
          endedAt: new Date(),
          endedBy: actorId,
          endReason: 'changed',
          replacedByLabel: data.itemLabel,
          finalMonthBilling: isPunctual ? data.finalMonthBilling : undefined,
        });
      }
    }

    return this.assignPlan(data, actorId);
  }

  // Para un plan asignado a mano en cualquier momento; se queda como
  // historial con la fecha de inicio y de fin. Si era un plan puntual que
  // había pausado otro, se retoma el pausado.
  async cancel(
    id: string,
    actorId: string,
    finalMonthBilling?: FinalMonthBilling,
  ): Promise<Purchase> {
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
    existing.finalMonthBilling = finalMonthBilling;
    await existing.save();

    if (existing.pausedPlan) {
      await this.resumePausedPlan(existing.pausedPlan);
    }

    return existing;
  }

  // Anula un plan asignado por error. A diferencia de "cancel", aquí no
  // hay último mes que facturar: la idea es que sea como si nunca hubiera
  // existido. Vale tanto para un plan en curso como para uno ya cerrado
  // (el error se puede descubrir tarde, al revisar Contabilidad). Si
  // estaba tapando otro plan, ese vuelve a estar activo. Lo que no se
  // hace es resucitar un plan que este hubiera sustituido con "cambiar
  // plan": eso lo reasigna el admin a mano.
  async voidPurchase(id: string, actorId: string): Promise<Purchase> {
    const existing = await this.purchaseModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase with id ${id} not found`);
    }
    if (!existing.assignedInPerson) {
      throw new BadRequestException(
        'Este plan se pagó por Stripe, no se puede anular desde aquí',
      );
    }
    if (existing.status === PurchaseStatus.VOIDED) {
      throw new BadRequestException('Este plan ya está anulado');
    }

    existing.status = PurchaseStatus.VOIDED;
    existing.endedAt = new Date();
    existing.endedBy = actorId as any;
    existing.endReason = 'voided';
    existing.finalMonthBilling = FinalMonthBilling.NONE;
    await existing.save();

    if (existing.pausedPlan) {
      await this.resumePausedPlan(existing.pausedPlan);
    }

    return existing;
  }

  // Devuelve a activo el plan que un puntual tenía tapado. Solo si sigue
  // en pausa: si mientras tanto se anuló o se paró, no hay que
  // resucitarlo.
  private async resumePausedPlan(pausedPlanId: Types.ObjectId): Promise<void> {
    await this.purchaseModel.findOneAndUpdate(
      { _id: pausedPlanId, status: PurchaseStatus.PAUSED },
      { status: PurchaseStatus.ACTIVE },
    );
  }

  // Corrige la fecha de inicio (y, si es puntual, la de fin) de un plan
  // asignado a mano, por si se introdujo mal. Igual que "cancel", no vale
  // para planes pagados por Stripe: esas fechas las marca el propio pago.
  async updateDates(id: string, data: UpdatePurchaseDatesDto, actorId: string): Promise<Purchase> {
    const existing = await this.purchaseModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase with id ${id} not found`);
    }
    if (!existing.assignedInPerson) {
      throw new BadRequestException(
        'Este plan se pagó por Stripe, no se pueden editar sus fechas desde aquí',
      );
    }

    if (data.startDate) {
      existing.activatedAt = new Date(data.startDate);
    }
    if (data.endDate) {
      existing.scheduledEndDate = new Date(data.endDate);
    }
    await existing.save();
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
        await this.resumePausedPlan(plan.pausedPlan);
      }
    }
  }

  // "onlyCurrent" deja fuera lo que ya terminó, que es justo el historial:
  // se usa para los entrenadores, que ven el plan en curso de su cliente
  // pero no el registro de contrataciones.
  async findByClient(
    clientId: string,
    options: { onlyCurrent?: boolean } = {},
  ): Promise<Purchase[]> {
    await this.resolveExpiredPunctualPlans(clientId);
    const filtro: Record<string, unknown> = { client: clientId };
    if (options.onlyCurrent) {
      filtro.status = { $in: [PurchaseStatus.ACTIVE, PurchaseStatus.PAUSED] };
    }
    return this.purchaseModel
      .find(filtro)
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