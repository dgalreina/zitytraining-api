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
  // Cualquier entrenador puede gestionar la de cualquier otro entrenador,
  // salvo las privadas (ver bookings.service).
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Post()
  create(@Req() req: any, @Body() body: CreateBookingDto) {
    // Una sesión privada siempre es de quien la crea, no se elige entrenador.
    if (body.isPrivate) {
      body.trainer = req.user.userId;
    }
    return this.bookingsService.create(body);
  }

  @Get()
  find(
    @Req() req: any,
    @Query('trainer') trainer?: string,
    @Query('trainers') trainersParam?: string,
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

    // Filtro por cliente concreto: el propio cliente, o admin/entrenador
    // consultando (para poder ver el calendario de cualquier cliente).
    if (client) {
      if (!isAdmin && !isTrainerRole && client !== req.user.userId) {
        throw new ForbiddenException('No puedes ver el calendario de otro cliente');
      }
      return this.bookingsService.findByClientAndRange(client, from, to);
    }

    // Varios entrenadores a la vez (checklist): de 1 a N, admin o entrenador.
    if (trainersParam) {
      if (!isAdmin && !isTrainerRole) {
        throw new ForbiddenException('No puedes ver el calendario de un entrenador');
      }
      const trainerIds = trainersParam.split(',').filter(Boolean);
      return this.bookingsService.findByTrainersAndRange(trainerIds, req.user.userId, from, to);
    }

    // Vista "todos los entrenadores", se mantiene por compatibilidad.
    if (scope === 'all') {
      if (!isAdmin && !isTrainerRole) {
        throw new ForbiddenException('Solo un administrador o entrenador puede ver todos los entrenadores');
      }
      return this.bookingsService.findAllInRange(req.user.userId, from, to);
    }

    if (trainer) {
      if (!isAdmin && !isTrainerRole) {
        throw new ForbiddenException('No puedes ver el calendario de un entrenador');
      }
      return this.bookingsService.findByTrainerAndRange(trainer, req.user.userId, from, to);
    }

    throw new BadRequestException('Debes indicar trainer, trainers, client, o scope=all');
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: UpdateBookingDto) {
    return this.bookingsService.update(id, body, req.user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.bookingsService.remove(id, req.user.userId);
  }
}