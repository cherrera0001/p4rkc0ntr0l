# Gestión de Estacionamientos — piloto v1

PWA para operar estacionamientos privados que hoy se gestionan a mano. El
operador registra entradas y salidas desde el teléfono, **con o sin señal**; el
dueño ve ocupación e ingresos que hasta ahora no podía verificar.

**En vivo:** https://estacionamiento-three.vercel.app

> ⚠️ **Piloto con datos de prueba.** El sistema solo acepta patentes con prefijo
> `FIXT`. Una patente real ni siquiera se guarda en el dispositivo. Ver
> [Barrera de datos personales](#barrera-de-datos-personales).

---

## Qué problema resuelve, y qué NO hace

El proyecto existe para probar o refutar **dos hipótesis**, no para lograr
paridad de producto:

- **H1 · velocidad** — un operador registra un vehículo más rápido que en el
  cuaderno de papel.
- **H2 · disposición a pagar** — un dueño paga una suscripción por ver ingresos
  y ocupación que hoy no puede verificar.

Por eso hay una lista explícita de **lo que está fuera de alcance** (ADR-001), y
un control automático que rechaza cualquier cambio que lo introduzca:

| Fuera de la v1 | Por qué |
|---|---|
| Pasarela de pago del conductor | **El cobro es en efectivo, fuera del sistema.** La app solo muestra el monto |
| LPR / cámaras | Ninguna hipótesis lo necesita, y multiplica el dato personal |
| Reserva de cupos | Ídem |
| Multisitio | Un dueño con tres estacionamientos prueba H1 y H2 con uno |
| Barreras físicas | Fuera del alcance del piloto |

---

## Cómo está construido

```
Navegador (PWA)                        Vercel                    Railway
┌───────────────────────┐    HTTPS    ┌──────────────────┐  TCP  ┌──────────┐
│ React 19 · Next 16    │ ──────────► │ Route Handlers   │ ────► │ Postgres │
│                       │             │ (serverless)     │       └──────────┘
│ IndexedDB  ← cola     │             │                  │
│ Service Worker ← shell│             │ Proxy: CSP+nonce │
└───────────────────────┘             └──────────────────┘
        ▲
        └── funciona sin red: el ingreso se escribe primero en disco local
```

| Capa | Decisión | Por qué |
|---|---|---|
| Frontend + API | **Next.js 16.3 (App Router)** como PWA; la API son Route Handlers en el mismo repo | un solo despliegue, una sola base de código |
| Base de datos | **Postgres en Railway** vía TCP proxy público | [ADR-003](docs/adr/ADR-003-base-de-datos-en-railway.md) — ya existía la instancia. Costo asumido: se rompe "un proveedor, una factura" |
| ORM | **Drizzle** con driver `postgres` (postgres-js) | esquema tipado + migraciones; consultas parametrizadas siempre |
| Offline | **Service Worker + IndexedDB + cola de salida** | no es opcional: si la app se cae sin señal, muere H1 |
| Auth | cookie firmada con **HMAC-SHA256**, dos roles | sin proveedor externo, sin dependencia nueva |
| Hosting | **Vercel** | deploy inmediato |

Cinco dependencias de producción, y ninguna sorpresa:
`next` · `react` · `react-dom` · `drizzle-orm` · `postgres`.

### Tamaño real

| | Archivos | Líneas |
|---|---|---|
| `src/` (sin pruebas) | 34 | 4.156 |
| Pruebas unitarias | 8 | 1.159 |
| Verificadores y utilidades (`scripts/`) | 20 | 3.946 |

Casi tanto código de verificación como de producto. Es deliberado: ver
[Cómo se verifica](#cómo-se-verifica).

---

## Lo que hace interesante a este sistema

### Offline-first de verdad, no "con caché"

El operador registra **de pie, en la vía, con señal intermitente**. El orden de
las operaciones es lo que hace que funcione:

1. El **cliente** genera el `uuid` de la sesión — no la base.
2. Se escribe en **IndexedDB** con `sync_estado = 'local'`.
3. La UI muestra el vehículo **sin esperar la red**.
4. Recién entonces se intenta el `POST`.

Ese `uuid` generado por el cliente es la clave de idempotencia: sin él, una
reconexión inestable duplica sesiones en cada reintento.

**La resolución de conflictos es asimétrica a propósito:** el servidor es
autoritativo sobre qué está adentro, el dispositivo sobre qué todavía no subió.
El servidor no puede saber de un ingreso que nunca le llegó.

Y el rechazo también es asimétrico: solo un **400 o un 403** borran el registro
local. Un 401 por cookie caducada, o el 429 del propio limitador, dejan el
registro en la cola — equivocarse conservando cuesta una fila de más;
equivocarse borrando cuesta el registro.

> **Asimetría declarada:** el **ingreso** funciona sin red; la **salida** no. El
> monto se calcula en el servidor con la tarifa vigente, porque un cliente que
> estuvo sin señal puede tener una tarifa vieja — y mostrar un monto equivocado
> al cobrar en efectivo es peor que pedir señal un momento.

### Barrera de datos personales

La patente es **dato personal** bajo la Ley 21.719 (vigencia plena: 1 de
diciembre de 2026). El piloto nace alineado, no remediado después:

- **Minimización estructural** — solo los campos que responden H1 o H2. El
  `GET /api/sesiones` devuelve **tres columnas**, no la fila entera.
- **La barrera se evalúa en el cliente, ANTES de escribir en disco.** Recolectar
  y almacenar localmente ya es tratamiento: rechazar antes de persistir es la
  diferencia entre no tratar el dato y tratarlo mal.
- **El servidor mantiene una segunda barrera**, porque una barrera de cliente
  sola es eludible.
- **El dispositivo suelta la patente al cerrar la sesión**, y cerrar sesión vacía
  IndexedDB: en un equipo compartido por turnos, el operador entrante no hereda
  dato personal del saliente.

Encender la operación real exige resolver antes dos decisiones humanas que siguen
abiertas: `{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}`.

### El descuadre: hacer visible sin acusar

El panel del dueño compara los vehículos que él cuenta con los ojos contra las
sesiones registradas. **Esa comparación no se persiste**, y es una decisión, no
una omisión: un descuadre con historia es una acusación sobre una persona
identificable. El panel **hace visible** la diferencia y **no la impide**.

### Instrumentación de la hipótesis

`tecleo_inicio_at` y `tecleo_fin_at` son `NOT NULL` y se marcan al tocar *Nuevo
ingreso* y al confirmar. Su diferencia **es** la métrica de H1: no es telemetría
accesoria, es parte del producto.

> **Estado honesto:** la métrica está especificada e instrumentada, y **nunca se
> midió**. Ver [Estado real del proyecto](#estado-real-del-proyecto).

---

## Cómo correrlo

```bash
npm install
cp .env.example .env      # completar DATABASE_URL, SESSION_SECRET, CLAVE_ACCESO
npm run db:migrate        # aplica el esquema
npm run sembrar           # datos de prueba (idempotente)
npm run build && npm start
```

Entrar con `operador@fixture.invalid` o `duena@fixture.invalid` y la
`CLAVE_ACCESO` de tu `.env` — **la misma para los dos**: el email identifica al
usuario y su rol, la clave es la barrera compartida del piloto.

Patente de prueba: cualquiera que empiece con `FIXT` y tenga al menos un dígito
(`FIXT01`). La semilla no crea patentes: las sesiones las crea el operador.

---

## Cómo se verifica

**Ningún criterio se declara cumplido por leer el código.** Cada uno tiene un
comando que lo ejercita contra la app corriendo, y su salida se registra en
[`LEDGER.md`](LEDGER.md).

| Comando | Qué comprueba |
|---|---|
| `npm test` | 122 pruebas unitarias — tarificación, patente, reloj, sesión, errores |
| `npm run verificar:esquema` | el modelo coincide con la spec, contra la base real |
| `npm run verificar:invariantes` | las reglas viven en la **base**, no solo en la app |
| `npm run verificar:op1` | ingreso offline real por CDP, con la red cortada de verdad |
| `npm run verificar:a3` | una patente real **no toca** el dispositivo |
| `npm run verificar:m4` | el dispositivo no conserva lo que ya salió |
| `npm run verificar:salida` | ciclo ingreso→salida y control de acceso |
| `npm run verificar:meas2` | el panel del dueño refleja lo registrado, punta a punta |
| `npm run verificar:tarifas` | la carga de tarifa **versiona en vez de pisar**: el histórico crece, y una salida vieja se puede recalcular con la tarifa que regía |
| `npm run verificar:reportes` | las cifras del período **se derivan de la base**, no de la maqueta — y nadie publica un número de H1 sin su umbral |
| `npm run verificar:aislamiento` | con **dos** clientes sembrados, ninguno alcanza al otro; y `plataforma` no obtiene una patente por ninguna ruta |
| `npm run verificar:pwa` | manifiesto + service worker registrado y controlando |
| `npm run verificar:endurecimiento` | CSP, límite de intentos, sesión, CSRF, minimización |
| `npm run verificar:ui` | el **estilo computado por el navegador**, no el fuente |
| `npm run verificar:int12` | dos deploys nunca comparten versión de caché |

Y tres **guards del propio proceso**, que existen porque las lecciones que no se
vuelven mecanismo se repiten:

| Comando | Qué impide |
|---|---|
| `npm run verificar:verificadores` | que un verificador muera en silencio o pase sin veredicto |
| `npm run verificar:citas` | que la documentación cite líneas de código que no existen |
| `npm run verificar:ac` | que un criterio de aceptación apunte a una herramienta ausente |

El último nació de un caso real: un criterio decía *"auditoría PWA (Lighthouse)"*
y Lighthouse **eliminó** la categoría PWA. El criterio quedó inverificable en
cualquier máquina. La lección —*describir la propiedad, no la herramienta*— hoy
es un comando que falla si alguien vuelve a atar un criterio a un nombre.

---

## Estado real del proyecto

| | Estado |
|---|---|
| Hitos M0–M5 | **cerrados y desplegados** |
| Endurecimiento en producción | **30/30** contra la URL viva |
| Capa de presentación (SPEC-004) | **21/21**, medido en el navegador (estilo computado, no el fuente) |
| Hallazgo INT-12 | **FAIL registrado** — la corrección funciona y está observada en producción; el *gate* que debería seguir vigilándola no es confiable |
| Hito M6 · pantallas del diseño | `1e` **tarifas** y `1g` **reportes** construidas y verificadas (2026-08-19/20). Queda `1l` |
| Multicliente (M8) | **PASS** — aislamiento probado con **dos** clientes sembrados, y `AC-ISO-2` por exclusión sobre toda la superficie de plataforma |

### Lo que falta, sin adornos

1. **H1 nunca se midió.** La métrica está instrumentada y la base termina en cero
   tras cada corrida de pruebas. No hay consulta que la agregue, ni umbral
   definido, ni datos reales — y no puede haberlos hasta resolver la base de
   licitud. *El proyecto entero existe para probar H1.*
2. **Mecanismo de retención de patente (INT-7).** Bloqueado por dos decisiones
   humanas. El esquema **sí** lo admite; lo que falta es la decisión y la tarea
   de purga.
3. **Una pantalla construible sin decisión nueva**: `1l`, el ingreso del operador
   a pantalla completa — que la traducción de diseño llama *«la mejor expresión
   de H1 del set»*. Tarifas (`1e`) y reportes (`1g`) ya están.
4. **Deploy por `git push`** — hoy corre por CLI de Vercel.

---

## Documentación

Todo el proyecto está documentado con evidencia de comando.
**Empezá por [`docs/README.md`](docs/README.md)**, que es el mapa.

| Si querés… | Leé |
|---|---|
| entender el alcance y los criterios | [`spec.md`](spec.md) |
| entender el modelo de datos | [`docs/data/MER.md`](docs/data/MER.md) y [`MR.md`](docs/data/MR.md) |
| ver los flujos como diagramas | [`docs/data/flujos.md`](docs/data/flujos.md) |
| saber qué está construido y verificado | [`docs/data/matriz-trazabilidad.md`](docs/data/matriz-trazabilidad.md) |
| saber por qué algo se decidió así | [`docs/adr/`](docs/adr/) y [`LEDGER.md`](LEDGER.md) |
| las reglas para tocar este repo | [`CLAUDE.md`](CLAUDE.md) |

---

## Licencia y contexto

Piloto de **C4A · Cyber Security For All SpA**. Construido con
[Claude Code](https://claude.com/claude-code) bajo un proceso de verificación
adversarial: cada corrección la implementa un agente, la intenta romper otro, y
un tercero la verifica con comando. Los tres vetos que ese proceso produjo están
registrados en [`LEDGER.md`](LEDGER.md) — incluidos los que tumbaron trabajo ya
dado por bueno.
