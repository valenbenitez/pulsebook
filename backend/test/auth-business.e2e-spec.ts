import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfessionType } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth + Business (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const secret = process.env.AUTH_SECRET ?? 'dev-auth-secret-change-me';

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `pro-${suffix}@example.com`;
  const slug = `pro-${suffix}`;

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [{ email }, { email: { endsWith: `-${suffix}@example.com` } }],
      },
    });
    await app.close();
  });

  it('POST /api/auth/register creates User + Business with bufferMin 15', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'password123',
        name: 'Pro',
        businessName: 'Pro Shop',
        slug,
        timezone: 'America/Argentina/Buenos_Aires',
        professionType: ProfessionType.BARBER,
      })
      .expect(201);

    expect(res.body.user.email).toBe(email);
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.business.slug).toBe(slug);
    expect(res.body.business.bufferMin).toBe(15);
    expect(res.body.business.ownerId).toBe(res.body.user.id);

    const orphan = await prisma.user.findUnique({
      where: { email },
      include: { business: true },
    });
    expect(orphan?.business).toBeTruthy();
  });

  it('POST /api/auth/register returns 409 on duplicate email/slug and leaves no orphan', async () => {
    const before = await prisma.user.count();
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'password123',
        name: 'Other',
        businessName: 'Other',
        slug: `other-${suffix}`,
        timezone: 'America/Argentina/Buenos_Aires',
        professionType: ProfessionType.PSYCHOLOGIST,
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `other-${suffix}@example.com`,
        password: 'password123',
        name: 'Other',
        businessName: 'Other',
        slug,
        timezone: 'America/Argentina/Buenos_Aires',
        professionType: ProfessionType.PSYCHOLOGIST,
      })
      .expect(409);

    expect(await prisma.user.count()).toBe(before);
  });

  it('POST /api/auth/validate accepts correct password and rejects wrong', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/validate')
      .send({ email, password: 'password123' })
      .expect(200)
      .expect((res) => {
        expect(res.body.email).toBe(email);
        expect(res.body).toHaveProperty('id');
        expect(res.body).not.toHaveProperty('passwordHash');
      });

    await request(app.getHttpServer())
      .post('/api/auth/validate')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('GET /api/business returns 401 without session', async () => {
    await request(app.getHttpServer()).get('/api/business').expect(401);
  });

  it('GET /api/business returns owned business when authenticated', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const token = signToken(user.id, user.email);

    const res = await request(app.getHttpServer())
      .get('/api/business')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.slug).toBe(slug);
    expect(res.body.ownerId).toBe(user.id);
  });

  it('PATCH /api/business updates profile and enforces unique slug', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const token = signToken(user.id, user.email);

    const otherEmail = `other2-${suffix}@example.com`;
    const otherSlug = `other2-${suffix}`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: otherEmail,
        password: 'password123',
        name: 'Other2',
        businessName: 'Other2',
        slug: otherSlug,
        timezone: 'America/Argentina/Buenos_Aires',
        professionType: ProfessionType.PSYCHOLOGIST,
      })
      .expect(201);

    const patched = await request(app.getHttpServer())
      .patch('/api/business')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Shop',
        timezone: 'America/Argentina/Cordoba',
        professionType: ProfessionType.PSYCHOLOGIST,
        bufferMin: 30,
      })
      .expect(200);

    expect(patched.body.name).toBe('Updated Shop');
    expect(patched.body.bufferMin).toBe(30);
    expect(patched.body.professionType).toBe(ProfessionType.PSYCHOLOGIST);

    await request(app.getHttpServer())
      .patch('/api/business')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: otherSlug })
      .expect(409);

    const otherUser = await prisma.user.findUniqueOrThrow({
      where: { email: otherEmail },
    });
    const otherToken = signToken(otherUser.id, otherUser.email);
    const otherBiz = await request(app.getHttpServer())
      .get('/api/business')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(otherBiz.body.slug).toBe(otherSlug);
    expect(otherBiz.body.ownerId).toBe(otherUser.id);
  });
});
