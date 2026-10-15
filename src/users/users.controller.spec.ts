import { UsersController } from './users.controller';
import { Role } from './users.schema';

function makeUsersServiceMock() {
  return {
    createByAdmin: jest.fn().mockResolvedValue({ _id: 'new-user' }),
  } as any;
}

function makeReq(roles: Role[]) {
  return { user: { userId: 'u1', roles } };
}

describe('UsersController.createByAdmin — quién puede dar de alta a quién', () => {
  it('un entrenador puede dar de alta a un cliente (el bug que falló en producción)', async () => {
    const usersService = makeUsersServiceMock();
    const controller = new UsersController(usersService);
    const body: any = { firstName: 'Henar', lastName: 'Martínez', phone: '600000000', roles: [Role.CLIENT] };

    await controller.createByAdmin(makeReq([Role.TRAINER]), body);

    expect(usersService.createByAdmin).toHaveBeenCalledWith(body);
  });

  it('un admin puede dar de alta a otro admin o entrenador', async () => {
    const usersService = makeUsersServiceMock();
    const controller = new UsersController(usersService);
    const body: any = { firstName: 'Nuevo', lastName: 'Entrenador', phone: '600000000', roles: [Role.TRAINER] };

    await controller.createByAdmin(makeReq([Role.ADMIN]), body);

    expect(usersService.createByAdmin).toHaveBeenCalledWith(body);
  });

  it('un entrenador NO puede darse de alta a sí mismo (ni a nadie) como admin', async () => {
    const usersService = makeUsersServiceMock();
    const controller = new UsersController(usersService);
    const body: any = { firstName: 'X', lastName: 'Y', phone: '600000000', roles: [Role.ADMIN] };

    expect(() => controller.createByAdmin(makeReq([Role.TRAINER]), body)).toThrow(
      'Solo un admin puede dar de alta a otro admin o entrenador',
    );
    expect(usersService.createByAdmin).not.toHaveBeenCalled();
  });

  it('un entrenador NO puede dar de alta a otro entrenador', async () => {
    const usersService = makeUsersServiceMock();
    const controller = new UsersController(usersService);
    const body: any = { firstName: 'X', lastName: 'Y', phone: '600000000', roles: [Role.TRAINER] };

    expect(() => controller.createByAdmin(makeReq([Role.TRAINER]), body)).toThrow(
      'Solo un admin puede dar de alta a otro admin o entrenador',
    );
    expect(usersService.createByAdmin).not.toHaveBeenCalled();
  });

  it('un entrenador no puede colar roles de más aunque incluya "client"', async () => {
    const usersService = makeUsersServiceMock();
    const controller = new UsersController(usersService);
    const body: any = { firstName: 'X', lastName: 'Y', phone: '600000000', roles: [Role.CLIENT, Role.TRAINER] };

    expect(() => controller.createByAdmin(makeReq([Role.TRAINER]), body)).toThrow(
      'Solo un admin puede dar de alta a otro admin o entrenador',
    );
    expect(usersService.createByAdmin).not.toHaveBeenCalled();
  });
});
