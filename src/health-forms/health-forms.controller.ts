import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { HealthFormsService } from './health-forms.service';
import { CreateHealthFormDto } from './dto/create-health-form.dto';
import { UpdateHealthFormDto } from './dto/update-health-form.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

// Datos de salud del cliente (antigua ficha en papel); solo admin y
// entrenador gestionan clientes, así que se mantienen los mismos
// permisos que en el resto de endpoints de clientes.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TRAINER)
@Controller('health-forms')
export class HealthFormsController {
  constructor(private readonly healthFormsService: HealthFormsService) {}

  @Post()
  create(@Body() body: CreateHealthFormDto) {
    return this.healthFormsService.create(body);
  }

  @Get('client/:clientId')
  findByClient(@Param('clientId') clientId: string) {
    return this.healthFormsService.findByClient(clientId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateHealthFormDto) {
    return this.healthFormsService.update(id, body);
  }
}
