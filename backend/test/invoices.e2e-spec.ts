import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InvoiceStatus,
  PaymentMethod,
  ProfessionType,
} from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Invoices (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const secret = process.env.AUTH_SECRET ?? 'dev-auth-secret-change-me';

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `inv-a-${suffix}@example.com`;
  const emailB = `inv-b-${suffix}@example.com`;
  const slugA = `inv-a-${suffix}`;
  const slugB = `inv-b-${suffix}`;

  let tokenA: string;
  let tokenB: string;
  let businessIdA: string;
  let clientIdA: string;
  let invoiceIdA: string;

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

    const client = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Ana Cliente',
        email: `ana-inv-${suffix}@example.com`,
      })
      .expect(201);
    clientIdA = client.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB] } },
    });
    await app.close();
  });

  it('returns 401 without session', async () => {
    await request(app.getHttpServer()).get('/api/invoices').expect(401);
    await request(app.getHttpServer())
      .post('/api/invoices')
      .send({
        items: [{ description: 'X', quantity: 1, unitPrice: 1 }],
      })
      .expect(401);
  });

  it('POST /api/invoices creates DRAFT with total and items (USD)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        clientId: clientIdA,
        items: [
          { description: 'Haircut', quantity: 2, unitPrice: 15 },
          { description: 'Product', quantity: 1, unitPrice: 5.5 },
        ],
      })
      .expect(201);

    expect(res.body.status).toBe(InvoiceStatus.DRAFT);
    expect(res.body.businessId).toBe(businessIdA);
    expect(res.body.number).toBeNull();
    expect(Number(res.body.total)).toBe(35.5);
    expect(res.body).not.toHaveProperty('currency');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(2);
    invoiceIdA = res.body.id;
  });

  it('rejects items with quantity < 1 or negative unitPrice', async () => {
    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ description: 'Bad qty', quantity: 0, unitPrice: 10 }],
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ description: 'Bad price', quantity: 1, unitPrice: -1 }],
      })
      .expect(400);
  });

  it('GET /api/invoices filters by status and scopes by business', async () => {
    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        items: [{ description: 'Other biz', quantity: 1, unitPrice: 9 }],
      })
      .expect(201);

    const listA = await request(app.getHttpServer())
      .get('/api/invoices')
      .query({ status: InvoiceStatus.DRAFT })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(listA.body)).toBe(true);
    expect(
      listA.body.every(
        (inv: { businessId: string; status: string }) =>
          inv.businessId === businessIdA && inv.status === InvoiceStatus.DRAFT,
      ),
    ).toBe(true);
    expect(listA.body.some((inv: { id: string }) => inv.id === invoiceIdA)).toBe(
      true,
    );
  });

  it('GET /api/invoices/:id returns items and 404 cross-tenant', async () => {
    const own = await request(app.getHttpServer())
      .get(`/api/invoices/${invoiceIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(own.body.items.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .get(`/api/invoices/${invoiceIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('PATCH /api/invoices/:id updates DRAFT only', async () => {
    const patched = await request(app.getHttpServer())
      .patch(`/api/invoices/${invoiceIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ description: 'Updated cut', quantity: 1, unitPrice: 40 }],
      })
      .expect(200);

    expect(Number(patched.body.total)).toBe(40);
    expect(patched.body.items).toHaveLength(1);
    expect(patched.body.items[0].description).toBe('Updated cut');
  });

  it('issue → pay flow assigns sequential number and payment fields', async () => {
    const second = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ description: 'Second', quantity: 1, unitPrice: 10 }],
      })
      .expect(201);

    const issued1 = await request(app.getHttpServer())
      .post(`/api/invoices/${invoiceIdA}/issue`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    expect(issued1.body.status).toBe(InvoiceStatus.ISSUED);
    expect(issued1.body.number).toBe(1);

    const issued2 = await request(app.getHttpServer())
      .post(`/api/invoices/${second.body.id}/issue`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    expect(issued2.body.number).toBe(2);

    await request(app.getHttpServer())
      .patch(`/api/invoices/${invoiceIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ description: 'Nope', quantity: 1, unitPrice: 1 }],
      })
      .expect(400);

    const paid = await request(app.getHttpServer())
      .post(`/api/invoices/${invoiceIdA}/pay`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ paymentMethod: PaymentMethod.TRANSFER })
      .expect(201);

    expect(paid.body.status).toBe(InvoiceStatus.PAID);
    expect(paid.body.paymentMethod).toBe(PaymentMethod.TRANSFER);
    expect(paid.body.paidAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/invoices/${invoiceIdA}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/invoices/${second.body.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    expect(cancelled.body.status).toBe(InvoiceStatus.CANCELLED);
    expect(cancelled.body.number).toBe(2);

    const stillThere = await request(app.getHttpServer())
      .get(`/api/invoices/${second.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(stillThere.body.status).toBe(InvoiceStatus.CANCELLED);
  });

  it('cancel works from DRAFT', async () => {
    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ description: 'To cancel', quantity: 1, unitPrice: 3 }],
      })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    expect(cancelled.body.status).toBe(InvoiceStatus.CANCELLED);
  });
});
