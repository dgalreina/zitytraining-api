import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MonthlyPayment } from './accounting.schema';
import { SetPaymentDto } from './dto/set-payment.dto';
import { User, Role, UserStatus } from '../users/users.schema';
import { Purchase, PurchaseStatus, PurchaseType, FinalMonthBilling } from '../purchases/purchases.schema';
import { BookingsService } from '../bookings/bookings.service';
import { Booking } from '../bookings/bookings.schema';

interface PurchaseSpan {
  purchase: Purchase;
  // Días del mes (1-based, inclusive) que este tramo cubre dentro del mes pedido.
  fromDay: number;
  toDay: number;
  isFreeSessions: boolean;
  coversFullMonth: boolean;
}

@Injectable()
export class AccountingService {
  constructor(
    @InjectModel(MonthlyPayment.name) private paymentModel: Model<MonthlyPayment>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Purchase.name) private purchaseModel: Model<Purchase>,
    private bookingsService: BookingsService,
  ) {}

  async getMonthLedger(year: number, month: number) {
    if (!year || !month || month < 1 || month > 12) {
      throw new BadRequestException('year y month (1-12) son obligatorios');
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEndExclusive = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    // De momento solo clientes activos; si hace falta ver meses de
    // clientes ya dados de baja, se revisará más adelante.
    const clients = await this.userModel
      .find({ roles: Role.CLIENT, status: UserStatus.ACTIVE })
      .sort({ firstName: 1, lastName: 1 })
      .exec();

    const clientIds = clients.map((c) => (c._id as any).toString());

    const payments = await this.paymentModel.find({ year, month }).exec();
    const paymentByClient = new Map(payments.map((p) => [p.client.toString(), p]));

    // Todo lo del mes se pide de una vez y se reparte por cliente aqui:
    // con un centenar de clientes, una consulta por cliente multiplicaba
    // por cien el trabajo de la base de datos en cada carga.
    const purchasesByClient = await this.purchasesByClient(clientIds);
    const bookingsByClient = await this.bookingsByClient(
      clientIds,
      monthStart,
      monthEndExclusive,
    );

    const clientsLedger = clients.map((client, i) =>
      this.buildClientMonth(
        client,
        monthStart,
        monthEndExclusive,
        daysInMonth,
        purchasesByClient.get(clientIds[i]) || [],
        bookingsByClient.get(clientIds[i]) || [],
        paymentByClient.get(clientIds[i]) || null,
      ),
    );

    return { year, month, daysInMonth, clients: clientsLedger };
  }

  // PAUSED se excluye a propósito: mientras un plan está en pausa, es un
  // puntual el que cubre ese periodo (ver purchases.service.ts). Sin
  // fecha de fin propia, un pausado sin excluir se contaría como si
  // siguiera cubriendo el mes entero, duplicando el cobro con el
  // puntual que sí está activo de verdad.
  private async purchasesByClient(clientIds: string[]): Promise<Map<string, Purchase[]>> {
    const purchases = await this.purchaseModel
      .find({
        client: { $in: clientIds },
        type: PurchaseType.PLAN,
        status: { $nin: [PurchaseStatus.PENDING, PurchaseStatus.PAUSED] },
      })
      .exec();

    const byClient = new Map<string, Purchase[]>();
    for (const purchase of purchases) {
      const key = purchase.client.toString();
      const list = byClient.get(key);
      if (list) list.push(purchase);
      else byClient.set(key, [purchase]);
    }
    return byClient;
  }

  private async bookingsByClient(
    clientIds: string[],
    monthStart: Date,
    monthEndExclusive: Date,
  ): Promise<Map<string, Booking[]>> {
    const bookings = await this.bookingsService.findByClientsAndRange(
      clientIds,
      monthStart.toISOString(),
      monthEndExclusive.toISOString(),
    );

    const wanted = new Set(clientIds);
    const byClient = new Map<string, Booking[]>();
    for (const booking of bookings) {
      if (booking.status === 'cancelled') continue;
      // Una reserva de dúo/trío cuenta para cada uno de sus clientes.
      for (const client of booking.clients) {
        const key = client.toString();
        if (!wanted.has(key)) continue;
        const list = byClient.get(key);
        if (list) list.push(booking);
        else byClient.set(key, [booking]);
      }
    }
    return byClient;
  }

  private buildClientMonth(
    client: User,
    monthStart: Date,
    monthEndExclusive: Date,
    daysInMonth: number,
    purchases: Purchase[],
    realBookings: Booking[],
    payment: MonthlyPayment | null,
  ) {
    const clientId = (client._id as any).toString();

    const spans = this.overlappingSpans(purchases, monthStart, monthEndExclusive, daysInMonth);

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayBookings = realBookings.filter((b) => b.startTime.getUTCDate() === day);
      return {
        day,
        hasClass: dayBookings.some((b) => !b.holidaySkip),
        holiday: dayBookings.some((b) => b.holidaySkip),
      };
    });

    function sessionsInRange(fromDay: number, toDay: number): number {
      return realBookings.filter((b) => {
        const d = b.startTime.getUTCDate();
        return !b.holidaySkip && d >= fromDay && d <= toDay;
      }).length;
    }

    let due = 0;
    const segments = spans.map((span) => {
      const pricePerSession = span.purchase.sessionCount
        ? span.purchase.price / span.purchase.sessionCount
        : 0;

      let amount: number;
      if (span.isFreeSessions) {
        amount = sessionsInRange(span.fromDay, span.toDay) * pricePerSession;
      } else if (span.coversFullMonth) {
        amount = span.purchase.price;
      } else {
        // Tramo de mes cojo (el plan se paró/cambió a mitad de mes): el
        // admin ya eligió cómo se factura al pararlo/cambiarlo. Sin
        // elección guardada (datos antiguos, o autoservicio por Stripe),
        // se asume mes completo, que es como se facturaba antes de esto.
        switch (span.purchase.finalMonthBilling) {
          case FinalMonthBilling.SESSIONS:
            amount = sessionsInRange(span.fromDay, span.toDay) * pricePerSession;
            break;
          case FinalMonthBilling.NONE:
            amount = 0;
            break;
          default:
            amount = span.purchase.price;
        }
      }

      due += amount;

      return {
        label: span.purchase.itemLabel,
        isFreeSessions: span.isFreeSessions,
        fromDay: span.fromDay,
        toDay: span.toDay,
        amount: Math.round(amount * 100) / 100,
      };
    });

    return {
      clientId,
      firstName: client.firstName,
      lastName: client.lastName,
      segments,
      days,
      sessionCount: days.filter((d) => d.hasClass).length,
      due: Math.round(due * 100) / 100,
      payment: payment
        ? { received: payment.received, amountReceived: payment.amountReceived ?? null }
        : { received: false, amountReceived: null },
    };
  }

  // Sesiones libres no se guarda como Plan real en BBDD (ver
  // plans.service.ts): su compra siempre lleva un itemId sintético
  // "sesiones-libres-<duracion>", nunca un ObjectId de verdad. Es la
  // forma fiable de distinguirla, sin depender del texto de itemLabel.
  private isFreeSessionsPurchase(purchase: Purchase): boolean {
    return purchase.itemId.startsWith('sesiones-libres-');
  }

  private purchaseEndDate(purchase: Purchase): Date | null {
    if (purchase.endedAt) return purchase.endedAt;
    if (purchase.status === PurchaseStatus.COMPLETED && purchase.scheduledEndDate) {
      return purchase.scheduledEndDate;
    }
    return null;
  }

  private overlappingSpans(
    purchases: Purchase[],
    monthStart: Date,
    monthEndExclusive: Date,
    daysInMonth: number,
  ): PurchaseSpan[] {
    const spans: PurchaseSpan[] = [];

    for (const purchase of purchases) {
      if (!purchase.activatedAt) continue;
      const end = this.purchaseEndDate(purchase);

      const overlaps =
        purchase.activatedAt < monthEndExclusive && (end === null || end > monthStart);
      if (!overlaps) continue;

      const fromDay = purchase.activatedAt <= monthStart ? 1 : purchase.activatedAt.getUTCDate();
      // "toDay" es inclusive: si el tramo sigue abierto o se acaba más
      // allá de este mes, llega hasta el último día; si se acaba dentro
      // de este mes, el día de fin (scheduledEndDate/endedAt) es el
      // primero que YA NO cuenta, así que el último cubierto es el anterior.
      const toDay =
        end === null || end >= monthEndExclusive ? daysInMonth : end.getUTCDate() - 1;
      if (toDay < fromDay) continue;

      spans.push({
        purchase,
        fromDay,
        toDay,
        isFreeSessions: this.isFreeSessionsPurchase(purchase),
        coversFullMonth: fromDay === 1 && toDay === daysInMonth,
      });
    }

    return spans;
  }

  async setPayment(
    clientId: string,
    year: number,
    month: number,
    data: SetPaymentDto,
  ): Promise<MonthlyPayment> {
    const updated = await this.paymentModel.findOneAndUpdate(
      { client: clientId, year, month },
      { $set: { received: data.received, amountReceived: data.amountReceived } },
      { new: true, upsert: true },
    );
    return updated;
  }
}
