import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { Role, UserStatus } from '../users/users.schema';

// Hash real (no se mockea bcrypt): generarlo una vez es barato y evita
// tener que adivinar la forma exacta de su API.
const PASSWORD_HASH = bcrypt.hashSync('secret123', 10);

function makeUsersService(findByEmailResult: any = null) {
  return {
    findByEmail: jest.fn().mockResolvedValue(findByEmailResult),
    findOne: jest.fn(),
  } as any;
}

function makeJwtService() {
  return { sign: jest.fn().mockReturnValue('fake.jwt.token') } as any;
}

function makeRefreshTokenModel() {
  return {
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
    deleteOne: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
  } as any;
}

function makePasswordResetModel() {
  return {
    deleteMany: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
  } as any;
}

// findOne(...).collation(...) es justo la query que arregló el bug de hoy
// (un email guardado con mayúsculas no se encontraba). El mock reproduce
// esa misma cadena para poder comprobar que sigue ahí.
function makeUserModel(findOneResult: any = null) {
  return {
    findOne: jest.fn().mockReturnValue({
      collation: jest.fn().mockResolvedValue(findOneResult),
    }),
    findById: jest.fn(),
  } as any;
}

function makeMailService() {
  return { send: jest.fn().mockResolvedValue(undefined) } as any;
}

describe('AuthService.login', () => {
  it('entra correctamente con credenciales válidas y rol permitido', async () => {
    const user = {
      _id: 'u1',
      email: 'ana@gym.com',
      password: PASSWORD_HASH,
      status: UserStatus.ACTIVE,
      roles: [Role.TRAINER],
      firstName: 'Ana',
      lastName: 'G',
      color: '#fff',
      mustChangePassword: false,
    };
    const refreshTokenModel = makeRefreshTokenModel();
    const service = new AuthService(
      makeUsersService(user),
      makeJwtService(),
      refreshTokenModel,
      makePasswordResetModel(),
      makeUserModel(),
      makeMailService(),
    );

    const result = await service.login('ana@gym.com', 'secret123');

    expect(result.access_token).toBe('fake.jwt.token');
    expect(result.refresh_token).toBeDefined();
    expect(result.user.email).toBe('ana@gym.com');
    expect(refreshTokenModel.create).toHaveBeenCalledTimes(1);
  });

  it('rechaza con el mismo mensaje genérico si el usuario no existe', async () => {
    const service = new AuthService(
      makeUsersService(null),
      makeJwtService(),
      makeRefreshTokenModel(),
      makePasswordResetModel(),
      makeUserModel(),
      makeMailService(),
    );

    await expect(service.login('nadie@gym.com', 'x')).rejects.toThrow('Credenciales inválidas');
  });

  it('rechaza si el usuario no tiene contraseña (cliente dado de alta a mano)', async () => {
    const user = { _id: 'u1', email: 'c@x.com', password: undefined, status: UserStatus.ACTIVE, roles: [Role.CLIENT] };
    const service = new AuthService(
      makeUsersService(user),
      makeJwtService(),
      makeRefreshTokenModel(),
      makePasswordResetModel(),
      makeUserModel(),
      makeMailService(),
    );

    await expect(service.login('c@x.com', 'x')).rejects.toThrow('Credenciales inválidas');
  });

  it('rechaza si la contraseña no coincide', async () => {
    const user = { _id: 'u1', email: 'ana@gym.com', password: PASSWORD_HASH, status: UserStatus.ACTIVE, roles: [Role.ADMIN] };
    const service = new AuthService(
      makeUsersService(user),
      makeJwtService(),
      makeRefreshTokenModel(),
      makePasswordResetModel(),
      makeUserModel(),
      makeMailService(),
    );

    await expect(service.login('ana@gym.com', 'mala')).rejects.toThrow('Credenciales inválidas');
  });

  it('rechaza si la cuenta está inhabilitada', async () => {
    const user = { _id: 'u1', email: 'ana@gym.com', password: PASSWORD_HASH, status: UserStatus.INACTIVE, roles: [Role.ADMIN] };
    const service = new AuthService(
      makeUsersService(user),
      makeJwtService(),
      makeRefreshTokenModel(),
      makePasswordResetModel(),
      makeUserModel(),
      makeMailService(),
    );

    await expect(service.login('ana@gym.com', 'secret123')).rejects.toThrow('Tu cuenta está inhabilitada');
  });

  it('rechaza a un cliente puro (sin rol admin/entrenador), aunque la contraseña sea correcta', async () => {
    const user = { _id: 'u1', email: 'c@x.com', password: PASSWORD_HASH, status: UserStatus.ACTIVE, roles: [Role.CLIENT] };
    const service = new AuthService(
      makeUsersService(user),
      makeJwtService(),
      makeRefreshTokenModel(),
      makePasswordResetModel(),
      makeUserModel(),
      makeMailService(),
    );

    await expect(service.login('c@x.com', 'secret123')).rejects.toThrow(
      'Esta app todavía no está disponible para clientes',
    );
  });
});

describe('AuthService.forgotPassword', () => {
  it('busca el usuario con collation case-insensitive (regresión: así se arregló que no se encontraba un email guardado con mayúsculas)', async () => {
    const user = { _id: 'u1', email: 'Jana@gym.com', password: PASSWORD_HASH, firstName: 'Jana' };
    const userModel = makeUserModel(user);
    const passwordResetModel = makePasswordResetModel();
    const mailService = makeMailService();
    const service = new AuthService(
      makeUsersService(),
      makeJwtService(),
      makeRefreshTokenModel(),
      passwordResetModel,
      userModel,
      mailService,
    );

    await service.forgotPassword('jana@gym.com');

    expect(userModel.findOne).toHaveBeenCalledWith({ email: 'jana@gym.com', status: UserStatus.ACTIVE });
    const findOneReturn = userModel.findOne.mock.results[0].value;
    expect(findOneReturn.collation).toHaveBeenCalledWith({ locale: 'es', strength: 2 });
    expect(passwordResetModel.create).toHaveBeenCalledTimes(1);
    expect(mailService.send).toHaveBeenCalledTimes(1);
  });

  it('si no encuentra al usuario, no crea token ni manda mail, pero responde success igual (anti-enumeración)', async () => {
    const passwordResetModel = makePasswordResetModel();
    const mailService = makeMailService();
    const service = new AuthService(
      makeUsersService(),
      makeJwtService(),
      makeRefreshTokenModel(),
      passwordResetModel,
      makeUserModel(null),
      mailService,
    );

    const result = await service.forgotPassword('nadie@gym.com');

    expect(result).toEqual({ success: true });
    expect(passwordResetModel.create).not.toHaveBeenCalled();
    expect(mailService.send).not.toHaveBeenCalled();
  });

  it('si el usuario no tiene contraseña (cliente sin acceso), tampoco crea token ni manda mail', async () => {
    const user = { _id: 'u1', email: 'c@x.com', password: undefined, firstName: 'C' };
    const passwordResetModel = makePasswordResetModel();
    const service = new AuthService(
      makeUsersService(),
      makeJwtService(),
      makeRefreshTokenModel(),
      passwordResetModel,
      makeUserModel(user),
      makeMailService(),
    );

    const result = await service.forgotPassword('c@x.com');

    expect(result).toEqual({ success: true });
    expect(passwordResetModel.create).not.toHaveBeenCalled();
  });

  it('borra cualquier token de restablecimiento anterior antes de crear uno nuevo', async () => {
    const user = { _id: 'u1', email: 'ana@gym.com', password: PASSWORD_HASH, firstName: 'Ana' };
    const passwordResetModel = makePasswordResetModel();
    const service = new AuthService(
      makeUsersService(),
      makeJwtService(),
      makeRefreshTokenModel(),
      passwordResetModel,
      makeUserModel(user),
      makeMailService(),
    );

    await service.forgotPassword('ana@gym.com');

    expect(passwordResetModel.deleteMany).toHaveBeenCalledWith({ user: 'u1' });
  });
});

describe('AuthService.resetPassword', () => {
  it('con un token válido, cambia la contraseña y cierra las sesiones abiertas', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user: any = { _id: 'u1', password: 'old-hash', mustChangePassword: true, save };
    const passwordResetModel = makePasswordResetModel();
    passwordResetModel.findOne.mockResolvedValue({ user: 'u1', expiresAt: new Date(Date.now() + 1000) });
    const refreshTokenModel = makeRefreshTokenModel();
    const userModel = makeUserModel();
    userModel.findById.mockResolvedValue(user);
    const service = new AuthService(
      makeUsersService(),
      makeJwtService(),
      refreshTokenModel,
      passwordResetModel,
      userModel,
      makeMailService(),
    );

    const result = await service.resetPassword('token-raw', 'NuevaSegura123!');

    expect(result).toEqual({ success: true });
    expect(user.password).not.toBe('old-hash');
    expect(user.mustChangePassword).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(passwordResetModel.deleteMany).toHaveBeenCalledWith({ user: 'u1' });
    expect(refreshTokenModel.deleteMany).toHaveBeenCalledWith({ user: 'u1' });
  });

  it('rechaza un token caducado o que no existe', async () => {
    const passwordResetModel = makePasswordResetModel();
    passwordResetModel.findOne.mockResolvedValue(null);
    const service = new AuthService(
      makeUsersService(),
      makeJwtService(),
      makeRefreshTokenModel(),
      passwordResetModel,
      makeUserModel(),
      makeMailService(),
    );

    await expect(service.resetPassword('token-raw', 'x')).rejects.toThrow(
      'El enlace no es válido o ha caducado',
    );
  });
});
