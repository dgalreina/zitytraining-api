import { AccountingService } from './accounting.service';
import { FinalMonthBilling, Purchase, PurchaseType } from '../purchases/purchases.schema';
import { User, UserStatus } from '../users/users.schema';
import { Booking } from '../bookings/bookings.schema';

// buildClientMonth/overlappingSpans no tocan la base de datos (son
// cálculo puro sobre lo que se les pasa), así que no hace falta montar
// un TestingModule ni mockear mongoose: basta con instanciar el service
// con modelos vacíos y llamar al método privado directamente.
function makeService(): AccountingService {
  return new AccountingService({} as any, {} as any, {} as any, {} as any);
}

function makePurchase(overrides: Partial<Purchase>): Purchase {
  return {
    _id: 'purchase-1',
    type: PurchaseType.PLAN,
    itemId: 'personal-3-40',
    itemLabel: 'Personal 3/semana',
    price: 120,
    ...overrides,
  } as unknown as Purchase;
}

function makeClient(): User {
  return {
    _id: 'client-1',
    firstName: 'Ana',
    lastName: 'Test',
    status: UserStatus.ACTIVE,
  } as unknown as User;
}

function makeBooking(day: number, overrides: Partial<Booking> = {}): Booking {
  return {
    startTime: new Date(Date.UTC(2024, 5, day, 10, 0)), // junio 2024, cualquier mes sin DST por medio
    holidaySkip: false,
    ...overrides,
  } as unknown as Booking;
}

describe('AccountingService.buildClientMonth (finalMonthBilling)', () => {
  const monthStart = new Date(Date.UTC(2024, 5, 1)); // junio 2024
  const monthEndExclusive = new Date(Date.UTC(2024, 6, 1));
  const daysInMonth = 30;

  it('cobra el mes entero cuando el plan lo cubre de principio a fin', () => {
    const service = makeService();
    const purchase = makePurchase({
      activatedAt: new Date(Date.UTC(2024, 4, 1)), // activo desde antes de junio
      price: 120,
    });

    const result: any = (service as any).buildClientMonth(
      makeClient(),
      monthStart,
      monthEndExclusive,
      daysInMonth,
      [purchase],
      [],
      null,
    );

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].basis).toBe('full_month');
    expect(result.segments[0].amount).toBe(120);
    expect(result.due).toBe(120);
  });

  it('con finalMonthBilling SESSIONS, cobra solo las sesiones dadas en el tramo cojo', () => {
    const service = makeService();
    // El plan se para el día 10: el tramo de junio va del 1 al 9 (cojo).
    const purchase = makePurchase({
      activatedAt: new Date(Date.UTC(2024, 4, 1)),
      endedAt: new Date(Date.UTC(2024, 5, 10)),
      price: 120,
      sessionCount: 12, // 3 sesiones/semana * 4
      finalMonthBilling: FinalMonthBilling.SESSIONS,
    });
    const bookings = [makeBooking(3), makeBooking(5)]; // 2 sesiones dentro del tramo 1-9

    const result: any = (service as any).buildClientMonth(
      makeClient(),
      monthStart,
      monthEndExclusive,
      daysInMonth,
      [purchase],
      bookings,
      null,
    );

    const pricePerSession = 120 / 12; // 10
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].basis).toBe('sessions');
    expect(result.segments[0].sessions).toBe(2);
    expect(result.segments[0].amount).toBe(2 * pricePerSession);
  });

  it('con finalMonthBilling NONE, no cobra nada ese tramo', () => {
    const service = makeService();
    const purchase = makePurchase({
      activatedAt: new Date(Date.UTC(2024, 4, 1)),
      endedAt: new Date(Date.UTC(2024, 5, 10)),
      price: 120,
      sessionCount: 12,
      finalMonthBilling: FinalMonthBilling.NONE,
    });

    const result: any = (service as any).buildClientMonth(
      makeClient(),
      monthStart,
      monthEndExclusive,
      daysInMonth,
      [purchase],
      [makeBooking(3)],
      null,
    );

    expect(result.segments[0].basis).toBe('none');
    expect(result.segments[0].amount).toBe(0);
    expect(result.due).toBe(0);
  });

  it('sin finalMonthBilling guardado, asume mes completo (comportamiento de siempre)', () => {
    const service = makeService();
    const purchase = makePurchase({
      activatedAt: new Date(Date.UTC(2024, 4, 1)),
      endedAt: new Date(Date.UTC(2024, 5, 10)),
      price: 120,
      sessionCount: 12,
      // sin finalMonthBilling
    });

    const result: any = (service as any).buildClientMonth(
      makeClient(),
      monthStart,
      monthEndExclusive,
      daysInMonth,
      [purchase],
      [makeBooking(3)],
      null,
    );

    expect(result.segments[0].basis).toBe('full_month');
    expect(result.segments[0].amount).toBe(120);
  });

  it('cobra aparte las sesiones de más cuando el cliente viene más de lo que cubre su cupo', () => {
    const service = makeService();
    const purchase = makePurchase({
      activatedAt: new Date(Date.UTC(2024, 4, 1)), // cubre el mes entero
      price: 120,
      sessionCount: 12,
    });
    // 14 sesiones en vez de las 12 del cupo: 2 de más.
    const bookings = Array.from({ length: 14 }, (_, i) => makeBooking(i + 1));

    const result: any = (service as any).buildClientMonth(
      makeClient(),
      monthStart,
      monthEndExclusive,
      daysInMonth,
      [purchase],
      bookings,
      null,
    );

    const pricePerSession = 120 / 12;
    expect(result.segments[0].basis).toBe('full_month_plus_extra');
    expect(result.segments[0].extraSessions).toBe(2);
    expect(result.segments[0].amount).toBe(120 + 2 * pricePerSession);
  });
});

describe('AccountingService.coverageIntervals (privado) — pausas por un puntual', () => {
  it('con una pausa, el plan cubre antes y después, pero no durante', () => {
    const service = makeService();
    const plan = makePurchase({
      _id: 'plan-1' as any,
      activatedAt: new Date(Date.UTC(2024, 5, 1)),
    });
    const punctual = makePurchase({
      _id: 'punt-1' as any,
      pausedPlan: 'plan-1' as any,
      activatedAt: new Date(Date.UTC(2024, 5, 10)),
      endedAt: new Date(Date.UTC(2024, 5, 15)),
    });

    const intervals = (service as any).coverageIntervals(plan, [plan, punctual]);

    expect(intervals).toEqual([
      { start: Date.UTC(2024, 5, 1), end: Date.UTC(2024, 5, 10) },
      { start: Date.UTC(2024, 5, 15), end: Infinity },
    ]);
  });

  it('con dos pausas seguidas en el mismo mes, saca tres tramos sin solaparse ni perder ninguno', () => {
    const service = makeService();
    const plan = makePurchase({
      _id: 'plan-1' as any,
      activatedAt: new Date(Date.UTC(2024, 5, 1)),
    });
    const punctualA = makePurchase({
      _id: 'punt-a' as any,
      pausedPlan: 'plan-1' as any,
      activatedAt: new Date(Date.UTC(2024, 5, 5)),
      endedAt: new Date(Date.UTC(2024, 5, 10)),
    });
    const punctualB = makePurchase({
      _id: 'punt-b' as any,
      pausedPlan: 'plan-1' as any,
      activatedAt: new Date(Date.UTC(2024, 5, 15)),
      endedAt: new Date(Date.UTC(2024, 5, 20)),
    });

    const intervals = (service as any).coverageIntervals(plan, [plan, punctualA, punctualB]);

    expect(intervals).toEqual([
      { start: Date.UTC(2024, 5, 1), end: Date.UTC(2024, 5, 5) },
      { start: Date.UTC(2024, 5, 10), end: Date.UTC(2024, 5, 15) },
      { start: Date.UTC(2024, 5, 20), end: Infinity },
    ]);
  });

  it('un plan pausado dos veces en el mismo mes se sigue facturando como mes completo si empieza el día 1 y llega hasta fin de mes', () => {
    const service = makeService();
    const monthStart = new Date(Date.UTC(2024, 5, 1));
    const monthEndExclusive = new Date(Date.UTC(2024, 6, 1));
    const daysInMonth = 30;

    const plan = makePurchase({
      _id: 'plan-1' as any,
      itemLabel: 'Plan mensual',
      activatedAt: new Date(Date.UTC(2024, 4, 1)), // activo desde mayo
      price: 120,
    });
    const punctualA = makePurchase({
      itemLabel: 'Puntual A',
      pausedPlan: 'plan-1' as any,
      activatedAt: new Date(Date.UTC(2024, 5, 5)),
      endedAt: new Date(Date.UTC(2024, 5, 10)),
    });
    const punctualB = makePurchase({
      itemLabel: 'Puntual B',
      pausedPlan: 'plan-1' as any,
      activatedAt: new Date(Date.UTC(2024, 5, 15)),
      endedAt: new Date(Date.UTC(2024, 5, 20)),
    });

    const result: any = (service as any).buildClientMonth(
      makeClient(),
      monthStart,
      monthEndExclusive,
      daysInMonth,
      [plan, punctualA, punctualB],
      [],
      null,
    );

    const planSegment = result.segments.find((s: any) => s.label === 'Plan mensual');
    expect(planSegment.basis).toBe('full_month');
    expect(planSegment.amount).toBe(120);
  });
});
