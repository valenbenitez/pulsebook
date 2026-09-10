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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreatePublicAppointmentDto } from './dto/create-public-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments.query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post('public/:slug')
  createPublic(
    @Param('slug') slug: string,
    @Body() dto: CreatePublicAppointmentDto,
  ) {
    return this.appointmentsService.createPublic(slug, dto);
  }

  @Post()
  @UseGuards(SessionAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user.id, dto);
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.appointmentsService.findAll(user.id, query);
  }

  @Get(':id')
  @UseGuards(SessionAuthGuard)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.appointmentsService.findOne(user.id, id);
  }

  @Patch(':id')
  @UseGuards(SessionAuthGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(user.id, id, dto);
  }
}
