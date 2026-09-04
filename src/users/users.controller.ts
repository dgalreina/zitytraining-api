import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, UserStatus } from './users.schema';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() body: CreateUserDto) {
    return this.usersService.create(body); // público, registro de clientes
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin')
  createByAdmin(@Body() body: CreateUserByAdminDto) {
    return this.usersService.createByAdmin(body);
  }

  // --- Rutas de perfil propio: cualquier usuario autenticado, sin requerir admin ---
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return this.usersService.findOne(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@Req() req: any, @Body() body: UpdateOwnProfileDto) {
    return this.usersService.update(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  changeMyPassword(@Req() req: any, @Body() body: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.userId, body);
  }
  // --- Fin rutas de perfil propio ---

  // --- Lista de clientes activos, para que entrenadores puedan elegirlos al crear sesiones ---
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TRAINER, Role.ADMIN)
  @Get('clients')
  listActiveClients() {
    return this.usersService.findActiveClients();
  }
  // --- Fin lista de clientes activos ---

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.usersService.update(id, body);
  }

  // Sin query: todos menos los eliminados. ?status=deleted: solo los
  // eliminados (para la papelera), aparte, no se mezcla con "todos".
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  findAll(@Query('status') status?: UserStatus) {
    return this.usersService.findAll(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // Borrado blando: deja de aparecer en los listados, pero no se toca
  // el documento (compras, fichas de salud, etc. siguen intactas).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.usersService.remove(id, req.user.userId);
  }
}