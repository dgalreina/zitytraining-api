import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  // Cualquier usuario logueado: los dos calendarios (sesiones y fichajes)
  // necesitan marcar los festivos, no solo el admin.
  @UseGuards(JwtAuthGuard)
  @Get()
  findByYear(@Query('year') year?: string) {
    const y = Number(year) || new Date().getFullYear();
    return this.holidaysService.findByYear(y);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() body: CreateHolidayDto) {
    return this.holidaysService.create(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('resync')
  resync(@Query('year') year?: string) {
    const y = Number(year) || new Date().getFullYear();
    return this.holidaysService.resyncYear(y);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}
