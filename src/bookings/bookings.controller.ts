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

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@Body() body: CreateBookingDto) {
    return this.bookingsService.create(body);
  }

  @Get()
  find(
    @Req() req: any,
    @Query('trainer') trainer?: string,
    @Query('client') client?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const isAdmin = req.user.roles?.includes('admin');

    if (!from || !to) {
      throw new BadRequestException('Debes indicar from y to');
    }

    if (client) {
      if (!isAdmin && client !== req.user.userId) {
        throw new ForbiddenException('No puedes ver el calendario de otro cliente');
      }
      return this.bookingsService.findByClientAndRange(client, from, to);
    }

    if (trainer) {
      if (!isAdmin && trainer !== req.user.userId) {
        throw new ForbiddenException('No puedes ver el calendario de otro entrenador');
      }
      return this.bookingsService.findByTrainerAndRange(trainer, from, to);
    }

    throw new BadRequestException('Debes indicar trainer o client');
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateBookingDto) {
    return this.bookingsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}