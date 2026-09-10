# PulseBook Backend

API NestJS del MVP PulseBook: agenda y facturación operativa para profesionales, multi-tenant.

## Objetivo

Exponer la fuente de verdad del dominio (PostgreSQL vía Prisma) para:

- Onboarding: registro User + Business y validación de credenciales (Auth.js en Next)
- Catálogo de servicios, CRM de clientes, horarios y slots públicos
- Citas (privadas + reserva pública) con overlap/`bufferMin`
- Facturas operativas en USD (DRAFT → ISSUED → PAID / CANCELLED)

El frontend Next consume esta API; Nest no renderiza UI.

## Stack


| Tecnología                                  | Uso                                                      |
| ------------------------------------------- | -------------------------------------------------------- |
| **NestJS 11**                               | HTTP API, módulos, guards, ValidationPipe                |
| **TypeScript**                              | Tipado estricto del servicio                             |
| **Prisma 6** + **PostgreSQL**               | ORM y persistencia                                       |
| **class-validator** / **class-transformer** | DTOs de request                                          |
| **bcrypt**                                  | Hash de passwords                                        |
| **jsonwebtoken**                            | JWT Bearer compartido con Auth.js (`AUTH_SECRET`, HS256) |
| **Jest** + **Supertest**                    | Unit y e2e                                               |
| **pnpm**                                    | Workspace monorepo                                       |




## Requisitos

- Node.js compatible con el monorepo
- PostgreSQL local (o remoto)
- Variables en `backend/.env` (ver `.env.example` si existe):

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/pulsebook_database?schema=public"
AUTH_SECRET="dev-auth-secret-change-me"
PORT=3001   # opcional; default 3001
```



## Setup

Desde la raíz del monorepo o desde `backend/`:

```bash
pnpm install
cd backend
pnpm prisma:generate
pnpm prisma:migrate
pnpm start:dev
```

Base URL: `http://localhost:3001/api`

## Scripts


| Script                           | Descripción                |
| -------------------------------- | -------------------------- |
| `pnpm start:dev`                 | API en watch               |
| `pnpm build` / `pnpm start:prod` | Build y producción         |
| `pnpm test`                      | Unit tests                 |
| `pnpm test:e2e`                  | E2E (requiere DB + `.env`) |
| `pnpm prisma:migrate`            | Migraciones                |
| `pnpm prisma:studio`             | UI Prisma                  |




## Autenticación

Rutas marcadas **Auth** requieren:

```http
Authorization: Bearer <JWT>
```

Contrato MVP (alineado a Auth.js Credentials):

1. Next llama `POST /api/auth/validate` en `authorize()`
2. Emite JWT HS256 con `AUTH_SECRET`, claims `sub` = user id y `email`
3. Nest valida el Bearer en `SessionAuthGuard`

Rutas **Público** no llevan token.

Validación global: `whitelist`, `forbidNonWhitelisted`, `transform`.

---



## Endpoints

Prefijo global: `/api`.

### Health


| Método | Path      | Auth | Descripción          |
| ------ | --------- | ---- | -------------------- |
| `GET`  | `/health` | —    | `{ "status": "ok" }` |




### Auth


| Método | Path             | Auth | Body / query                                                                                                  | Descripción                                                                    |
| ------ | ---------------- | ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `POST` | `/auth/register` | —    | `email`, `password`, `name`, `businessName`, `slug`, `timezone`, `professionType` (`BARBER` | `PSYCHOLOGIST`) | Crea User + Business en transacción; password hasheado; `bufferMin` default 15 |
| `POST` | `/auth/validate` | —    | `email`, `password`                                                                                           | Credenciales OK → `{ id, email, name }`; incorrectas → `401`                   |




### Business


| Método  | Path        | Auth | Body / query                                                        | Descripción                     |
| ------- | ----------- | ---- | ------------------------------------------------------------------- | ------------------------------- |
| `GET`   | `/business` | Auth | —                                                                   | Business del owner de la sesión |
| `PATCH` | `/business` | Auth | `name?`, `slug?`, `timezone?`, `professionType?`, `bufferMin?` (≥0) | Actualiza perfil; slug único    |




### Services


| Método  | Path            | Auth | Body / query                                                        | Descripción                 |
| ------- | --------------- | ---- | ------------------------------------------------------------------- | --------------------------- |
| `POST`  | `/services`     | Auth | `name`, `durationMin`, `price` (USD), `description?`, `isActive?`   | Alta de servicio            |
| `GET`   | `/services`     | Auth | `isActive?` (query)                                                 | Lista del business          |
| `GET`   | `/services/:id` | Auth | —                                                                   | Detalle; `404` cross-tenant |
| `PATCH` | `/services/:id` | Auth | parcial (`name`, `description`, `durationMin`, `price`, `isActive`) | Update / soft-deactivate    |




### Clients


| Método  | Path           | Auth | Body / query                         | Descripción                 |
| ------- | -------------- | ---- | ------------------------------------ | --------------------------- |
| `POST`  | `/clients`     | Auth | `name`, `email?`, `phone?`, `notes?` | Alta manual                 |
| `GET`   | `/clients`     | Auth | `q?` (name/email/phone)              | Lista + búsqueda            |
| `GET`   | `/clients/:id` | Auth | —                                    | Detalle; `404` cross-tenant |
| `PATCH` | `/clients/:id` | Auth | parcial                              | Update                      |


`ClientsService.findOrCreate` (interno) lo usa la reserva pública de citas.

### Availability


| Método   | Path                               | Auth    | Body / query                                            | Descripción                                                                            |
| -------- | ---------------------------------- | ------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET`    | `/availability/public/:slug/slots` | Público | `serviceId`, `date` (`YYYY-MM-DD`)                      | Slots libres (timezone, duration, buffer, hours, excepciones, citas PENDING/CONFIRMED) |
| `POST`   | `/availability/hours`              | Auth    | `dayOfWeek` (0–6), `startTime`, `endTime` (`HH:mm`)     | Alta horario semanal                                                                   |
| `GET`    | `/availability/hours`              | Auth    | —                                                       | Lista                                                                                  |
| `GET`    | `/availability/hours/:id`          | Auth    | —                                                       | Detalle                                                                                |
| `PATCH`  | `/availability/hours/:id`          | Auth    | parcial                                                 | Update                                                                                 |
| `DELETE` | `/availability/hours/:id`          | Auth    | —                                                       | Baja                                                                                   |
| `POST`   | `/availability/exceptions`         | Auth    | `date`, `isClosed`, `startTime?`, `endTime?`, `reason?` | Excepción por fecha (unique business+date)                                             |
| `GET`    | `/availability/exceptions`         | Auth    | —                                                       | Lista                                                                                  |
| `GET`    | `/availability/exceptions/:id`     | Auth    | —                                                       | Detalle                                                                                |
| `PATCH`  | `/availability/exceptions/:id`     | Auth    | parcial                                                 | Update                                                                                 |
| `DELETE` | `/availability/exceptions/:id`     | Auth    | —                                                       | Baja                                                                                   |


Si `isClosed=false`, `startTime`/`endTime` son requeridos. Día cerrado o sin ventana → slots `[]`.

### Appointments


| Método  | Path                         | Auth    | Body / query                                                  | Descripción                                                                    |
| ------- | ---------------------------- | ------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `POST`  | `/appointments/public/:slug` | Público | `serviceId`, `startsAt`, `name`, `email?`, `phone?`, `notes?` | Reserva: findOrCreate client + cita `PENDING`; `409` si slot ocupado           |
| `POST`  | `/appointments`              | Auth    | `clientId`, `serviceId`, `startsAt`, `notes?`, `status?`      | Alta; `endsAt = startsAt + durationMin`; valida overlap/buffer y working hours |
| `GET`   | `/appointments`              | Auth    | `from?`, `to?`, `status?`                                     | Lista filtrada del business                                                    |
| `GET`   | `/appointments/:id`          | Auth    | —                                                             | Detalle; `404` cross-tenant                                                    |
| `PATCH` | `/appointments/:id`          | Auth    | `status?`, `notes?`, `startsAt?`                              | Update / reschedule (revalida); `CANCELLED` deja de bloquear                   |


Estados: `PENDING`  `CONFIRMED`  `CANCELLED`  `COMPLETED`  `NO_SHOW`. Solo `PENDING`/`CONFIRMED` bloquean slot. Buffer alineado con availability (post-`endsAt`).

### Invoices


| Método  | Path                   | Auth | Body / query                                                                     | Descripción                                                           |
| ------- | ---------------------- | ---- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `POST`  | `/invoices`            | Auth | `clientId?`, `appointmentId?`, `items[{ description, quantity>0, unitPrice≥0 }]` | Crea `DRAFT`; `total = Σ qty×unitPrice` USD; appointment 1:1 opcional |
| `GET`   | `/invoices`            | Auth | `status?`                                                                        | Lista                                                                 |
| `GET`   | `/invoices/:id`        | Auth | —                                                                                | Detalle con items; `404` cross-tenant                                 |
| `PATCH` | `/invoices/:id`        | Auth | `clientId?`, `items?`                                                            | Solo en `DRAFT`                                                       |
| `POST`  | `/invoices/:id/issue`  | Auth | —                                                                                | `DRAFT`→`ISSUED` + `number` secuencial por business                   |
| `POST`  | `/invoices/:id/pay`    | Auth | `paymentMethod` (`CASH` | `TRANSFER` | `OTHER`)                                  | `ISSUED`→`PAID` + `paidAt`                                            |
| `POST`  | `/invoices/:id/cancel` | Auth | —                                                                                | `DRAFT`|`ISSUED`→`CANCELLED`                                          |


Sin campo currency (USD fijo). Fuera de scope: AFIP, pasarelas de pago.

---



## Errores habituales


| Código | Cuándo                                                   |
| ------ | -------------------------------------------------------- |
| `400`  | Validación DTO / regla de negocio                        |
| `401`  | Sin Bearer o JWT inválido                                |
| `404`  | Recurso inexistente o de otro tenant                     |
| `409`  | Conflicto (email/slug/slot/número/appointment duplicado) |




## Estructura

```
backend/
  prisma/          # schema + migraciones
  src/
    auth/
    business/
    services/
    clients/
    availability/
    appointments/
    invoices/
    common/        # guards, decorators, health
    prisma/        # PrismaService
  test/            # e2e
```



## Notas

- Multi-tenant: casi todas las queries filtran por `businessId` del owner de sesión (o `slug` en rutas públicas).
- Response types explícitos: piloto en `clients` (`ClientResponse`); el resto se tipará módulo a módulo.
- Schema: `backend/prisma/schema.prisma` es la fuente de verdad del dominio.

