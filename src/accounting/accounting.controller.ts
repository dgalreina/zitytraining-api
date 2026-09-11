import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { SetPaymentDto } from './dto/set-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get()
  getMonth(@Query('year') year: string, @Query('month') month: string) {
    return this.accountingService.getMonthLedger(Number(year), Number(month));
  }

  @Patch(':clientId')
  setPayment(
    @Param('clientId') clientId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Body() body: SetPaymentDto,
  ) {
    return this.accountingService.setPayment(clientId, Number(year), Number(month), body);
  }
}
