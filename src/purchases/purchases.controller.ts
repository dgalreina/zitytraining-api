import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseStatus } from './purchases.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: any, @Body() body: CreatePurchaseDto) {
    return this.purchasesService.create(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/checkout')
  createCheckout(@Req() req: any, @Param('id') id: string) {
    return this.purchasesService.createCheckoutSession(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMine(@Req() req: any) {
    return this.purchasesService.findByClient(req.user.userId);
  }

  // Admin o entrenador: ver las compras de un cliente concreto
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Get('client/:id')
  findByClient(@Param('id') id: string) {
    return this.purchasesService.findByClient(id);
  }

  // Temporal, mientras se termina de verificar el flujo completo del webhook.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: PurchaseStatus) {
    return this.purchasesService.updateStatus(id, status);
  }

  // Sin guards: Stripe llama a esto directamente, verificado por firma, no por JWT.
  @Post('webhook')
  handleWebhook(@Req() req: any, @Headers('stripe-signature') signature: string) {
    const event = this.purchasesService.constructWebhookEvent(req.rawBody, signature);
    return this.purchasesService.handleStripeEvent(event);
  }
}