import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfessionType } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ClientsService } from '../src/clients/clients.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Clients (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let clientsService: ClientsService;
  const secret = process.env.AUTH_SECRET ?? 'dev-auth-secret-change-me';

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `owner-a-${suffix}@example.com`;
  const emailB = `owner-b-${suffix}@example.com`;
  const slugA = `owner-a-${suffix}`;
  const slugB = `owner-b-${suffix}`;

  let tokenA: string;
  let tokenB: string;
  let businessIdA: string;
  let businessIdB: string;
  let clientIdA: string;

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
    clientsService = app.get(ClientsService);

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
    businessIdA = regA.body.business.id;
    businessIdB = regB.body.business.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB] } },
    });
    await app.close();
  });

  it('returns 401 without session on all client routes', async () => {
    await request(app.getHttpServer()).get('/api/clients').expect(401);
    await request(app.getHttpServer())
      .post('/api/clients')
      .send({ name: 'X' })
      .expect(401);
    await request(app.getHttpServer()).get('/api/clients/some-id').expect(401);
    await request(app.getHttpServer())
      .patch('/api/clients/some-id')
      .send({ name: 'Y' })
      .expect(401);
  });

  it('POST /api/clients creates client for session business', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Ana Cliente',
        email: `ana-${suffix}@example.com`,
        phone: `+54911${suffix.slice(0, 6)}`,
        notes: 'VIP',
      })
      .expect(201);

    expect(res.body.name).toBe('Ana Cliente');
    expect(res.body.businessId).toBe(businessIdA);
    expect(res.body.notes).toBe('VIP');
    clientIdA = res.body.id;
  });

  it('GET /api/clients lists only own business clients and supports search', async () => {
    await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Bob Other Biz',
        email: `bob-${suffix}@example.com`,
      })
      .expect(201);

    const listA = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(listA.body)).toBe(true);
    expect(listA.body.every((c: { businessId: string }) => c.businessId === businessIdA)).toBe(
      true,
    );
    expect(listA.body.some((c: { id: string }) => c.id === clientIdA)).toBe(
      true,
    );
    expect(
      listA.body.some((c: { name: string }) => c.name === 'Bob Other Biz'),
    ).toBe(false);

    const search = await request(app.getHttpServer())
      .get('/api/clients')
      .query({ q: 'Ana' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(search.body.some((c: { id: string }) => c.id === clientIdA)).toBe(
      true,
    );
  });

  it('GET /api/clients/:id returns 404 for cross-tenant access', async () => {
    await request(app.getHttpServer())
      .get(`/api/clients/${clientIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/clients/${clientIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('PATCH /api/clients/:id updates partially and rejects cross-tenant', async () => {
    const patched = await request(app.getHttpServer())
      .patch(`/api/clients/${clientIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ notes: 'Updated notes', name: 'Ana Updated' })
      .expect(200);

    expect(patched.body.name).toBe('Ana Updated');
    expect(patched.body.notes).toBe('Updated notes');

    await request(app.getHttpServer())
      .patch(`/api/clients/${clientIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hacked' })
      .expect(404);
  });

  it('findOrCreate matches by email/phone and does not duplicate', async () => {
    const email = `match-${suffix}@example.com`;
    const phone = `+54800${suffix.slice(0, 6)}`;

    const first = await clientsService.findOrCreate(businessIdA, {
      name: 'Match One',
      email,
      phone,
    });
    const secondByEmail = await clientsService.findOrCreate(businessIdA, {
      name: 'Match Two',
      email,
    });
    const thirdByPhone = await clientsService.findOrCreate(businessIdA, {
      name: 'Match Three',
      phone,
    });

    expect(secondByEmail.id).toBe(first.id);
    expect(thirdByPhone.id).toBe(first.id);

    const count = await prisma.client.count({
      where: { businessId: businessIdA, OR: [{ email }, { phone }] },
    });
    expect(count).toBe(1);

    const otherBiz = await clientsService.findOrCreate(businessIdB, {
      name: 'Same Email Other Biz',
      email,
    });
    expect(otherBiz.id).not.toBe(first.id);
    expect(otherBiz.businessId).toBe(businessIdB);
  });
});
