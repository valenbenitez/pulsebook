import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { AuthUser } from '../common/types/auth-user';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto';
import { PublicSlotsQueryDto } from './dto/public-slots.query.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-availability-exception.dto';
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  // ─── Public (no auth) ──────────────────────────────────────────────────────

  @Get('public/:slug/slots')
  getPublicSlots(
    @Param('slug') slug: string,
    @Query() query: PublicSlotsQueryDto,
  ) {
    return this.availabilityService.getPublicSlots(
      slug,
      query.serviceId,
      query.date,
    );
  }

  // ─── Working hours (auth) ──────────────────────────────────────────────────

  @Post('hours')
  @UseGuards(SessionAuthGuard)
  createHours(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkingHoursDto) {
    return this.availabilityService.createWorkingHours(user.id, dto);
  }

  @Get('hours')
  @UseGuards(SessionAuthGuard)
  listHours(@CurrentUser() user: AuthUser) {
    return this.availabilityService.listWorkingHours(user.id);
  }

  @Get('hours/:id')
  @UseGuards(SessionAuthGuard)
  getHours(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.availabilityService.getWorkingHoursById(user.id, id);
  }

  @Patch('hours/:id')
  @UseGuards(SessionAuthGuard)
  updateHours(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkingHoursDto,
  ) {
    return this.availabilityService.updateWorkingHours(user.id, id, dto);
  }

  @Delete('hours/:id')
  @UseGuards(SessionAuthGuard)
  deleteHours(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.availabilityService.deleteWorkingHours(user.id, id);
  }

  // ─── Exceptions (auth) ─────────────────────────────────────────────────────

  @Post('exceptions')
  @UseGuards(SessionAuthGuard)
  createException(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAvailabilityExceptionDto,
  ) {
    return this.availabilityService.createException(user.id, dto);
  }

  @Get('exceptions')
  @UseGuards(SessionAuthGuard)
  listExceptions(@CurrentUser() user: AuthUser) {
    return this.availabilityService.listExceptions(user.id);
  }

  @Get('exceptions/:id')
  @UseGuards(SessionAuthGuard)
  getException(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.availabilityService.getExceptionById(user.id, id);
  }

  @Patch('exceptions/:id')
  @UseGuards(SessionAuthGuard)
  updateException(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityExceptionDto,
  ) {
    return this.availabilityService.updateException(user.id, id, dto);
  }

  @Delete('exceptions/:id')
  @UseGuards(SessionAuthGuard)
  deleteException(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.availabilityService.deleteException(user.id, id);
  }
}
