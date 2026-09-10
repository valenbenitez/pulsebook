import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import type { AuthUser } from '../common/types/auth-user';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices.query.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(SessionAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListInvoicesQueryDto,
  ) {
    return this.invoicesService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoicesService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(user.id, id, dto);
  }

  @Post(':id/issue')
  issue(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoicesService.issue(user.id, id);
  }

  @Post(':id/pay')
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PayInvoiceDto,
  ) {
    return this.invoicesService.pay(user.id, id, dto.paymentMethod);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoicesService.cancel(user.id, id);
  }
}
