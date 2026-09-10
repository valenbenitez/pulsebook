---
name: PulseBook
description: Dashboard operativo para profesionales — claro, mono, high-contrast.
colors:
  ink: "#0A0A0A"
  ink-muted: "#71717A"
  ink-subtle: "#A1A1AA"
  canvas: "#F4F4F5"
  surface: "#FFFFFF"
  surface-muted: "#F4F4F5"
  surface-emphasis: "#E4E4E7"
  border: "#E4E4E7"
  border-strong: "#D4D4D8"
  inverse: "#FFFFFF"
  danger: "#DC2626"
  danger-soft: "#FEF2F2"
  success: "#16A34A"
  success-soft: "#F0FDF4"
  warning: "#D97706"
  warning-soft: "#FFFBEB"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.inverse}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "#18181B"
    textColor: "{colors.inverse}"
  button-secondary:
    backgroundColor: "{colors.surface-emphasis}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.inverse}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  card-inverse:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.inverse}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    height: "44px"
  list-row:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
---

# PulseBook Design System

## Overview

PulseBook se siente como una **herramienta de estudio profesional**: clara, calmada y de alto contraste. La identidad es **mono** (negro sobre canvas claro), con radios generosos y controles en **pill**. La referencia visual es un dashboard tipo Melon Mind — sidebar con ítem activo negro, cards blancas flotando sobre canvas gris suave, KPIs con una card invertida negra, y listas en filas redondeadas.

**Modo dominante:** Operate (dashboard, auth, agenda pública). La expresión de marca vive en detalles precisos (radios, peso tipográfico, contraste), no en color saturado ni decoración.

**Estrategia de color:** Restrained — neutros + tinta negra como único “accent” estructural. Semántica (danger/success/warning) solo para estados.

## Colors

| Token | Hex | Uso |
|---|---|---|
| `ink` | `#0A0A0A` | Texto primario, CTA primario, nav activo, card KPI invertida |
| `ink-muted` | `#71717A` | Fechas, meta, nav inactivo, labels secundarios |
| `ink-subtle` | `#A1A1AA` | Placeholders, hints |
| `canvas` | `#F4F4F5` | Fondo de app / dashboard |
| `surface` | `#FFFFFF` | Cards, paneles, formularios |
| `surface-muted` | `#F4F4F5` | Filas de lista, fondos internos |
| `surface-emphasis` | `#E4E4E7` | Botón secundario, chips inactivos |
| `border` | `#E4E4E7` | Bordes sutiles de inputs/dividers |
| `inverse` | `#FFFFFF` | Texto sobre `ink` |
| `danger` / `success` / `warning` | ver frontmatter | Solo estados (errores de form, cita completada, pending) |

No hay púrpura, gradientes neón, ni cream+terracotta. Light mode es el default (escena: profesional en escritorio/clínica de día).

## Typography

**Familia principal:** Geist (ya en el scaffold Next). Sans geométrica limpia; no Inter como display.

**Mono:** Geist Mono — IDs de factura, horarios técnicos, slug.

Jerarquía:

- **Display / Headline** — saludo del día, títulos de página (`font-semibold`, tracking negativo leve).
- **Title** — títulos de card / sección.
- **Body / body-sm** — contenido y meta.
- **Label** — botones, nav, tabs.

Evitar serifs display y tracking excesivo en mayúsculas.

## Layout

- **Dashboard:** sidebar fija (~240px) + main fluido; opcional columna derecha para “solicitudes” / cola PENDING cuando aplique.
- **Auth:** columna centrada `max-w-md` sobre `canvas`.
- **Agenda pública:** una columna principal, mobile-first, sin sidebar.
- Contenedor main típico: `max-w-5xl`–`6xl`, padding `lg`/`xl`.
- Densidad: airy — padding generoso dentro de cards (`lg`), gap `md`–`lg` entre bloques. No apiñar métricas en el primer viewport del dashboard: saludo + 1–2 KPI cards + lista del día.

## Elevation & Depth

Profundidad por **tonal layering**, no por sombras pesadas:

1. `canvas` (fondo)
2. `surface` (card)
3. `surface-muted` (fila dentro de card)

Sombras: como máximo un soft shadow muy sutil en cards flotantes (`0 1px 2px rgb(0 0 0 / 0.04)`). Sin glow, sin multi-layer shadow stacks.

## Shapes

- Cards / paneles grandes: `rounded.xl` (24px)
- Filas de lista / inputs: `rounded.lg` / `rounded.md`
- Botones, nav items, tabs: `rounded.pill`
- Evitar `rounded-full` en cards o avatares gigantes decorativos

## Components

### Botones

- **Primary:** fondo `ink`, texto blanco, pill.
- **Secondary:** fondo `surface-emphasis`, texto `ink`, pill (“Rechazar”, “Editar”).
- **Ghost:** transparente, texto muted (acciones terciarias).

### Navegación (sidebar)

- Ítem inactivo: icono + label en `ink-muted`.
- Ítem activo: pill negra, texto `inverse`.
- Agrupar “Opciones” (ajustes, cerrar sesión) debajo con label muted.

### Cards

- Blancas sobre canvas; padding `lg`; radio `xl`.
- **Card inversa:** fondo `ink` para el KPI principal del día (ej. “N citas”).
- Sin bordes fuertes; si hace falta borde, `border`.

### Forms (login / register / settings)

- Labels `label` + `ink-muted`.
- Input altura ~44px, borde `border`, focus ring negro sutil (2px `ink` / offset).
- Errores: texto `danger`, fondo opcional `danger-soft`.

### Tabs / segment control

- Contenedor soft; tab activo = pill negra; inactivo = texto muted.

### List rows

- Fondo `surface-muted`, radio `lg`, acciones primary/secondary a la derecha.

## Do's and Don'ts

**Do**

- Mantener el contraste ink/canvas como firma.
- Usar pills para acciones y nav.
- Español claro, labels cortos (“Entrar”, “Crear cuenta”, “Marcar completada”).
- Vacíos honestos: una frase + CTA primario.

**Don't**

- Gradientes púrpura/índigo, neón, glassmorphism.
- Cards con borde+sombra+radius todos a la vez de forma agresiva.
- Stat strips densos o emoji decorativos en chrome.
- Dark mode como default (solo si más adelante se pide explícitamente).
- Mezclar otra familia tipográfica “display” sin actualizar este archivo.

## CSS mapping (implementación)

Cuando se cableen tokens en el frontend, preferir custom properties en el root:

```css
:root {
  --color-ink: #0a0a0a;
  --color-ink-muted: #71717a;
  --color-canvas: #f4f4f5;
  --color-surface: #ffffff;
  --color-surface-muted: #f4f4f5;
  --color-surface-emphasis: #e4e4e7;
  --color-border: #e4e4e7;
  --radius-xl: 24px;
  --radius-pill: 9999px;
}
```

Los componentes de UI viven en `frontend/src/shared/ui/` a medida que se necesiten (button, input, card) — no inventar un design system completo antes del primer form.
