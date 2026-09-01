import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Solo admin o entrenador pueden crear/editar/borrar sesiones.
  // Cualquier entrenador puede gestionar la de cualquier otro entrenador.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Post()
  create(@Body() body: CreateBookingDto) {
    return this.bookingsService.create(body);
  }

  @Get()
  find(
    @Req() req: any,
    @Query('trainer') trainer?: string,
    @Query('client') client?: string,
    @Query('scope') scope?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const isAdmin = req.user.roles?.includes('admin');
    const isTrainerRole = req.user.roles?.includes('trainer');

    if (!from || !to) {
      throw new BadRequestException('Debes indicar from y to');
    }

    // Vista "ver todos los entrenadores a la vez": admin o entrenador.
    if (scope === 'all') {
      if (!isAdmin && !isTrainerRole) {
        throw new ForbiddenException('Solo un administrador o entrenador puede ver todos los entrenadores');
      }
      return this.bookingsService.findAllInRange(from, to);
    }

    // Filtro por cliente concreto: el propio cliente, o admin/entrenador
    // consultando (para poder ver el calendario de cualquier cliente).
    if (client) {
      if (!isAdmin && !isTrainerRole && client !== req.user.userId) {
        throw new ForbiddenException('No puedes ver el calendario de otro cliente');
      }
      return this.bookingsService.findByClientAndRange(client, from, to);
    }

    if (trainer) {
      if (!isAdmin && !isTrainerRole) {
        throw new ForbiddenException('No puedes ver el calendario de un entrenador');
      }
      return this.bookingsService.findByTrainerAndRange(trainer, from, to);
    }

    throw new BadRequestException('Debes indicar trainer, client, o scope=all');
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateBookingDto) {
    return this.bookingsService.update(id, body);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}