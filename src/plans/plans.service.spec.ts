import { PlansService } from './plans.service';
import { PlanCategory } from './plans.schema';

function makePlanModelMock() {
  const Ctor: any = jest.fn().mockImplementation(function (this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  Ctor.findOne = jest.fn().mockResolvedValue(null);
  Ctor.findById = jest.fn();
  Ctor.findByIdAndDelete = jest.fn();
  Ctor.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
  });
  return Ctor;
}

describe('PlansService.create', () => {
  it('rechaza crear un plan de categoría "sesiones libres" a mano', async () => {
    const planModel = makePlanModelMock();
    const service = new PlansService(planModel);

    await expect(
      service.create({
        category: PlanCategory.SESIONES_LIBRES,
        sessionsPerWeek: 2,
        durationMinutes: 60,
        monthlyPrice: 100,
      } as any),
    ).rejects.toThrow('Sesiones libres se calcula solo a partir de Entrenamiento personal, no se puede crear a mano');
  });

  it('calcula sessionCount, sessionPrice y label a partir de sesiones/semana, duración y precio mensual', async () => {
    const planModel = makePlanModelMock();
    const service = new PlansService(planModel);

    const created: any = await service.create({
      category: PlanCategory.PERSONAL,
      sessionsPerWeek: 2,
      durationMinutes: 60,
      monthlyPrice: 100,
    } as any);

    expect(created.sessionCount).toBe(8); // 2 * 4 semanas
    expect(created.sessionPrice).toBe(12.5); // 100 / 8
    expect(created.label).toBe('2 días/sem · 1h');
  });

  it('formatea la duración en minutos cuando no es un número exacto de horas', async () => {
    const planModel = makePlanModelMock();
    const service = new PlansService(planModel);

    const created: any = await service.create({
      category: PlanCategory.PERSONAL,
      sessionsPerWeek: 3,
      durationMinutes: 40,
      monthlyPrice: 90,
    } as any);

    expect(created.label).toBe("3 días/sem · 40'");
  });
});

describe('PlansService.update', () => {
  it('rechaza editar un plan existente de "sesiones libres"', async () => {
    const planModel = makePlanModelMock();
    planModel.findById.mockResolvedValue({ category: PlanCategory.SESIONES_LIBRES });
    const service = new PlansService(planModel);

    await expect(service.update('p1', { monthlyPrice: 50 } as any)).rejects.toThrow(
      'Sesiones libres se calcula solo a partir de Entrenamiento personal, no se puede editar a mano',
    );
  });

  it('rechaza cambiar un plan normal a la categoría "sesiones libres"', async () => {
    const planModel = makePlanModelMock();
    planModel.findById.mockResolvedValue({ category: PlanCategory.PERSONAL });
    const service = new PlansService(planModel);

    await expect(
      service.update('p1', { category: PlanCategory.SESIONES_LIBRES } as any),
    ).rejects.toThrow('no se puede editar a mano');
  });

  it('recalcula sessionCount/sessionPrice/label al editar, incluso cambiando solo el precio', async () => {
    const planModel = makePlanModelMock();
    const existing: any = {
      category: PlanCategory.PERSONAL,
      sessionsPerWeek: 2,
      durationMinutes: 60,
      monthlyPrice: 100,
      sessionPrice: 12.5,
      sessionCount: 8,
      label: '2 días/sem · 1h',
    };
    existing.save = jest.fn().mockResolvedValue(existing);
    planModel.findById.mockResolvedValue(existing);
    const service = new PlansService(planModel);

    const updated: any = await service.update('p1', { monthlyPrice: 120 } as any);

    expect(updated.monthlyPrice).toBe(120);
    expect(updated.sessionCount).toBe(8); // sin cambios: sigue siendo 2 días/sem * 4
    expect(updated.sessionPrice).toBe(15); // 120 / 8
  });
});

describe('PlansService.findAll — "sesiones libres" calculadas al vuelo', () => {
  it('solo genera la variante cuyo plan ancla existe, y se salta el resto', async () => {
    const planModel = makePlanModelMock();
    planModel.findOne.mockImplementation((query: any) => {
      if (
        query.category === PlanCategory.PERSONAL &&
        query.sessionsPerWeek === 3 &&
        query.durationMinutes === 60
      ) {
        return Promise.resolve({ sessionPrice: 25 });
      }
      return Promise.resolve(null);
    });
    const service = new PlansService(planModel);

    const all = await service.findAll();

    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      _id: 'sesiones-libres-personal-3d-60',
      category: PlanCategory.SESIONES_LIBRES,
      anchorCategory: PlanCategory.PERSONAL,
      sessionsPerWeek: 3,
      durationMinutes: 60,
      sessionPrice: 25,
      sessionCount: 12,
      monthlyPrice: 300, // 25 * 12 sesiones/mes
    });
    expect(all[0].label).toContain('Sesiones libres (precio 3 días/sem)');
  });

  it('añade el apellido dúo/trío según de qué plan ancla sale el precio', async () => {
    const planModel = makePlanModelMock();
    planModel.findOne.mockImplementation((query: any) => {
      if (
        query.category === PlanCategory.DUO &&
        query.sessionsPerWeek === 2 &&
        query.durationMinutes === 40
      ) {
        return Promise.resolve({ sessionPrice: 18 });
      }
      return Promise.resolve(null);
    });
    const service = new PlansService(planModel);

    const all = await service.findAll();

    expect(all).toHaveLength(1);
    expect(all[0].label).toContain('Sesiones libres dúo');
  });

  it('junta los planes guardados con los de "sesiones libres" calculados', async () => {
    const planModel = makePlanModelMock();
    const storedPlan = { _id: 's1', category: PlanCategory.PERSONAL, label: '2 días/sem · 1h' };
    planModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([storedPlan]) }),
    });
    const service = new PlansService(planModel);

    const all = await service.findAll();

    expect(all).toEqual([storedPlan]);
    expect(planModel.find).toHaveBeenCalledWith({ category: { $ne: PlanCategory.SESIONES_LIBRES } });
  });
});

describe('PlansService.remove', () => {
  it('lanza NotFoundException si el plan a borrar no existe', async () => {
    const planModel = makePlanModelMock();
    planModel.findByIdAndDelete.mockResolvedValue(null);
    const service = new PlansService(planModel);

    await expect(service.remove('no-existe')).rejects.toThrow('Plan with id no-existe not found');
  });
});
