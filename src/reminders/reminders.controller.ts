import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { LogReminderDto } from './dto/log-reminder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TRAINER)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  // El entrenador sale siempre del token, nunca de lo que mande el cliente:
  // así nadie puede consultar ni apuntar envíos en nombre de otro.
  @Get()
  findWeek(@Req() req: any, @Query('weekStart') weekStart: string) {
    return this.remindersService.findWeek(req.user.userId, weekStart);
  }

  @Post()
  log(@Req() req: any, @Body() body: LogReminderDto) {
    return this.remindersService.log(req.user.userId, body);
  }
}
