import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentStatus, ProfessionType } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Availability (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const secret = process.env.AUTH_SECRET ?? 'dev-auth-secret-change-me';

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `avail-a-${suffix}@example.com`;
  const emailB = `avail-b-${suffix}@example.com`;
  const slugA = `avail-a-${suffix}`;
  const slugB = `avail-b-${suffix}`;

  let tokenA: string;
  let tokenB: string;
  let userIdA: string;
  let hoursIdA: string;
  let exceptionIdA: string;
  let serviceIdA: string;
  let businessIdA: string;

  function signToken(userId: string, userEmail: string) {
    return jwt.sign({ sub: userId, email: userEmail }, secret, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
  }

  async function register(
    email: string,
    slug: string,
    name: string,
  ): Promise<{ id: string; email: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'password123',
        name,
        businessName: `${name} Shop`,
        slug,
        timezone: 'America/Argentina/Buenos_Aires',
        professionType: ProfessionType.BARBER,
      })
      .expect(201);
    return res.body.user as { id: string; email: string };
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

    const userA = await register(emailA, slugA, 'OwnerA');
    const userB = await register(emailB, slugB, 'OwnerB');
    userIdA = userA.id;
    tokenA = signToken(userA.id, userA.email);
    tokenB = signToken(userB.id, userB.email);

    const bizA = await prisma.business.findUniqueOrThrow({
      where: { ownerId: userIdA },
    });
    businessIdA = bizA.id;

    const svc = await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Cut', durationMin: 30, price: 20 })
      .expect(201);
    serviceIdA = svc.body.id as string;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB] } },
    });
    await app.close();
  });

  it('protects private hours/exceptions endpoints', async () => {
    await request(app.getHttpServer()).get('/api/availability/hours').expect(401);
    await request(app.getHttpServer())
      .post('/api/availability/hours')
      .send({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/availability/exceptions')
      .expect(401);
  });

  it('CRUD working hours scoped by business', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/availability/hours')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ dayOfWeek: 1, startTime: '09:00', endTime: '11:00' })
      .expect(201);

    expect(created.body.dayOfWeek).toBe(1);
    expect(created.body.businessId).toBe(businessIdA);
    hoursIdA = created.body.id as string;

    await request(app.getHttpServer())
      .post('/api/availability/hours')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ dayOfWeek: 1, startTime: '18:00', endTime: '09:00' })
      .expect(400);

    const listed = await request(app.getHttpServer())
      .get('/api/availability/hours')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(listed.body).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/api/availability/hours/${hoursIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    const patched = await request(app.getHttpServer())
      .patch(`/api/availability/hours/${hoursIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ endTime: '12:00' })
      .expect(200);
    expect(patched.body.endTime).toBe('12:00');

    await request(app.getHttpServer())
      .patch(`/api/availability/hours/${hoursIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ startTime: '10:99' })
      .expect(400);
  });

  it('CRUD exceptions with unique date and isClosed rules', async () => {
    const closed = await request(app.getHttpServer())
      .post('/api/availability/exceptions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        date: '2026-03-20',
        isClosed: true,
        reason: 'Holiday',
      })
      .expect(201);

    expect(closed.body.isClosed).toBe(true);
    expect(closed.body.startTime).toBeNull();
    exceptionIdA = closed.body.id as string;

    await request(app.getHttpServer())
      .post('/api/availability/exceptions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: '2026-03-20', isClosed: true })
      .expect(409);

    await request(app.getHttpServer())
      .post('/api/availability/exceptions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: '2026-03-21', isClosed: false })
      .expect(400);

    const open = await request(app.getHttpServer())
      .post('/api/availability/exceptions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        date: '2026-03-21',
        isClosed: false,
        startTime: '10:00',
        endTime: '12:00',
      })
      .expect(201);
    expect(open.body.startTime).toBe('10:00');

    await request(app.getHttpServer())
      .get(`/api/availability/exceptions/${exceptionIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('public slots endpoint works without auth and respects closed day', async () => {
    // 2026-03-16 is Monday — matches hours dayOfWeek 1
    const openDay = await request(app.getHttpServer())
      .get(
        `/api/availability/public/${slugA}/slots?serviceId=${serviceIdA}&date=2026-03-16`,
      )
      .expect(200);

    expect(openDay.body.timezone).toBe('America/Argentina/Buenos_Aires');
    expect(openDay.body.slots.length).toBeGreaterThan(0);
    expect(openDay.body.slots[0]).toHaveProperty('startsAt');
    expect(openDay.body.slots[0]).toHaveProperty('endsAt');

    // Closed exception on 2026-03-20
    const closedDay = await request(app.getHttpServer())
      .get(
        `/api/availability/public/${slugA}/slots?serviceId=${serviceIdA}&date=2026-03-20`,
      )
      .expect(200);
    expect(closedDay.body.slots).toEqual([]);
  });

  it('public slots exclude PENDING/CONFIRMED appointments with buffer', async () => {
    const client = await prisma.client.create({
      data: {
        businessId: businessIdA,
        name: 'Walk-in',
      },
    });

    // Block 09:00-09:30 BA on Monday 2026-03-16
    await prisma.appointment.create({
      data: {
        businessId: businessIdA,
        clientId: client.id,
        serviceId: serviceIdA,
        startsAt: new Date('2026-03-16T12:00:00.000Z'),
        endsAt: new Date('2026-03-16T12:30:00.000Z'),
        status: AppointmentStatus.PENDING,
      },
    });

    const res = await request(app.getHttpServer())
      .get(
        `/api/availability/public/${slugA}/slots?serviceId=${serviceIdA}&date=2026-03-16`,
      )
      .expect(200);

    const starts = (res.body.slots as { startsAt: string }[]).map(
      (s) => s.startsAt,
    );
    expect(starts).not.toContain('2026-03-16T12:00:00.000Z');
    expect(starts).not.toContain('2026-03-16T12:30:00.000Z');
    expect(starts).toContain('2026-03-16T13:00:00.000Z');

    // CANCELLED should not block
    await prisma.appointment.updateMany({
      where: { businessId: businessIdA },
      data: { status: AppointmentStatus.CANCELLED },
    });

    const afterCancel = await request(app.getHttpServer())
      .get(
        `/api/availability/public/${slugA}/slots?serviceId=${serviceIdA}&date=2026-03-16`,
      )
      .expect(200);

    const startsAfter = (afterCancel.body.slots as { startsAt: string }[]).map(
      (s) => s.startsAt,
    );
    expect(startsAfter).toContain('2026-03-16T12:00:00.000Z');
  });

  it('DELETE hours works for owner', async () => {
    await request(app.getHttpServer())
      .delete(`/api/availability/hours/${hoursIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/availability/hours/${hoursIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });
});
