# ADR-003 — La base de datos del piloto vive en Railway, no en Neon

**Estado:** aceptado
**Fecha:** 2026-08-09
**Decisor:** Cristóbal Herrera
**Enmienda:** ADR-002 (stack), cuyo contenido vive en `spec.md` §3 y estaba
declarado *"a ratificar"*. Esta decisión lo ratifica con una modificación.
**No toca:** ADR-001 (alcance por exclusión). El gate de alcance sigue intacto.

---

## Contexto

`spec.md` §3 eligió **Neon Postgres vía Marketplace de Vercel** bajo un criterio
rector explícito: *"lo más simple de orquestar y administrar; un proveedor, una
factura, deploy inmediato."*

Durante M1 el decisor ya tenía una instancia de **Postgres provisionada en
Railway**. La decisión es usarla en lugar de provisionar Neon.

## Decisión

1. La base de datos del piloto es **Postgres en Railway**.
2. El hosting de la aplicación **sigue siendo Vercel** (`git push` → deploy).
   ADR-002 se mantiene en todo lo demás: Next.js App Router como PWA, Route
   Handlers como API, Drizzle como ORM.
3. La conexión se hace por el **TCP proxy público** de Railway
   (`DATABASE_PUBLIC_URL`, host `*.proxy.rlwy.net`), no por la red privada.

## Consecuencias

### Lo que se pierde

- **Se rompe "un proveedor, una factura".** El piloto pasa a depender de Vercel
  y de Railway. Es exactamente el criterio que ADR-002 puso primero, y esta
  enmienda lo sacrifica a cambio de usar infraestructura que ya existe.
- **La red privada de Railway queda descartada.** Vercel corre fuera de Railway,
  así que `postgres.railway.internal` no resuelve. Hay que exponer la base de
  datos por el proxy público. Superficie de red mayor que con la red privada.
- **Se pierde el scale-to-zero de Neon**, que era una de las razones de esa
  elección.

### Lo que cambia en el código

- El driver deja de ser `@neondatabase/serverless` (protocolo HTTP propio de
  Neon, incompatible con un Postgres estándar) y pasa a ser `postgres`
  (postgres-js) sobre TCP, con `drizzle-orm/postgres-js`.
- El esquema de `spec.md` §4 **no cambia**. Drizzle y las migraciones generadas
  son las mismas: Postgres es Postgres.

### Lo que no cambia

- El gate de alcance de ADR-001.
- Los criterios de aceptación de `spec.md` §9.
- La minimización de datos y el tratamiento de la patente (§7).

## Requisitos de seguridad que esta decisión impone

- La cadena de conexión vive **solo** en `.env.local` (ignorado por git) y en las
  variables de entorno de Vercel. Nunca en el repositorio (`spec.md` §7).
- Al exponer la base por el proxy público, la contraseña es la única barrera:
  debe ser fuerte y rotarse ante cualquier sospecha de exposición.
- Se exige TLS en la conexión (`sslmode=require` en la cadena).

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Neon vía Marketplace de Vercel (ADR-002 original) | Habría dejado sin uso una base ya provisionada. |
| App y base ambas en Railway | Recupera "un proveedor, una factura" y permite usar la red privada, pero obliga a reescribir M4 y descarta el deploy por `git push` a Vercel que `spec.md` §8 pide como requisito no funcional. |

## Pendiente

Esta decisión **no resuelve** `{{PLAZO_RETENCION_PATENTE}}` ni `{{BASE_LICITUD}}`
(`spec.md` §12). Siguen bloqueando la operación con datos reales, sin importar
quién hospede la base.
