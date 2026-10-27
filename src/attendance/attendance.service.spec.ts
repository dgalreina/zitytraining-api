import { AttendanceService } from './attendance.service';

// Mismo patrón que el resto del proyecto: mock mínimo del modelo de
// Mongoose, sin TestingModule ni base de datos real. find() se usa de
// dos formas distintas en este service: encadenado (.sort().exec(), en
// findByTrainer/findAll) y directamente esperado (resolveForgottenClockOuts),
// así que el resultado tiene que valer para las dos.
function makeQueryResult(data: any[]) {
  return {
    sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(data) }),
    then: (resolve: (v: any[]) => void) => resolve(data),
  };
}

function makeTimeEntryModelMock() {
  return {
    find: jest.fn().mockReturnValue(makeQueryResult([])),
    findOne: jest.fn().mockResolvedValue(null),
  };
}

describe('AttendanceService.findByTrainer', () => {
  it('sin from/to, pide todo el histórico de ese entrenador (la lista editable de "Mi fichaje")', async () => {
    const timeEntryModel: any = makeTimeEntryModelMock();
    const service = new AttendanceService(timeEntryModel);

    await service.findByTrainer('t1');

    expect(timeEntryModel.find).toHaveBeenCalledWith({ trainer: 't1' });
  });

  it('con from/to, acota por clockIn (para el calendario semanal propio)', async () => {
    const timeEntryModel: any = makeTimeEntryModelMock();
    const service = new AttendanceService(timeEntryModel);

    await service.findByTrainer('t1', '2024-06-01T00:00:00.000Z', '2024-06-30T23:59:59.999Z');

    expect(timeEntryModel.find).toHaveBeenCalledWith({
      trainer: 't1',
      clockIn: {
        $gte: new Date('2024-06-01T00:00:00.000Z'),
        $lte: new Date('2024-06-30T23:59:59.999Z'),
      },
    });
  });
});
