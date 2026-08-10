# spec.md — Sistema de Gestión de Estacionamientos (v1 · piloto)

> **Documento base para Claude Code.** Es la fuente de verdad del alcance, la
> arquitectura, el modelo de datos y los criterios de aceptación de la v1.
> Todo lo que Claude Code construya se valida contra este archivo. Un requisito
> que no esté aquí, con su criterio de aceptación verificable, **no se construye**.

**Proyecto:** SaaS mínimo para operar estacionamientos privados hoy gestionados a mano.
**Autor / decisor:** Cristóbal Herrera — C4A · Cyber Security For All SpA
**Fecha:** 2026-08-08
**Estado:** base inicial (v1 piloto)
**Relacionados:** ADR-001 (alcance por exclusión, aprobado) · ADR-002 (stack, ratificar) · SPEC-001/002/003 (contenidas en este documento)

---

## 0. Cómo usar este documento (instrucciones para Claude Code)

1. **Spec-driven.** Antes de escribir código, lee este archivo completo. Cada
   capacidad tiene un criterio de aceptación con comando de verificación. No se
   da por hecho nada que no sea verificable.
2. **WIP = 1.** Se cierra y verifica un hito antes de abrir el siguiente
   (ver §10). No trabajar dos hitos en paralelo.
3. **Gate de alcance.** Está prohibido introducir pago, LPR/cámara, reservas o
   multisitio (ver §2). Cualquier PR que los agregue debe rechazarse hasta que
   exista un ADR que enmiende ADR-001.
4. **No inventar valores.** Los `{{placeholder}}` son decisiones humanas
   pendientes. No los rellenes con supuestos: si un valor falta, detente y
   pídelo. No inventes nombres, métricas ni datos de prueba realistas que
   parezcan reales.
5. **Datos personales.** La patente es dato personal bajo la Ley 21.719. Aplica
   minimización, validación de entrada en toda frontera y consultas
   parametrizadas. Nada de secretos hardcodeados.

---

## 1. Propósito e hipótesis

El sistema existe para **probar o refutar dos hipótesis**, no para lograr
paridad de producto. El riesgo central es **adopción, no escala**.

- **H1 — velocidad:** un operador registra entrada + salida más rápido que en el
  cuaderno.
- **H2 — disposición a pagar:** un dueño paga una suscripción mensual en UF por
  ver ingresos y ocupación que hoy no puede verificar.

**Definición de "validado"** (a resolver antes de cerrar el piloto):

- H1 se valida si el tiempo de registro es ≤ `{{UMBRAL_H1_SEGUNDOS}}` contra una
  línea base de cuaderno de `{{LINEA_BASE_CUADERNO_SEGUNDOS}}`.
- H2 se valida si `{{UMBRAL_H2_DUEÑOS}}` dueños pagan `{{PRECIO_SUSCRIPCION_UF}}`
  UF/mes dentro de `{{PLAZO_PILOTO}}`.

> El techo de precio de referencia es ~0,8 UF/mes (soluciones locales
> equivalentes). Competir por features antes de validar adopción es terreno
> perdido. `{{PRECIO_SUSCRIPCION_UF}}` es decisión de negocio, no de esta spec.

---

## 2. Alcance (ADR-001)

### Dentro de la v1
1. Registro de patente al ingreso.
2. Temporizador de permanencia.
3. Cálculo automático de precio a la salida.
4. Panel de visibilidad para el dueño (ocupación e ingresos observados).

### Explícitamente fuera de la v1
- Integración de pago o pasarela. **El cobro es manual, en efectivo, fuera del sistema.**
- Barreras físicas.
- Cámaras / reconocimiento de patente (LPR).
- Reserva de cupos.
- Operación multisucursal.

### Gate de alcance (obligatorio)
Un control de estructura rechaza cualquier cambio que agregue módulos de pago,
LPR, reservas o multisitio sin un ADR que enmiende o reemplace ADR-001. Se
verifica en §9 (AC-SCOPE-*).

---

## 3. Arquitectura (ADR-002 — ratificar)

Criterio rector: **lo más simple de orquestar y administrar; un proveedor, una
factura, deploy inmediato.**

| Capa | Decisión |
|------|----------|
| Frontend + API | Next.js (App Router) como **PWA**. La API son Route Handlers serverless en el mismo repo. |
| Hosting | Vercel. `git push` a `main` → deploy automático → URL en vivo. |
| Base de datos | **Postgres en Railway, vía TCP proxy público** (ADR-003, enmienda a ADR-002). Decisión original: Neon vía Marketplace de Vercel. Se cambió porque ya existía una instancia provisionada en Railway. Costo asumido: se rompe "un proveedor, una factura". |
| ORM | Drizzle (esquema tipado + migraciones). Driver: `postgres` (postgres-js) sobre TCP. |
| Auth | Mínima, dos roles: `operador` y `dueño`. Sin proveedor de pago. |
| Offline | **Offline-first (no opcional):** service worker + IndexedDB local + sincronización al reconectar. |

**Por qué offline-first:** el operador registra de pie, con conectividad
intermitente. Si la app se cae sin señal, muere la adopción (H1). El registro
debe funcionar sin red y sincronizar después.

**Sin Stripe / sin pasarela:** excluido por ADR-001. La suscripción no se cobra
dentro de la app durante el piloto.

---

## 4. Modelo de datos — SPEC-001 (minimización)

Principio: se recolecta **solo lo que responde H1/H2**. Sin entidades de pago,
sucursal ni reserva.

### Entidades

**Estacionamiento**
- `id` (uuid, PK)
- `nombre` (texto)
- `capacidad_total` (entero)
- `zona_horaria` (texto, ej. `America/Santiago`)
- `created_at` (timestamp)

**Tarifa**
- `id` (uuid, PK)
- `estacionamiento_id` (FK → Estacionamiento)
- `valor_hora` (entero, en pesos)
- `fraccion_minutos` (entero, unidad mínima de cobro)
- `monto_minimo` (entero)
- `vigente_desde` (timestamp)

**SesionVehiculo** — el corazón de la v1
- `id` (uuid, PK)
- `estacionamiento_id` (FK)
- `operador_id` (FK → Usuario)
- `patente` (texto, normalizada; **dato personal**)
- `entrada_at` (timestamp)
- `salida_at` (timestamp, nullable)
- `monto_calculado` (entero, nullable — se calcula a la salida)
- `tecleo_inicio_at` (timestamp — inicio del ingreso de patente, para H1)
- `tecleo_fin_at` (timestamp — fin del ingreso de patente, para H1)
- `estado` (`activa` | `cerrada`)
- `sync_estado` (`local` | `sincronizada` — para offline-first)

**Usuario**
- `id` (uuid, PK)
- `email` (texto, único)
- `rol` (`operador` | `dueño`)
- `estacionamiento_id` (FK)
- `created_at` (timestamp)

> **Prohibido en el esquema:** entidades `Pago`, `Transaccion`, `Sucursal`,
> `Reserva`. Verificado en AC-DATA-1.

### Retención y base de licitud (a resolver)
- **Plazo de retención de `patente`:** `{{PLAZO_RETENCION_PATENTE}}`. Vencido el
  plazo, la patente se elimina o se enmascara; el registro agregado (ocupación,
  monto) puede conservarse sin la patente.
- **Base de licitud del tratamiento de la patente:** `{{BASE_LICITUD}}`
  (candidatas a evaluar: ejecución del servicio de estacionamiento / interés
  legítimo del responsable). No asumir consentimiento por defecto.
- La minimización es un requisito estructural, no una recomendación.

---

## 5. Flujo operativo — SPEC-002

Un solo operador, un solo estacionamiento, en una pantalla.

### Ingreso
1. El operador abre la app (ya autenticado, sesión persistente).
2. Toca "Nuevo ingreso": se marca `tecleo_inicio_at`.
3. Ingresa la patente (teclado optimizado, normalización automática).
4. Al confirmar: se marca `tecleo_fin_at`, se crea `SesionVehiculo` con
   `entrada_at = ahora`, `estado = activa`, `sync_estado = local`.

**AC-OP-1 (ingreso offline).** Con el navegador en modo sin conexión, un ingreso
se registra y persiste en IndexedDB; al reconectar, `sync_estado` pasa a
`sincronizada`. *Verificación: prueba manual en DevTools (offline) + inspección
de IndexedDB.*

### Permanencia
- El temporizador muestra el tiempo transcurrido por cada sesión activa.

### Salida y cálculo
1. El operador selecciona una sesión activa y toca "Salida".
2. `salida_at = ahora`; `monto_calculado` se computa desde `Tarifa`
   (valor_hora, fraccion_minutos, monto_minimo); `estado = cerrada`.
3. La app muestra el monto para que el operador **cobre en efectivo** (fuera del sistema).

**AC-OP-2 (cálculo correcto).** Dada una tarifa y una duración conocidas, el
`monto_calculado` coincide con el valor esperado, incluido el `monto_minimo` y
el redondeo por `fraccion_minutos`. *Verificación: prueba unitaria del cálculo.*

---

## 6. Instrumentación de medición — SPEC-003

La medición **es parte del producto**, no un extra. Sin ella el piloto entrega
la app pero no la evidencia sobre H1/H2.

### H1 — velocidad de registro
- Cada `SesionVehiculo` cerrada debe tener `tecleo_inicio_at` y `tecleo_fin_at`.
- La duración del tecleo = `tecleo_fin_at − tecleo_inicio_at` es la métrica de H1.

**AC-MEAS-1.** Toda sesión cerrada tiene ambos timestamps de tecleo no nulos.
*Verificación: consulta que cuente sesiones cerradas con timestamps nulos → debe ser 0.*

### H2 — visibilidad que el dueño valora
El panel del dueño (§ siguiente) se alimenta de datos ya registrados; no requiere
tabla adicional. Se derivan de `SesionVehiculo`:
- Ocupación actual = sesiones `activa`.
- Ingresos observados del período = suma de `monto_calculado` de sesiones cerradas.
- **Descuadre visible:** diferencia entre ocupación observada y sesiones
  registradas (hace visible, sin impedirlo, que un vehículo se cobre por fuera).

### Panel del dueño
- Ocupación en tiempo (aprox.) real.
- Ingresos observados por día.
- Indicador de descuadre.

**AC-MEAS-2.** El panel refleja exactamente las sesiones registradas por el
operador en el hito anterior. *Verificación: registrar N sesiones y confirmar
que los agregados del panel corresponden.*

---

## 7. Protección de datos (Ley 21.719)

- La **patente es dato personal**. Aplica minimización (§4), retención acotada y
  base de licitud definida antes de operar con datos reales.
- Vigencia plena de la ley: **1 de diciembre de 2026**. El piloto debe nacer
  alineado, no remediado después.
- Superficie mínima por diseño: al no haber pago ni LPR, se recolecta menos.
- Validación de entrada en toda frontera (la patente ingresada), consultas
  parametrizadas (Drizzle), sin secretos en el repositorio.

---

## 8. Requisitos no funcionales

- **PWA instalable:** manifiesto válido + service worker; instalable en móvil.
- **Offline-first:** el flujo del operador (§5) funciona sin conexión.
- **Un solo estacionamiento** en la v1 (sin multitenancy).
- **Simplicidad de operación:** deploy por `git push`; sin infraestructura que
  administrar más allá de Vercel + Neon.

---

## 9. Criterios de aceptación globales (con verificación)

| ID | Criterio | Verificación |
|----|----------|--------------|
| AC-SCOPE-1 | El manifiesto no incluye SDK ni cliente de pasarela de pago. | `grep -iE "stripe\|mercadopago\|webpay\|transbank\|flow" package.json` → sin resultados |
| AC-SCOPE-2 | El esquema no define `Pago`/`Transaccion`/`Sucursal`/`Reserva`. | `grep -riE "pago\|transaccion\|sucursal\|reserva" src/db/` → sin entidades |
| AC-SCOPE-3 | No existe módulo de integración LPR/cámara. | inspección de estructura del repo |
| AC-DATA-1 | El modelo de datos coincide con §4 (entidades y campos). | revisión del esquema Drizzle |
| AC-OP-1 | Ingreso offline persiste y sincroniza. | prueba manual offline + IndexedDB |
| AC-OP-2 | Cálculo de precio correcto (mínimo + fracción). | prueba unitaria |
| AC-MEAS-1 | Sesiones cerradas con timestamps de tecleo completos. | consulta agregada = 0 nulos |
| AC-MEAS-2 | El panel del dueño refleja las sesiones registradas. | prueba end-to-end |
| AC-PWA-1 | PWA instalable: manifiesto con los campos de instalabilidad (name/short_name, start_url, display, iconos 192 y 512 que existen) **y** service worker registrado, activado y controlando la página. | `node scripts/verificar-pwa.mjs` → todas las comprobaciones PASS |
| AC-BUILD-1 | El proyecto compila. | `npm run build` sin errores |

> **Enmienda de AC-PWA-1 (2026-08-09).** La redacción original verificaba con
> *"auditoría PWA (Lighthouse)"*. Lighthouse **eliminó la categoría PWA**: la
> versión 13.4.1 solo define `performance` en su configuración por defecto. El
> criterio era inverificable con cualquier Lighthouse actual, en cualquier
> máquina. Se reescribió para describir **la propiedad a comprobar** en lugar de
> la herramienta, y se implementó un verificador propio sobre CDP. Evidencia del
> diagnóstico y de los tres intentos fallidos: `LEDGER.md`, entrada
> *M1 · AC-PWA-1 · FAIL tras 3 intentos*.
>
> Lección general: un criterio de aceptación que se ata al nombre de una
> herramienta externa caduca cuando la herramienta cambia. Describir la
> propiedad; sugerir la herramienta.

---

## 10. Secuencia de construcción (hitos, WIP = 1)

Cada hito cierra con sus criterios de aceptación verificados antes de abrir el siguiente.

- **M0 — Bootstrap.** Repo Next.js + `CLAUDE.md` con el gate de alcance +
  `.gitignore`. Sin código de app. → cierra con estructura lista.
- **M1 — Esquema + scaffold.** PWA (manifiesto + service worker), Neon + Drizzle,
  esquema de §4. → cierra con AC-DATA-1, AC-SCOPE-1/2, AC-BUILD-1, AC-PWA-1.
- **M2 — Rebanada del operador (offline).** Flujo completo de §5 con
  instrumentación de tecleo (§6). → cierra con AC-OP-1, AC-OP-2, AC-MEAS-1.
- **M3 — Panel del dueño.** Visibilidad y descuadre (§6). → cierra con AC-MEAS-2.
- **M4 — Deploy.** Conexión a Vercel + integración Neon del Marketplace +
  variables de entorno. → cierra con URL en vivo y un registro de prueba
  end-to-end.

---

## 11. Restricciones para Claude Code (qué NO hacer)

- **No** agregar pago, pasarela, LPR/cámara, reservas ni multisitio (gate ADR-001).
- **No** hardcodear valores de negocio: `{{PRECIO_SUSCRIPCION_UF}}`, umbrales de
  H1/H2, plazos → son `{{placeholder}}` hasta que se resuelvan.
- **No** inventar nombres, métricas ni datos que parezcan reales.
- **No** tratar offline-first como opcional.
- **No** guardar secretos en el repositorio; usar variables de entorno.
- **No** avanzar dos hitos a la vez (WIP = 1).

---

## 12. Cuestiones abiertas (placeholders a resolver con el humano)

| Placeholder | Qué es | Bloquea |
|-------------|--------|---------|
| `{{PRECIO_SUSCRIPCION_UF}}` | Ancla de precio de la suscripción (techo ref. ~0,8 UF/mes) | Validación de H2 |
| `{{UMBRAL_H1_SEGUNDOS}}` / `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` | Objetivo y línea base de tiempo de registro | Definición de "validado" H1 |
| `{{UMBRAL_H2_DUEÑOS}}` / `{{PLAZO_PILOTO}}` | Nº de dueños pagando y plazo | Definición de "validado" H2 |
| `{{PLAZO_RETENCION_PATENTE}}` | Ventana de retención de la patente | SPEC-001 / cumplimiento |
| `{{BASE_LICITUD}}` | Base de licitud del tratamiento de la patente | SPEC-001 / cumplimiento |
| `{{EQUIPO_REVISOR}}` | Revisor(es) del proyecto | Gobernanza |

---

*Este documento es la base inicial. Cualquier cambio de alcance se hace por ADR
que enmiende ADR-001, no editando este archivo en silencio.*
