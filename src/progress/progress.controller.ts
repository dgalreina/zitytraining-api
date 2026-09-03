import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { CreateProgressEntryDto } from './dto/create-progress-entry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

// Mismos permisos que el resto de datos de clientes: admin y entrenador.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TRAINER)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post()
  create(@Body() body: CreateProgressEntryDto) {
    return this.progressService.create(body);
  }

  @Get('client/:clientId')
  findByClient(@Param('clientId') clientId: string) {
    return this.progressService.findByClient(clientId);
  }
}
