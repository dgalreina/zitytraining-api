import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Role, User, UserStatus } from './users.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) { }

  async create(data: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const created = new this.userModel({
      ...data,
      password: hashedPassword,
    });
    return created.save();
  }

  private readonly fieldNames: Record<string, string> = {
  email: 'email',
  membershipNumber: 'número de socio',
};

  async createByAdmin(data: CreateUserByAdminDto): Promise<User> {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const membershipNumber = data.roles.includes(Role.CLIENT)
    ? await this.generateMembershipNumber()
    : undefined;

  try {
    const created = new this.userModel({
      ...data,
      password: hashedPassword,
      status: UserStatus.ACTIVE,
      membershipNumber,
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

  private async generateMembershipNumber(): Promise<string> {
  const clients = await this.userModel
    .find({ membershipNumber: { $exists: true, $ne: null } })
    .select('membershipNumber')
    .exec();

  const numbers = clients
    .map((c) => parseInt(c.membershipNumber?.replace('SOC-', '') || '0', 10))
    .filter((n) => !isNaN(n));

  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `SOC-${nextNumber.toString().padStart(4, '0')}`;
}
}