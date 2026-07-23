import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseStatus } from './purchases.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

@UseGuards(JwtAuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  create(@Req() req: any, @Body() body: CreatePurchaseDto) {
    return this.purchasesService.create(req.user.userId, body);
  }

  @Get('me')
  findMine(@Req() req: any) {
    return this.purchasesService.findByClient(req.user.userId);
  }

  // Temporal, mientras no está Stripe conectado: el admin puede marcar
  // manualmente una compra como pagada, para poder probar el resto del flujo.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: PurchaseStatus) {
    return this.purchasesService.updateStatus(id, status);
  }
}