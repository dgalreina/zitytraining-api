import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { OwedSessionsService } from './owed-sessions.service';
import { CreateOwedSessionDto } from './dto/create-owed-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TRAINER)
@Controller('owed-sessions')
export class OwedSessionsController {
  constructor(private readonly owedSessionsService: OwedSessionsService) {}

  @Get()
  findByClient(@Query('client') client: string) {
    return this.owedSessionsService.findByClient(client);
  }

  @Post()
  create(@Body() body: CreateOwedSessionDto) {
    return this.owedSessionsService.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.owedSessionsService.remove(id);
  }
}
