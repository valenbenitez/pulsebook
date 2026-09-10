# PulseBook

## Product

Agenda + CRM liviano + facturación operativa para profesionales independientes. Un negocio por cuenta en el MVP.

## Users

- **Profesional (auth):** opera el día a día en el dashboard.
- **Cliente final (sin login):** reserva en `/b/{slug}`.

## Surfaces

| Surface | Mode | Job |
|---|---|---|
| Dashboard (`/dashboard/**`) | Operate | Citas, clientes, servicios, horarios, facturas |
| Auth (`/login`, `/register`) | Operate | Entrar / crear cuenta |
| Agenda pública (`/b/[slug]`) | Operate / light Persuade | Elegir servicio, slot, reservar |

## Brand commitments

- UI en español primero.
- Look: herramienta profesional moderna, clara, mono high-contrast (referencia visual locked en `DESIGN.md`).
- No OAuth, no dark-mode-by-default, no multi-staff en MVP.
