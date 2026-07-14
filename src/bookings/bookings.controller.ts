import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
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
  findByTrainerAndRange(
    @Query('trainer') trainer: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.bookingsService.findByTrainerAndRange(trainer, from, to);
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