import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Post('clock-in')
  clockIn(@Req() req: any) {
    return this.attendanceService.clockIn(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Post('clock-out')
  clockOut(@Req() req: any) {
    return this.attendanceService.clockOut(req.user.userId);
  }

  // Fichaje a mano, por si se olvidó fichar en su momento.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Post('manual')
  createManual(@Req() req: any, @Body() body: CreateManualEntryDto) {
    return this.attendanceService.createManual(req.user.userId, body.clockIn, body.clockOut);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Get('status')
  getStatus(@Req() req: any) {
    return this.attendanceService.getStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Get('me')
  findMine(@Req() req: any) {
    return this.attendanceService.findByTrainer(req.user.userId);
  }

  // Para el admin: fichajes de todos los entrenadores.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.attendanceService.findAll(from, to);
  }
}
