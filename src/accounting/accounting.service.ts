import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MonthlyPayment } from './accounting.schema';
import { SetPaymentDto } from './dto/set-payment.dto';
import { User, Role, UserStatus } from '../users/users.schema';
import { Purchase, PurchaseStatus, PurchaseType, FinalMonthBilling } from '../purchases/purchases.schema';
import { BookingsService } from '../bookings/bookings.service';
import { Booking } from '../bookings/bookings.schema';

// De dónde sale el importe de un tramo: el precio del plan entero, las
// sesiones dadas dentro del tramo, o nada (el admin decidió no cobrar
// ese último mes).
type SegmentBasis = 'full_month' | 'sessions' | 'none';

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

    // Se traen también los dados de baja y los borrados: alguien que se
    // fue a mitad de mes puede dejar sesiones dadas o dinero pendiente,
    // y si no apareciese aquí ese cobro se perdería. Más abajo se
    // descartan los que no dejaron nada en este mes.
    // De cada cliente solo hacen falta el nombre y si sigue de alta: traer
    // el documento entero significaba mover ficha completa (direcciones,
    // teléfonos, el hash de la contraseña...) de cientos de personas para
    // usar tres campos.
    const clients = await this.userModel
      .find({ roles: Role.CLIENT })
      .select('firstName lastName status')
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

    // De quien ya no es cliente solo interesa el mes en el que dejó algo
    // detrás: sesiones dadas o dinero por cobrar. Sin esto, la tabla se
    // llenaría de gente que hace meses que no entrena.
    const visibleClients = clientsLedger.filter(
      (c) => !c.inactive || c.sessionCount > 0 || c.due > 0,
    );

    return { year, month, daysInMonth, clients: visibleClients };
  }

  // Los pausados también entran: un plan en pausa sigue siendo del
  // cliente, solo que un puntual lo tapa durante un tiempo. Cuándo se
  // pausó y cuándo se retoma se saca del propio puntual (ver
  // coverageIntervals), así que aquí no hay que excluir nada.
  private async purchasesByClient(clientIds: string[]): Promise<Map<string, Purchase[]>> {
    const purchases = await this.purchaseModel
      .find({
        client: { $in: clientIds },
        type: PurchaseType.PLAN,
        status: { $ne: PurchaseStatus.PENDING },
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

      // "basis" explica de dónde sale el importe, para que la pantalla
      // pueda justificarlo sin rehacer el cálculo por su cuenta: cobrar
      // 2 sesiones de un tramo de 22 días no se entiende viendo solo el
      // total.
      let amount: number;
      let basis: SegmentBasis;
      let sessions: number | null = null;

      if (span.isFreeSessions) {
        sessions = sessionsInRange(span.fromDay, span.toDay);
        amount = sessions * pricePerSession;
        basis = 'sessions';
      } else if (span.coversFullMonth) {
        amount = span.purchase.price;
        basis = 'full_month';
      } else {
        // Tramo de mes cojo (el plan se paró/cambió a mitad de mes): el
        // admin ya eligió cómo se factura al pararlo/cambiarlo. Sin
        // elección guardada (datos antiguos, o autoservicio por Stripe),
        // se asume mes completo, que es como se facturaba antes de esto.
        switch (span.purchase.finalMonthBilling) {
          case FinalMonthBilling.SESSIONS:
            sessions = sessionsInRange(span.fromDay, span.toDay);
            amount = sessions * pricePerSession;
            basis = 'sessions';
            break;
          case FinalMonthBilling.NONE:
            amount = 0;
            basis = 'none';
            break;
          default:
            amount = span.purchase.price;
            basis = 'full_month';
        }
      }

      due += amount;

      return {
        label: span.purchase.itemLabel,
        isFreeSessions: span.isFreeSessions,
        fromDay: span.fromDay,
        toDay: span.toDay,
        amount: Math.round(amount * 100) / 100,
        basis,
        sessions,
        pricePerSession:
          basis === 'sessions' ? Math.round(pricePerSession * 100) / 100 : null,
      };
    });

    return {
      clientId,
      firstName: client.firstName,
      lastName: client.lastName,
      inactive: client.status !== UserStatus.ACTIVE,
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

  // Un puntual activo ya sabe cuándo acaba: no hay que esperar a que
  // llegue el día y se cierre para que Contabilidad lo tenga en cuenta.
  // Si no, al mirar un mes futuro seguía cubriéndolo entero.
  private purchaseEndDate(purchase: Purchase): Date | null {
    if (purchase.endedAt) return purchase.endedAt;
    if (purchase.scheduledEndDate) return purchase.scheduledEndDate;
    return null;
  }

  // Periodos en los que un plan cubre de verdad al cliente: desde que se
  // activa hasta que acaba, quitando los huecos de los puntuales que lo
  // pausaron (cada puntual guarda en pausedPlan a quién tapó). Con esto
  // un mensual pausado en septiembre por un puntual sale bien en agosto
  // (aún activo), no sale en septiembre (tapado) y vuelve a salir en
  // octubre (retomado), sin que nadie tenga que haberlo cerrado o
  // reabierto todavía.
  private coverageIntervals(
    purchase: Purchase,
    all: Purchase[],
  ): Array<{ start: number; end: number }> {
    if (!purchase.activatedAt) return [];
    const start = purchase.activatedAt.getTime();
    const endDate = this.purchaseEndDate(purchase);
    const end = endDate ? endDate.getTime() : Infinity;

    const id = String(purchase._id);
    const gaps = all
      .filter((p) => p.pausedPlan && String(p.pausedPlan) === id && p.activatedAt)
      .map((p) => {
        const e = this.purchaseEndDate(p);
        return { start: p.activatedAt!.getTime(), end: e ? e.getTime() : Infinity };
      })
      .sort((a, b) => a.start - b.start);

    const result: Array<{ start: number; end: number }> = [];
    let cursor = start;
    for (const gap of gaps) {
      if (gap.end <= cursor) continue;
      if (gap.start > cursor) result.push({ start: cursor, end: Math.min(gap.start, end) });
      cursor = Math.max(cursor, gap.end);
      if (cursor >= end) break;
    }
    if (cursor < end) result.push({ start: cursor, end });
    return result;
  }

  private overlappingSpans(
    purchases: Purchase[],
    monthStart: Date,
    monthEndExclusive: Date,
    daysInMonth: number,
  ): PurchaseSpan[] {
    const spans: PurchaseSpan[] = [];

    const monthStartMs = monthStart.getTime();
    const monthEndMs = monthEndExclusive.getTime();

    for (const purchase of purchases) {
      // Del mes solo interesa el primer y el último día cubiertos. Si un
      // puntual de sesiones libres abre un hueco a mitad de mes, el
      // mensual se sigue cobrando entero (no se prorratea) y el hueco lo
      // pinta el propio puntual encima.
      let fromDay: number | null = null;
      let toDay: number | null = null;

      for (const { start, end } of this.coverageIntervals(purchase, purchases)) {
        if (start >= monthEndMs || end <= monthStartMs) continue;

        const from = start <= monthStartMs ? 1 : new Date(start).getUTCDate();
        // "toDay" es inclusive: si el tramo sigue abierto o se acaba más
        // allá de este mes, llega hasta el último día; si se acaba dentro
        // de este mes, el día de fin es el primero que YA NO cuenta, así
        // que el último cubierto es el anterior.
        const to = end >= monthEndMs ? daysInMonth : new Date(end).getUTCDate() - 1;
        if (to < from) continue;

        fromDay = fromDay === null ? from : Math.min(fromDay, from);
        toDay = toDay === null ? to : Math.max(toDay, to);
      }
      if (fromDay === null || toDay === null) continue;

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
