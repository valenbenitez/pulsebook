import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentStatus, ProfessionType } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Appointments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const secret = process.env.AUTH_SECRET ?? 'dev-auth-secret-change-me';

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `appt-a-${suffix}@example.com`;
  const emailB = `appt-b-${suffix}@example.com`;
  const slugA = `appt-a-${suffix}`;
  const slugB = `appt-b-${suffix}`;

  let tokenA: string;
  let tokenB: string;
  let businessIdA: string;
  let clientIdA: string;
  let serviceIdA: string;
  let appointmentIdA: string;

  /** Monday 2026-09-14 in America/Argentina/Buenos_Aires (UTC-3) → 12:00 local = 15:00Z */
  const slotStart = '2026-09-14T15:00:00.000Z';
  const slotStartAlt = '2026-09-14T16:00:00.000Z';

  function signToken(userId: string, userEmail: string) {
    return jwt.sign({ sub: userId, email: userEmail }, secret, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
  }

  beforeAll(async () => {
    process.env.AUTH_SECRET = secret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const regA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: emailA,
        password: 'password123',
        name: 'Owner A',
        businessName: 'Shop A',
        slug: slugA,
        timezone: 'America/Argentina/Buenos_Aires',
        professionType: ProfessionType.BARBER,
      })
      .expect(201);

    const regB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: emailB,
        password: 'password123',
        name: 'Owner B',
        businessName: 'Shop B',
        slug: slugB,
        timezone: 'America/Argentina/Buenos_Aires',
        professionType: ProfessionType.PSYCHOLOGIST,
      })
      .expect(201);

    tokenA = signToken(regA.body.user.id, regA.body.user.email);
    tokenB = signToken(regB.body.user.id, regB.body.user.email);
    businessIdA = regA.body.business.id as string;

    // Monday = 1 — covers 2026-09-14
    await request(app.getHttpServer())
      .post('/api/availability/hours')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' })
      .expect(201);

    const client = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Ana Cliente',
        email: `ana-appt-${suffix}@example.com`,
      })
      .expect(201);
    clientIdA = client.body.id as string;

    const svc = await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Cut', durationMin: 30, price: 25 })
      .expect(201);
    serviceIdA = svc.body.id as string;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB] } },
    });
    await app.close();
  });

  it('returns 401 without session on private appointment routes', async () => {
    await request(app.getHttpServer()).get('/api/appointments').expect(401);
    await request(app.getHttpServer())
      .post('/api/appointments')
      .send({
        clientId: clientIdA,
        serviceId: serviceIdA,
        startsAt: slotStart,
      })
      .expect(401);
  });

  it('POST /api/appointments creates with endsAt from duration and PENDING', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        clientId: clientIdA,
        serviceId: serviceIdA,
        startsAt: slotStart,
        notes: 'First visit',
      })
      .expect(201);

    expect(res.body.businessId).toBe(businessIdA);
    expect(res.body.status).toBe(AppointmentStatus.PENDING);
    expect(res.body.endsAt).toBe('2026-09-14T15:30:00.000Z');
    expect(res.body.notes).toBe('First visit');
    appointmentIdA = res.body.id as string;
  });

  it('rejects overlapping appointment within bufferMin (409)', async () => {
    // Existing ends 15:30; buffer 15 → blocked until 15:45. 15:40 overlaps.
    await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        clientId: clientIdA,
        serviceId: serviceIdA,
        startsAt: '2026-09-14T15:40:00.000Z',
      })
      .expect(409);
  });

  it('allows slot ending at existing start (buffer only post-endsAt, like availability)', async () => {
    // Existing 15:00–15:30; candidate 14:30–15:00 must succeed (no pre-buffer).
    // Matches GET availability computeFreeSlots semantics (opción a).
    const prior = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        clientId: clientIdA,
        serviceId: serviceIdA,
        startsAt: '2026-09-14T14:30:00.000Z',
      })
      .expect(201);

    expect(prior.body.endsAt).toBe('2026-09-14T15:00:00.000Z');

    await request(app.getHttpServer())
      .patch(`/api/appointments/${prior.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: AppointmentStatus.CANCELLED })
      .expect(200);
  });

  it('GET /api/appointments filters by range/status and is tenant-scoped', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/appointments')
      .query({
        from: '2026-09-14T00:00:00.000Z',
        to: '2026-09-15T00:00:00.000Z',
        status: AppointmentStatus.PENDING,
      })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(list.body.some((a: { id: string }) => a.id === appointmentIdA)).toBe(
      true,
    );
    expect(
      list.body.every((a: { businessId: string }) => a.businessId === businessIdA),
    ).toBe(true);

    const emptyB = await request(app.getHttpServer())
      .get('/api/appointments')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(emptyB.body.some((a: { id: string }) => a.id === appointmentIdA)).toBe(
      false,
    );
  });

  it('GET /api/appointments/:id returns 404 cross-tenant', async () => {
    await request(app.getHttpServer())
      .get(`/api/appointments/${appointmentIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/appointments/${appointmentIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('PATCH cancel frees slot; another booking can take it', async () => {
    await request(app.getHttpServer())
      .patch(`/api/appointments/${appointmentIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: AppointmentStatus.CANCELLED })
      .expect(200);

    const again = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        clientId: clientIdA,
        serviceId: serviceIdA,
        startsAt: slotStart,
      })
      .expect(201);

    expect(again.body.status).toBe(AppointmentStatus.PENDING);
    appointmentIdA = again.body.id as string;
  });

  it('PATCH reschedule revalidates overlap', async () => {
    const other = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        clientId: clientIdA,
        serviceId: serviceIdA,
        startsAt: slotStartAlt,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/appointments/${appointmentIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startsAt: slotStartAlt })
      .expect(409);

    // cleanup other for later public tests
    await request(app.getHttpServer())
      .patch(`/api/appointments/${other.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: AppointmentStatus.CANCELLED })
      .expect(200);
  });

  it('POST /api/appointments/public/:slug books PENDING without auth', async () => {
    // free the private appointment first
    await request(app.getHttpServer())
      .patch(`/api/appointments/${appointmentIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: AppointmentStatus.CANCELLED })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/api/appointments/public/${slugA}`)
      .send({
        serviceId: serviceIdA,
        startsAt: slotStart,
        name: 'Public Guest',
        email: `guest-${suffix}@example.com`,
        phone: `+54911${suffix.slice(0, 6)}`,
      })
      .expect(201);

    expect(res.body.status).toBe(AppointmentStatus.PENDING);
    expect(res.body.businessId).toBe(businessIdA);
    expect(res.body.endsAt).toBe('2026-09-14T15:30:00.000Z');

    await request(app.getHttpServer())
      .post(`/api/appointments/public/${slugA}`)
      .send({
        serviceId: serviceIdA,
        startsAt: slotStart,
        name: 'Second Guest',
        email: `guest2-${suffix}@example.com`,
      })
      .expect(409);
  });

  it('rejects public booking outside working hours', async () => {
    await request(app.getHttpServer())
      .post(`/api/appointments/public/${slugA}`)
      .send({
        serviceId: serviceIdA,
        startsAt: '2026-09-14T23:00:00.000Z', // 20:00 local — after 18:00
        name: 'Late Guest',
      })
      .expect(400);
  });

  it('rejects public booking for unknown slug', async () => {
    await request(app.getHttpServer())
      .post('/api/appointments/public/does-not-exist-slug')
      .send({
        serviceId: serviceIdA,
        startsAt: slotStartAlt,
        name: 'Ghost',
      })
      .expect(404);
  });
});
