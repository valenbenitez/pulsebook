import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import type { AuthUser } from '../common/types/auth-user';
import { BusinessService } from './business.service';
import type { BusinessResponse } from './dto/business.response';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Controller('business')
@UseGuards(SessionAuthGuard)
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  getMine(@CurrentUser() user: AuthUser): Promise<BusinessResponse> {
    return this.businessService.getByOwnerId(user.id);
  }

  @Patch()
  updateMine(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBusinessDto,
  ): Promise<BusinessResponse> {
    return this.businessService.updateByOwnerId(user.id, dto);
  }
}
