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
import { AssignPlanDto } from './dto/assign-plan.dto';
import { AssignPunctualPlanDto } from './dto/assign-punctual-plan.dto';
import { UpdatePurchaseDatesDto } from './dto/update-purchase-dates.dto';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto';
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

  // Al entrenador se le manda solo lo que esta en curso, que es lo que
  // ve en "Plan activo". El historial de contrataciones es informacion de
  // administracion, asi que ni se le envia: esconderlo solo en la pantalla
  // dejaria los datos a la vista de cualquiera que mire las peticiones.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Get('client/:id')
  findByClient(@Req() req: any, @Param('id') id: string) {
    const isAdmin = req.user.roles?.includes(Role.ADMIN);
    return this.purchasesService.findByClient(id, { onlyCurrent: !isAdmin });
  }

  // Solo admin: contratar planes es cosa de administracion, un
  // entrenador ve el plan activo de su cliente pero no lo toca.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('assign')
  assignPlan(@Req() req: any, @Body() body: AssignPlanDto) {
    return this.purchasesService.assignPlan(body, req.user.userId);
  }

  // Solo admin: plan puntual con fecha de fin; pausa el plan activo del
  // cliente mientras dura y lo retoma al acabar.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('assign-punctual')
  assignPunctualPlan(@Req() req: any, @Body() body: AssignPunctualPlanDto) {
    return this.purchasesService.assignPunctualPlan(body, req.user.userId);
  }

  // Solo admin: sustituir el plan activo por otro directamente
  // (definitivo, no se retoma el anterior).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('change')
  changePlan(@Req() req: any, @Body() body: AssignPlanDto) {
    return this.purchasesService.changePlan(body, req.user.userId);
  }

  // Solo admin: parar un plan asignado a mano en cualquier momento.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string, @Body() body: CancelPurchaseDto) {
    return this.purchasesService.cancel(id, req.user.userId, body.finalMonthBilling);
  }

  // Solo admin: anular un plan asignado por error, sin facturar nada.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/void')
  voidPurchase(@Req() req: any, @Param('id') id: string) {
    return this.purchasesService.voidPurchase(id, req.user.userId);
  }

  // Solo admin: corregir la fecha de inicio/fin de un plan asignado a
  // mano, por si se introdujo mal.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/dates')
  updateDates(@Req() req: any, @Param('id') id: string, @Body() body: UpdatePurchaseDatesDto) {
    return this.purchasesService.updateDates(id, body, req.user.userId);
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