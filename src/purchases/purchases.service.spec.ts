import { PurchasesService } from './purchases.service';
import { PurchaseStatus, FinalMonthBilling } from './purchases.schema';

// Mismo patrón que en los otros *.service.spec.ts: mocks mínimos del
// modelo de Mongoose, nada de base de datos real.
function makePurchaseModelMock() {
  const Ctor: any = jest.fn().mockImplementation(function (this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || 'purchase-new';
    this.save = jest.fn().mockResolvedValue(this);
  });
  Ctor.findOne = jest.fn();
  Ctor.findById = jest.fn();
  Ctor.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
  Ctor.findOneAndUpdate = jest.fn().mockResolvedValue(null);
  Ctor.find = jest.fn().mockResolvedValue([]);
  return Ctor;
}

describe('PurchasesService.assignPunctualPlan — pausar el plan activo', () => {
  it('pausa el plan activo y enlaza el puntual nuevo con pausedPlan', async () => {
    const purchaseModel = makePurchaseModelMock();
    const activeSave = jest.fn().mockResolvedValue(undefined);
    const currentActive: any = { _id: 'active-1', status: PurchaseStatus.ACTIVE, save: activeSave };
    purchaseModel.findOne.mockResolvedValue(currentActive);
    const service = new PurchasesService(purchaseModel, {} as any);

    const created: any = await service.assignPunctualPlan(
      {
        client: 'c1',
        itemId: 'puntual-x',
        itemLabel: 'Puntual',
        price: 50,
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      } as any,
      'admin-1',
    );

    expect(currentActive.status).toBe(PurchaseStatus.PAUSED);
    expect(activeSave).toHaveBeenCalledTimes(1);
    expect(created.pausedPlan).toBe('active-1');
    expect(created.status).toBe(PurchaseStatus.ACTIVE);
  });

  it('si no hay plan activo, crea el puntual sin pausedPlan', async () => {
    const purchaseModel = makePurchaseModelMock();
    purchaseModel.findOne.mockResolvedValue(null);
    const service = new PurchasesService(purchaseModel, {} as any);

    const created: any = await service.assignPunctualPlan(
      {
        client: 'c1',
        itemId: 'puntual-x',
        itemLabel: 'Puntual',
        price: 50,
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      } as any,
      'admin-1',
    );

    expect(created.pausedPlan).toBeUndefined();
  });
});

describe('PurchasesService.cancel / voidPurchase — retomar el plan pausado', () => {
  it('al cancelar un plan que tenía uno pausado, lo retoma', async () => {
    const purchaseModel = makePurchaseModelMock();
    const existing: any = {
      _id: 'punt-1',
      assignedInPerson: true,
      pausedPlan: 'active-1',
      save: jest.fn().mockResolvedValue(undefined),
    };
    purchaseModel.findById.mockResolvedValue(existing);
    const service = new PurchasesService(purchaseModel, {} as any);

    await service.cancel('punt-1', 'admin-1', FinalMonthBilling.FULL_MONTH);

    expect(existing.status).toBe(PurchaseStatus.CANCELLED);
    expect(purchaseModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'active-1', status: PurchaseStatus.PAUSED },
      { status: PurchaseStatus.ACTIVE },
    );
  });

  it('rechaza cancelar un plan pagado por Stripe', async () => {
    const purchaseModel = makePurchaseModelMock();
    purchaseModel.findById.mockResolvedValue({ _id: 'p1', assignedInPerson: false });
    const service = new PurchasesService(purchaseModel, {} as any);

    await expect(service.cancel('p1', 'admin-1')).rejects.toThrow(
      'Este plan se pagó por Stripe, no se puede parar desde aquí',
    );
  });

  it('al anular un plan que tenía uno pausado, también lo retoma', async () => {
    const purchaseModel = makePurchaseModelMock();
    const existing: any = {
      _id: 'punt-1',
      assignedInPerson: true,
      status: PurchaseStatus.ACTIVE,
      pausedPlan: 'active-1',
      save: jest.fn().mockResolvedValue(undefined),
    };
    purchaseModel.findById.mockResolvedValue(existing);
    const service = new PurchasesService(purchaseModel, {} as any);

    await service.voidPurchase('punt-1', 'admin-1');

    expect(existing.status).toBe(PurchaseStatus.VOIDED);
    expect(existing.finalMonthBilling).toBe(FinalMonthBilling.NONE);
    expect(purchaseModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'active-1', status: PurchaseStatus.PAUSED },
      { status: PurchaseStatus.ACTIVE },
    );
  });

  it('rechaza anular un plan que ya está anulado', async () => {
    const purchaseModel = makePurchaseModelMock();
    purchaseModel.findById.mockResolvedValue({
      _id: 'p1',
      assignedInPerson: true,
      status: PurchaseStatus.VOIDED,
    });
    const service = new PurchasesService(purchaseModel, {} as any);

    await expect(service.voidPurchase('p1', 'admin-1')).rejects.toThrow('Este plan ya está anulado');
  });
});

describe('PurchasesService — cierre automático de puntuales caducados', () => {
  it('cierra solo un puntual caducado y retoma lo que tenía pausado', async () => {
    const purchaseModel = makePurchaseModelMock();
    const expiredPlan: any = {
      _id: 'punt-1',
      status: PurchaseStatus.ACTIVE,
      scheduledEndDate: new Date('2024-06-01'),
      pausedPlan: 'active-1',
      save: jest.fn().mockResolvedValue(undefined),
    };
    purchaseModel.find.mockResolvedValue([expiredPlan]);
    const service = new PurchasesService(purchaseModel, {} as any);

    // Método privado, llamado directamente igual que en accounting.service.spec.ts,
    // para no tener que montar también la query de listado de findByClient.
    await (service as any).resolveExpiredPunctualPlans('c1');

    expect(expiredPlan.status).toBe(PurchaseStatus.COMPLETED);
    expect(expiredPlan.endedAt).toBe(expiredPlan.scheduledEndDate);
    expect(purchaseModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'active-1', status: PurchaseStatus.PAUSED },
      { status: PurchaseStatus.ACTIVE },
    );
  });
});

describe('PurchasesService.changePlan — distinto de cancel/void: no retoma, cierra definitivamente', () => {
  it('al cambiar de plan, cancela el plan pausado en vez de retomarlo', async () => {
    const purchaseModel = makePurchaseModelMock();
    const currentActive: any = {
      _id: 'punt-1',
      assignedInPerson: true,
      scheduledEndDate: new Date('2024-07-01'), // es un puntual
      pausedPlan: 'active-1',
      save: jest.fn().mockResolvedValue(undefined),
    };
    purchaseModel.findOne.mockResolvedValue(currentActive);
    const service = new PurchasesService(purchaseModel, {} as any);

    await service.changePlan(
      {
        client: 'c1',
        itemId: 'nuevo',
        itemLabel: 'Nuevo plan',
        price: 80,
        finalMonthBilling: FinalMonthBilling.SESSIONS,
      } as any,
      'admin-1',
    );

    expect(currentActive.status).toBe(PurchaseStatus.CANCELLED);
    expect(currentActive.endReason).toBe('changed');
    // Es un puntual (precio cerrado, nada que elegir): la decisión de
    // facturación va para el pausado, no para él.
    expect(currentActive.finalMonthBilling).toBeUndefined();
    expect(purchaseModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'active-1',
      expect.objectContaining({
        status: PurchaseStatus.CANCELLED,
        finalMonthBilling: FinalMonthBilling.SESSIONS,
      }),
    );
    // A diferencia de cancel/voidPurchase: aquí el pausado se cierra, nunca
    // se retoma (no hay llamada a resumePausedPlan / findOneAndUpdate).
    expect(purchaseModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rechaza cambiar un plan activo pagado por Stripe', async () => {
    const purchaseModel = makePurchaseModelMock();
    purchaseModel.findOne.mockResolvedValue({ _id: 'p1', assignedInPerson: false });
    const service = new PurchasesService(purchaseModel, {} as any);

    await expect(
      service.changePlan({ client: 'c1', itemId: 'x', itemLabel: 'X', price: 10 } as any, 'admin-1'),
    ).rejects.toThrow('El plan activo se pagó por Stripe, no se puede cambiar desde aquí');
  });
});
