import { Module } from '@nestjs/common';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import { BusinessModule } from './business/business.module';
import { ClientsModule } from './clients/clients.module';
import { HealthController } from './common/health.controller';
import { InvoicesModule } from './invoices/invoices.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BusinessModule,
    ServicesModule,
    ClientsModule,
    AvailabilityModule,
    AppointmentsModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
