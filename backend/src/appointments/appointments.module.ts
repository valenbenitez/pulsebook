import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { BusinessModule } from '../business/business.module';
import { ClientsModule } from '../clients/clients.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [BusinessModule, ClientsModule, AvailabilityModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
