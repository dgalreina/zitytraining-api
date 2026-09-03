import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Role, User, UserStatus } from './users.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) { }

  async create(data: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const created = new this.userModel({
      ...data,
      password: hashedPassword,
      roles: [Role.CLIENT],
      status: UserStatus.PENDING,
    });
    return created.save();
  }

  private readonly fieldNames: Record<string, string> = {
  email: 'email',
};

  async createByAdmin(data: CreateUserByAdminDto): Promise<User> {
  // Un cliente no necesita contraseña, no puede entrar en la app.
  const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : undefined;

  try {
    const created = new this.userModel({
      ...data,
      password: hashedPassword,
      status: UserStatus.ACTIVE,
    });
    return await created.save();
  } catch (err: any) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      const label = this.fieldNames[field] || field;
      throw new ConflictException(`Ya existe un usuario con ese ${label}`);
    }
    throw err;
  }
}

  async update(id: string, data: UpdateUserDto): Promise<User> {
  try {
    const user = await this.userModel.findByIdAndUpdate(id, data, { new: true });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  } catch (err: any) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      const label = this.fieldNames[field] || field;
      throw new ConflictException(`Ya existe un usuario con ese ${label}`);
    }
    throw err;
  }
}

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async findActiveClients(): Promise<User[]> {
  return this.userModel
    .find({ roles: Role.CLIENT, status: UserStatus.ACTIVE })
    .select('firstName lastName')
    .exec();
}

  async approve(id: string): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { status: UserStatus.ACTIVE },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async reject(id: string): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { status: UserStatus.REJECTED },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async changePassword(id: string, data: ChangePasswordDto): Promise<{ success: true }> {
    const user = await this.userModel.findById(id);
    if (!user || !user.password) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const currentMatches = await bcrypt.compare(data.currentPassword, user.password);
    if (!currentMatches) {
      // No usamos 401 aquí a propósito: el frontend trata cualquier 401
      // como "sesión caducada" y cierra la sesión + redirige a /login, lo
      // cual sería muy raro solo por escribir mal la contraseña actual.
      throw new ForbiddenException('La contraseña actual no es correcta');
    }

    const newSameAsOld = await bcrypt.compare(data.newPassword, user.password);
    if (newSameAsOld) {
      throw new BadRequestException('La nueva contraseña tiene que ser distinta de la actual');
    }

    user.password = await bcrypt.hash(data.newPassword, 10);
    await user.save();
    return { success: true };
  }
}