import { OwedSessionsService } from './owed-sessions.service';

// Mismo patrón que el resto del proyecto: mock mínimo del modelo de
// Mongoose, sin TestingModule ni base de datos real.
function makeOwedSessionModelMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };
}

describe('OwedSessionsService.markOldestAsRecovered', () => {
  it('deja constancia en recoveredNote de la más antigua PENDIENTE, sin borrarla', async () => {
    const owedSessionModel: any = makeOwedSessionModelMock();
    const oldest: any = { _id: 'o1', save: jest.fn().mockResolvedValue(undefined) };
    owedSessionModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(oldest) });
    const service = new OwedSessionsService(owedSessionModel);

    await service.markOldestAsRecovered('client-1', '26 de octubre a las 10:00');

    // Solo busca entre las que no tienen recoveredNote todavía (pendientes).
    expect(owedSessionModel.findOne).toHaveBeenCalledWith({
      client: 'client-1',
      recoveredNote: { $exists: false },
    });
    expect(oldest.recoveredNote).toBe('26 de octubre a las 10:00');
    expect(oldest.save).toHaveBeenCalled();
  });

  it('si no hay ninguna pendiente, no hace nada (no falla)', async () => {
    const owedSessionModel: any = makeOwedSessionModelMock();
    owedSessionModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
    const service = new OwedSessionsService(owedSessionModel);

    await expect(service.markOldestAsRecovered('client-1', 'etiqueta')).resolves.toBeUndefined();
  });
});

describe('OwedSessionsService.remove', () => {
  it('borra una pendiente sin problema', async () => {
    const owedSessionModel: any = makeOwedSessionModelMock();
    owedSessionModel.findById.mockResolvedValue({ _id: 'o1', recoveredNote: undefined });
    const service = new OwedSessionsService(owedSessionModel);

    await service.remove('o1');

    expect(owedSessionModel.findByIdAndDelete).toHaveBeenCalledWith('o1');
  });

  it('rechaza borrar una ya recuperada, sin tocarla', async () => {
    const owedSessionModel: any = makeOwedSessionModelMock();
    owedSessionModel.findById.mockResolvedValue({
      _id: 'o1',
      recoveredNote: '26 de octubre a las 10:00',
    });
    const service = new OwedSessionsService(owedSessionModel);

    await expect(service.remove('o1')).rejects.toThrow(
      'Esta clase ya está recuperada, no se puede borrar',
    );
    expect(owedSessionModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('da 404 si no existe', async () => {
    const owedSessionModel: any = makeOwedSessionModelMock();
    owedSessionModel.findById.mockResolvedValue(null);
    const service = new OwedSessionsService(owedSessionModel);

    await expect(service.remove('no-existe')).rejects.toThrow('Clase debida no encontrada');
  });
});

describe('OwedSessionsService.countPendingByClients', () => {
  it('cuenta solo las pendientes (sin recoveredNote) de cada cliente', async () => {
    const owedSessionModel: any = makeOwedSessionModelMock();
    owedSessionModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { client: { toString: () => 'client-1' } },
          { client: { toString: () => 'client-1' } },
          { client: { toString: () => 'client-2' } },
        ]),
      }),
    });
    const service = new OwedSessionsService(owedSessionModel);

    const counts = await service.countPendingByClients(['client-1', 'client-2', 'client-3']);

    expect(owedSessionModel.find).toHaveBeenCalledWith({
      client: { $in: ['client-1', 'client-2', 'client-3'] },
      recoveredNote: { $exists: false },
    });
    expect(counts).toEqual({ 'client-1': 2, 'client-2': 1 });
  });
});
