import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfessionType } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Services (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const secret = process.env.AUTH_SECRET ?? 'dev-auth-secret-change-me';

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `svc-a-${suffix}@example.com`;
  const emailB = `svc-b-${suffix}@example.com`;
  const slugA = `svc-a-${suffix}`;
  const slugB = `svc-b-${suffix}`;

  let tokenA: string;
  let tokenB: string;
  let userIdA: string;
  let userIdB: string;
  let serviceIdA: string;

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
    userIdB = userB.id;
    tokenA = signToken(userA.id, userA.email);
    tokenB = signToken(userB.id, userB.email);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB] } },
    });
    await app.close();
  });

  it('GET /api/services returns 401 without session', async () => {
    await request(app.getHttpServer()).get('/api/services').expect(401);
  });

  it('POST /api/services creates service for authenticated business', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Haircut',
        description: 'Classic cut',
        durationMin: 45,
        price: 30.5,
      })
      .expect(201);

    expect(res.body.name).toBe('Haircut');
    expect(res.body.durationMin).toBe(45);
    expect(Number(res.body.price)).toBe(30.5);
    expect(res.body.isActive).toBe(true);
    expect(res.body).not.toHaveProperty('currency');

    const bizA = await prisma.business.findUniqueOrThrow({
      where: { ownerId: userIdA },
    });
    expect(res.body.businessId).toBe(bizA.id);
    serviceIdA = res.body.id as string;
  });

  it('GET /api/services lists only own services and filters isActive', async () => {
    await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Inactive Trim',
        durationMin: 15,
        price: 10,
        isActive: false,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Other Biz Service',
        durationMin: 20,
        price: 5,
      })
      .expect(201);

    const bizB = await prisma.business.findUniqueOrThrow({
      where: { ownerId: userIdB },
    });

    const allA = await request(app.getHttpServer())
      .get('/api/services')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(allA.body).toHaveLength(2);
    expect(
      allA.body.every((s: { businessId: string }) => s.businessId !== bizB.id),
    ).toBe(true);

    const activeOnly = await request(app.getHttpServer())
      .get('/api/services?isActive=true')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(activeOnly.body).toHaveLength(1);
    expect(activeOnly.body[0].name).toBe('Haircut');

    const inactiveOnly = await request(app.getHttpServer())
      .get('/api/services?isActive=false')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(inactiveOnly.body).toHaveLength(1);
    expect(inactiveOnly.body[0].name).toBe('Inactive Trim');
  });

  it('GET /api/services/:id returns 404 for missing or other business', async () => {
    await request(app.getHttpServer())
      .get(`/api/services/${serviceIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/services/${serviceIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/services/nonexistent-id')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('PATCH /api/services/:id updates partial fields and soft-deactivates', async () => {
    const patched = await request(app.getHttpServer())
      .patch(`/api/services/${serviceIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Haircut Pro', price: 40, isActive: false })
      .expect(200);

    expect(patched.body.name).toBe('Haircut Pro');
    expect(Number(patched.body.price)).toBe(40);
    expect(patched.body.isActive).toBe(false);

    const stored = await prisma.service.findUniqueOrThrow({
      where: { id: serviceIdA },
    });
    const bizA = await prisma.business.findUniqueOrThrow({
      where: { ownerId: userIdA },
    });
    expect(stored.businessId).toBe(bizA.id);

    await request(app.getHttpServer())
      .patch(`/api/services/${serviceIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hijack' })
      .expect(404);
  });

  it('POST /api/services returns 401 without session', async () => {
    await request(app.getHttpServer())
      .post('/api/services')
      .send({ name: 'X', durationMin: 10, price: 1 })
      .expect(401);
  });
});
