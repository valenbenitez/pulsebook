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
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services.query.dto';
import type { ServiceResponse } from './dto/service.response';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@Controller('services')
@UseGuards(SessionAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceDto,
  ): Promise<ServiceResponse> {
    return this.servicesService.create(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListServicesQueryDto,
  ): Promise<ServiceResponse[]> {
    return this.servicesService.list(user.id, query.isActive);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ServiceResponse> {
    return this.servicesService.getById(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceResponse> {
    return this.servicesService.update(user.id, id, dto);
  }
}
