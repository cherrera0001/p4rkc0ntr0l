# Revisión integral multi-rol — v1 piloto

**Fecha:** 2026-08-09
**Alcance:** todo el código del workspace (`src/`, `public/sw.js`, `scripts/`,
`drizzle/`, configuración). No es un diff.
**Modo:** solo lectura. **No se modificó código, ni base, ni deploy.**
**Ejecutado:** `npm test` → 47/47 PASS · `npm run build` → PASS (Next 16.3.0,
9 rutas). Nada más.

> Reemplaza la pasada anterior del mismo día bajo este nombre: la incluye entera
> y agrega los hallazgos que aquella no cubría.

**Estado del árbol al revisar:** working tree con cambios sin commitear en
`src/lib/cola-local.ts`, `src/app/pantalla-operador.tsx`, `scripts/verificar-{a3,m4,meas2}.mjs`
y `src/lib/cola-local.test.ts` (nuevo). Es el **ciclo 2 de M-4**, posterior al
veto registrado en `LEDGER.md`. La revisión se hizo contra ese código, no contra
el último commit (`ad63b7e`).

---

## Resumen ejecutivo

| Severidad | Nuevos | Ya abiertos | Total |
|---|---|---|---|
| Crítica | 0 | 1 (C-1) | 1 |
| Alta | 3 | 1 (A-1) | 4 |
| Media | 7 | 2 (M-1, M-2) | 9 |
| Baja | 5 | 4 (B-1…B-4) | 9 |
| Observaciones | 8 | — | 8 |

Lo que cambia respecto de `docs/revision-seguridad-2026-08-09.md`:

1. **La causa raíz de A-2 sigue viva en el código.** El gate se levantó rotando
   la credencial, pero nada impide que el próximo fallo de conexión la vuelva a
   escribir en los logs de runtime. Es el hallazgo de mayor riesgo real hoy.
2. **Los timestamps que gobiernan el dinero los pone el cliente, sin cota.** Un
   reloj adelantado produce una sesión que **nunca se puede cerrar** (500
   permanente) y un reloj atrasado produce un monto arbitrario que el operador
   cobra en efectivo.
3. **No existe mecanismo de retención de patente.** `{{PLAZO_RETENCION_PATENTE}}`
   no es solo un valor sin decidir: es un valor sin nada que lo aplique.
4. **A-3 no tiene bypass en los flujos vivos**, pero sí un residual por el
   service worker (cliente viejo ejecutándose offline).

---

# Rol 1 · revisor-appsec (OWASP ASVS 5.0 / CWE Top 25)

## INT-1 · La cadena de conexión vuelve a los logs en cualquier fallo de Postgres — **ALTA**

**Ubicación:** `src/db/index.ts:44-48`; ausencia de captura en
`src/app/api/login/route.ts:33-36`, `src/app/api/sesiones/route.ts:114-131`,
`src/app/api/sesiones/[id]/salida/route.ts:35`

**Evidencia:**

```ts
// src/db/index.ts:44-48
  const cliente = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
```

Ninguna ruta envuelve el acceso a la base. `LEDGER.md:960-963` registra el
formato exacto del error que ya ocurrió una vez:

```
TypeError: Invalid URL
code: 'ERR_INVALID_URL'
input: '<U+FEFF>postgresql://...@autorack.proxy.rlwy.net:55464/railway?sslmode=require'
```

**Impacto:** A-2 se cerró rotando la credencial (`LEDGER.md:1223-1274`), no
arreglando lo que la expuso. `postgres-js` incluye la cadena completa —con
contraseña— en el mensaje de varios errores de conexión, y esa contraseña es la
única barrera de una base publicada en internet por el TCP proxy. El gate
terminal A-2 puede reabrirse solo, sin que nadie toque una línea de código: basta
un `connect_timeout` vencido o una variable mal puesta en el próximo deploy.
CWE-209 / CWE-532.

**Verificación propuesta:**

```powershell
# 1. no hay ninguna captura entre el driver y el log
Select-String -Pattern "try\s*\{|catch" -Path src/db/index.ts
# → sin resultados

# 2. reproducir la fuga sin tocar producción (DATABASE_URL deliberadamente rota)
$env:DATABASE_URL = "postgresql://usuario:CLAVE_DE_PRUEBA@127.0.0.1:1/x?sslmode=require"
node -e "const p=require('postgres'); p(process.env.DATABASE_URL,{connect_timeout:1})``select 1``.catch(e=>console.log(String(e)+JSON.stringify(e)))"
# → observar si la salida contiene la contraseña
```

## C-1 · Login sin límite de intentos — **CRÍTICA** *(ya abierto, confirmado)*

**Ubicación:** `src/app/api/login/route.ts:17-51`

**Evidencia:** el archivo completo no contiene throttling, lockout, retardo ni
429. Confirmado por búsqueda en todo `src/`:

```
Select-String -Pattern "429|rate.?limit|throttle|lockout" src/**/*.ts
→ solo comentarios en src/lib/cola-local.ts:249,256,309 y su prueba
```

**Impacto:** sin cambios respecto del informe original. `CLAVE_ACCESO` es
compartida y global; quien la adivine lee todas las patentes.

**Verificación propuesta:**

```powershell
1..30 | ForEach-Object {
  try { (Invoke-WebRequest -Uri http://localhost:3000/api/login -Method Post `
         -ContentType 'application/json' `
         -Body '{"email":"operador@fixture.invalid","clave":"x"}').StatusCode }
  catch { $_.Exception.Response.StatusCode.value__ }
}
# → 30 × 401. Ningún 429, ningún retardo creciente.
```

## A-1 · Sesión sin vencimiento ni revocación server-side — **ALTA** *(ya abierto, confirmado)*

**Ubicación:** `src/lib/auth.ts:57-60`, `62-73`, `82`

**Evidencia:**

```ts
export function serializarSesion(usuario: SesionUsuario): string {
  const carga = b64url(Buffer.from(JSON.stringify(usuario), "utf8"));
  return `${carga}.${firmar(carga)}`;          // sin iat, sin exp, sin jti
}
...
    maxAge: DURACION_DIAS * 24 * 60 * 60,      // atributo de cookie, no verificación
```

`deserializarSesion` solo comprueba la firma (`auth.ts:66`). Ninguna ruta
consulta la tabla `usuario` después del login (M-3).

**Verificación propuesta:**

```powershell
Select-String -Pattern "exp|iat|jti|Date.now|revoc" -Path src/lib/auth.ts
# → sin resultados
```

## INT-2 · Sin CSP en las rutas HTML; solo en `/sw.js` — **MEDIA**

**Ubicación:** `next.config.ts:7-15` vs `next.config.ts:31-33`

**Evidencia:**

```ts
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
...
        source: "/sw.js",
        ...
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
```

**Impacto:** la única pantalla que renderiza dato personal
(`pantalla-operador.tsx`) queda sin CSP. La cookie es `httpOnly`, así que un XSS
no la roba, pero sí puede leer IndexedDB —donde vive el espejo de patentes
activas— y exfiltrarlo. Tampoco hay `Permissions-Policy`. CWE-1021 / ASVS V14.4.

**Verificación propuesta:**

```powershell
(Invoke-WebRequest -Uri https://estacionamiento-three.vercel.app/login -UseBasicParsing).Headers |
  Format-List
# → confirmar ausencia de content-security-policy y permissions-policy
```

## INT-4 · `GET /api/sesiones` devuelve la fila completa y se lo concede también al dueño — **MEDIA**

**Ubicación:** `src/app/api/sesiones/route.ts:27`, `31-42`

**Evidencia:**

```ts
export async function GET() {
  if (!(await exigirRol("operador", "dueño"))) return noAutorizado();
  ...
  const activas = await db
    .select()                                   // todas las columnas
    .from(sesionVehiculo)
```

**Impacto:** dos cosas a la vez. (a) La respuesta incluye `operadorId`,
`tecleoInicioAt`, `tecleoFinAt` y `syncEstado`, que el cliente no usa —consume
solo `id`, `patente`, `entradaAt` (`cola-local.ts:157-161`)—: es exposición sin
propósito, contra la minimización de `spec.md` §7. (b) El rol `dueño` puede
listar todas las patentes activas, y su panel (`src/app/dueno/page.tsx`) no las
necesita: trabaja con `count()` y `sum()`. Es un permiso concedido sin caso de
uso. CWE-213.

**Verificación propuesta:**

```powershell
# con cookie de dueño
Invoke-WebRequest -Uri http://localhost:3000/api/sesiones -WebSession $sesionDuena |
  Select-Object -ExpandProperty Content
# → confirmar que devuelve patentes y columnas no usadas por el cliente
```

## M-1 · IDOR latente en la salida — **MEDIA** *(ya abierto, confirmado)*

**Ubicación:** `src/app/api/sesiones/[id]/salida/route.ts:25-27`, `35`

**Evidencia:**

```ts
  if (!(await exigirRol("operador"))) { ... }
  ...
  const [sesion] = await db.select().from(sesionVehiculo).where(eq(sesionVehiculo.id, id));
```

Se comprueba el rol y nunca la pertenencia. Contrasta con
`src/app/api/sesiones/route.ts:120`, donde el POST **sí** deriva
`estacionamientoId` del usuario autenticado.

## M-2 · Contexto por "primera fila", no por usuario — **MEDIA** *(ya abierto, agravado)*

**Ubicación:** `src/lib/contexto.ts:16-24`; consumido en
`src/app/api/sesiones/route.ts:29` y `src/app/dueno/page.tsx:42`

**Evidencia:**

```ts
export async function obtenerEstacionamiento() {
  const [fila] = await db.select().from(estacionamiento).limit(1);
```

**Agravante que el informe anterior no registra:** con un segundo
estacionamiento en la tabla, esto deja de ser una lectura cruzada y se vuelve una
**escritura** cruzada en el dispositivo. `pantalla-operador.tsx:133` pasa lo que
devuelve ese GET a `reconciliarActivas`, que persiste esas patentes en IndexedDB
(`cola-local.ts:206-223`). El operador del estacionamiento B se llevaría las
patentes del A guardadas en su teléfono.

**Verificación propuesta:**

```powershell
Select-String -Pattern "obtenerEstacionamiento\(|usuario.estacionamientoId|operador\.estacionamientoId" `
  -Path src/lib/contexto.ts, src/app/api/sesiones/route.ts, src/app/dueno/page.tsx, src/app/api/sesiones/[id]/salida/route.ts
```

## B-1 · `claveCorrecta` filtra el largo — **BAJA** *(confirmado)*

**Ubicación:** `src/lib/auth.ts:114-117`

```ts
  const a = Buffer.from(esperada);
  const b = Buffer.from(entrada);
  if (a.length !== b.length) return false;      // el largo no es tiempo constante
  return timingSafeEqual(a, b);
```

Mismo patrón, correcto por lo demás, en `firmaValida` (`auth.ts:50-55`).

## B-2 · Sin token CSRF ni verificación de `Origin` — **BAJA** *(confirmado)*

`SameSite=Lax` (`auth.ts:79`) es la única defensa. Búsqueda de `Origin` en
`src/`: sin resultados.

## Confirmación pedida: ¿el fix de A-3 dejó bypass?

**Rutas por las que una patente puede entrar al sistema, todas revisadas:**

| Camino | Barrera | Estado |
|---|---|---|
| `confirmar()` → `guardar()` | `pantalla-operador.tsx:250-260`, **antes** de escribir | cubierto |
| `POST /api/sesiones` | `route.ts:78-89`, segunda línea | cubierto |
| `GET /api/sesiones` → IndexedDB | `reconciliarActivas(..., { soloFixtures: !operacionReal })` (`pantalla-operador.tsx:133`, filtro en `cola-local.ts:190-192`) | cubierto |
| Restos de versiones anteriores | `purgarNoFixtures()` al abrir (`pantalla-operador.tsx:189`) | cubierto |
| Otros almacenes del cliente | sin `localStorage`/`sessionStorage`/`document.cookie` en `src/`; el SW no cachea `/api/**` (`sw.js:52-68`) | cubierto |

**Veredicto: no se encontró bypass por los flujos vivos.** Con un residual real,
que se reporta aparte como **INT-3** (rol 3): el service worker puede servir
offline una versión del cliente **anterior** a la barrera.

---

# Rol 2 · revisor-privacidad (Ley 21.719)

## INT-7 · No existe mecanismo de retención de la patente — **ALTA (bloqueo estructural)**

**Ubicación:** ausencia. `src/db/schema.ts:84-107` (sin columna de caducidad ni
de anonimización), `scripts/` (sin job de purga), rutas de API (sin borrado).

**Evidencia:** el único borrado de patentes que existe en todo el repo está
acotado a fixtures:

```js
// scripts/limpiar-fixtures.mjs:21-23
  const borradas = await sql`
    DELETE FROM sesion_vehiculo WHERE patente LIKE 'FIXT%' RETURNING id
  `;
```

Y el propio esquema lo declara pendiente:

```ts
// src/db/schema.ts:76-78
 * Su plazo de retención y su base de licitud son {{PLAZO_RETENCION_PATENTE}} y
 * {{BASE_LICITUD}}: siguen sin resolver, y deben resolverse ANTES de operar con
 * datos reales.
```

**Impacto:** el informe anterior trata la retención como un placeholder sin
valor. Es peor: es un placeholder **sin implementación**. El día que se resuelva
`{{PLAZO_RETENCION_PATENTE}}`, no hay dónde escribirlo: no hay tarea programada,
no hay columna que permita distinguir lo vencido, y `spec.md:150-152` promete que
"vencido el plazo, la patente se elimina o se enmascara; el registro agregado
puede conservarse" — eso exige poder borrar la patente **sin** borrar la fila, y
`patente` es `NOT NULL` (`schema.ts:93`, `drizzle/0000_polite_scorpion.sql:16`).
Encender `OPERACION_REAL_HABILITADA` con este estado significa acumular dato
personal sin ninguna forma de cumplir la política que se declare.

**Verificación propuesta:**

```powershell
Select-String -Pattern "DELETE FROM sesion_vehiculo|UPDATE .*patente|retencion|caduc" `
  -Path src/**/*.ts, scripts/*.mjs
# → solo limpiar-fixtures.mjs (prefijo FIXT) y verificadores
Select-String -Pattern "cron|schedule|vercel.json" -Path package.json, next.config.ts
# → sin tarea programada
```

## INT-8 · Sin cierre de sesión, y un cierre no borraría el dispositivo — **MEDIA**

**Ubicación:** `src/lib/auth.ts:86-89`, `src/app/api/login/route.ts:53-56`,
ausencia en `src/app/pantalla-operador.tsx` y `src/app/dueno/page.tsx`

**Evidencia:** `DELETE /api/login` existe y **ninguna pantalla lo llama**
(búsqueda de `api/login` en `src/`: solo `login/page.tsx:21`, método POST). Y
aunque lo llamara:

```ts
export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(COOKIE);          // no toca IndexedDB
}
```

**Impacto:** el dispositivo del operador es compartido por turnos — es el
escenario del piloto, no una hipótesis. Con la corrección de M-4, IndexedDB
conserva deliberadamente las patentes de los vehículos que están adentro
(`cola-local.ts:24-27`), que es correcto para operar y equivocado al cambiar de
turno: el operador entrante hereda el dato personal del anterior sin ningún acto
de entrega. La política de retención de INT-7 tendrá que decir algo sobre esto.

**Verificación propuesta:**

```powershell
Select-String -Pattern "method:\s*\"DELETE\"|cerrarSesion" -Path src/app/**/*.tsx
# → sin resultados en pantallas
```

## INT-9 · La patente reaparece en el dispositivo después de la salida — **BAJA**

**Ubicación:** `src/app/pantalla-operador.tsx:286-309` vs `108-145` y
`src/lib/cola-local.ts:206-223`

**Evidencia:** `registrarSalida` borra sin coordinarse con el refresco en vuelo:

```ts
      await eliminar(vehiculo.id);                       // línea 297
```

mientras `refrescar()` puede tener un `GET` emitido **antes** del cierre, cuya
respuesta todavía lista el vehículo como activo; al aplicarla,
`reconciliarActivas` lo vuelve a escribir:

```ts
    await guardar({ id: s.id, patente: s.patente, ... sincronizadaAt: ahora });
```

La guarda de orden (`secuenciaLista`, líneas 122-128) protege contra respuestas
viejas que pisan la lista, pero no contra una respuesta válida que precede a un
cierre local.

**Impacto:** una patente que ya debía estar fuera del dispositivo vuelve a
persistirse. Se autocorrige en el siguiente refresco (≤30 s,
`pantalla-operador.tsx:207-210`), así que la ventana está acotada y no es
retención indefinida; pero es una re-persistencia de dato personal después de su
borrado, y el verificador de M-4 no la cubre porque cierra y consulta en serie.

**Verificación propuesta:** en `verificar-m4.mjs`, disparar el clic de "Salida"
inmediatamente después de forzar un `GET` (sin esperar su respuesta) y leer
IndexedDB durante los 2 s siguientes.

## M-4 · Purga de copias locales — **corregida en el árbol de trabajo, sin cerrar en el ledger**

**Ubicación:** `src/lib/cola-local.ts:119-124` (`purgarNoFixtures`), `147-154`
(`purgarNoActivas`), `185-224` (`reconciliarActivas`); invocadas en
`src/app/pantalla-operador.tsx:189-192` y `133`.

La invariante implementada —"en el dispositivo solo hay pendientes y activas"—
responde al hallazgo y respeta las tres cosas que el veto del ciclo 1 exigía
(`LEDGER.md:1284-1320`): guarda de orden en el refresco, `esRechazoDefinitivo`
acotado a 400/403 con prueba unitaria propia (`src/lib/cola-local.test.ts`), y
espejo local que sobrevive a una recarga sin red.

**Discrepancia de estado, para registrar:** `STATE.md:32` y `CLAUDE.md` §2 dicen
que M-4 está pendiente; el último asiento del ledger es el **veto del ciclo 1**
(`LEDGER.md:1278-1345`). El código del árbol es el ciclo 2 y no está auditado ni
verificado en el ledger. Ninguna de las tres fuentes está mintiendo: falta el
asiento. No se declara PASS acá — esta revisión es de lectura y no corrió
`verificar:m4`.

## PRV-obs-1 · `console.error` con el cuerpo del rechazo — **OBSERVACIÓN** (corrige severidad previa)

**Ubicación:** `src/lib/cola-local.ts:305`

```ts
        console.error("El servidor rechazó una sesión de la cola:", await r.text());
```

La pasada anterior lo calificó **Alta** por "posible filtración de dato
personal". No lo es: los únicos cuerpos que llegan a esa rama son 400 y 403, y
ambos son literales estáticos sin patente (`api/sesiones/route.ts:71`, `79-88`).
Queda como observación de higiene, no como hallazgo.

## PRV-obs-2 · Minimización del esquema — **CONFORME**

`src/db/schema.ts:29-107` coincide campo a campo con `spec.md` §4 (líneas
111-144). Ningún campo de más, ninguna entidad prohibida. AC-DATA-1 se sostiene
por lectura; AC-SCOPE-1/2/3 también (`package.json` sin SDK de pasarela; sin
`pago|transaccion|sucursal|reserva` en `src/db/`; sin módulo LPR).

## Bloqueos humanos vigentes

`{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}` (`spec.md:150-155`,
`spec.md:310-311`). Ningún cambio de código los resuelve. INT-7 dice, además,
que resolverlos **no alcanza** sin construir el mecanismo.

---

# Rol 3 · revisor-offline

## INT-11 · El service worker cachea como shell cualquier respuesta, incluida la de login y los 5xx — **MEDIA**

**Ubicación:** `public/sw.js:71-89`

**Evidencia:**

```js
async function navegacion(request) {
  const cache = await caches.open(CACHE_SHELL);
  try {
    const respuesta = await fetch(request);
    cache.put(request, respuesta.clone());     // sin comprobar respuesta.ok
    return respuesta;
```

Compárese con `estatico()`, que **sí** comprueba (`sw.js:98`):
`if (respuesta.ok) cache.put(request, respuesta.clone());`

**Impacto:** dos escenarios concretos.

1. Un 500 transitorio en `/` queda guardado como la copia offline del shell. El
   operador que abra la app sin red ve la página de error, no la app.
2. `fetch` sigue redirecciones: si la cookie no vale, `GET /` responde con la
   **página de login** (`src/app/page.tsx:20`, `redirect("/login")`), y esa
   página queda cacheada bajo la clave `/`. A partir de ahí, abrir la app sin red
   muestra un formulario de login que no puede validar nada — con vehículos
   adentro y sin forma de registrar.

El segundo escenario hoy es poco probable (la cookie dura 30 días y no expira del
lado del servidor). **Corregir A-1 lo vuelve rutinario:** en cuanto la sesión
venza, la primera navegación tras el vencimiento envenena el shell. Es una
interacción entre dos hallazgos que ninguno de los dos informes previos registra.

**Verificación propuesta:**

```powershell
# con la app cargada y el SW activo, en DevTools:
#   1. borrar la cookie "sesion"
#   2. recargar (queda cacheado el login bajo "/")
#   3. modo offline + recargar → observar qué pantalla aparece
Select-String -Pattern "respuesta.ok" -Path public/sw.js
# → solo en estatico(), línea 98
```

## INT-12 · La versión del caché es un literal fijo: `activate` nunca purga entre deploys — **MEDIA**

**Ubicación:** `public/sw.js:18-20`, `37-50`

```js
const VERSION = "v1";
const CACHE_SHELL = `estacionamiento-shell-${VERSION}`;
```

`activate` borra los cachés `estacionamiento-*` que no estén en `vigentes`
(líneas 41-46), pero como el nombre no cambia entre deploys, no hay nada que
borrar: el shell de hace tres deploys sigue siendo "vigente".

**Impacto:** un HTML viejo referencia chunks `/_next/static/**` viejos, que
`estatico()` sirve cache-first para siempre (líneas 92-100). Estando **con red**
la navegación es network-first y trae el HTML nuevo, así que el problema no se
ve; **sin red** se sirve el HTML viejo y con él el bundle viejo.

## INT-3 · Residual de A-3: offline puede ejecutarse un cliente anterior a la barrera — **MEDIA**

**Ubicación:** consecuencia de INT-12 sobre `src/app/pantalla-operador.tsx:250-260`

**Evidencia:** la barrera de A-3 vive en el bundle del cliente. El servidor
mantiene la suya (`api/sesiones/route.ts:78-89`), pero **esa es exactamente la
que A-3 declaró insuficiente**: llega después de que el dato se escribió en el
dispositivo. Un dispositivo con el shell pre-A-3 en `CACHE_SHELL`, abierto sin
red, corre el `confirmar()` viejo y escribe la patente real en IndexedDB.

**Mitigación existente y por qué no cierra el caso:** `purgarNoFixtures()`
(`pantalla-operador.tsx:189`) borra ese registro **la próxima vez que se abra la
app con el bundle nuevo**. Entre una cosa y la otra, la recolección y el
almacenamiento ya ocurrieron — que es la definición de tratamiento que A-3
invoca. El riesgo real hoy es bajo porque `OPERACION_REAL_HABILITADA=false`
significa que no debería haber patentes reales en juego; se vuelve material el
día que la barrera importe de verdad.

**Verificación propuesta:** desplegar, luego con DevTools inspeccionar
`caches.keys()` y `caches.open('estacionamiento-shell-v1').keys()` en un
dispositivo que tenga la app desde antes del deploy; confirmar que la entrada `/`
sigue siendo la del build anterior.

## OFF-obs-1 · ¿Qué se rompe de AC-OP-1 al leer los activos del servidor?

Pregunta explícita del encargo. Respuesta: **hoy, nada.** En el ciclo 1 rompía
tres cosas (veto en `LEDGER.md:1284-1320`). El ciclo 2 lo resuelve conservando un
espejo local de las activas, y el borrado tiene tres guardas acumuladas
(`cola-local.ts:197-203`):

```ts
    if (s.syncEstado !== "sincronizada") continue;   // un pendiente no se borra nunca
    if (idsActivas.has(s.id)) continue;              // lo que el servidor lista, se queda
    if (s.sincronizadaAt && s.sincronizadaAt > pedidoDesde) continue;  // no creerle a un GET viejo
```

La primera guarda es la que sostiene AC-OP-1: lo que existe en un solo lugar del
mundo —el ingreso registrado sin red— es intocable para la reconciliación. Los
registros de versiones anteriores no tienen `sincronizadaAt`, así que quedan a
merced de un `GET` corto; pero por definición son `sincronizada`, o sea que
existen en el servidor. No hay pérdida.

## OFF-obs-2 · Idempotencia de sync — **CORRECTA**

`id` generado en el cliente (`pantalla-operador.tsx:264`), enviado en el cuerpo
(`cola-local.ts:282`), y `onConflictDoNothing({ target: sesionVehiculo.id })` en
el servidor (`api/sesiones/route.ts:130`) con relectura de la fila existente.
Reintentar es seguro. La clasificación de rechazos (`esRechazoDefinitivo`,
`cola-local.ts:260-262`) tiene prueba unitaria dedicada con la tabla completa de
códigos.

## OFF-obs-3 · La salida exige red — **LIMITACIÓN DECLARADA, no hallazgo**

`pantalla-operador.tsx:310-312` muestra "Sin conexión: la salida necesita red
para calcular el monto". `spec.md` AC-OP-1 solo exige el **ingreso** offline, y
el ledger registra la decisión (`LEDGER.md:788-793`). Se anota para que no se
lea como regresión.

## OFF-obs-4 · Cada operación de IndexedDB abre y cierra la base

`cola-local.ts:75-90`: `conTienda` hace `abrir()` + `bd.close()` por llamada, y
`purgarNoFixtures`/`purgarNoActivas`/`reconciliarActivas` iteran llamándola una
vez por registro. A escala de piloto es irrelevante; se anota porque también
significa que **una reconciliación no es atómica**: si la app se cierra a mitad,
queda estado parcial.

---

# Rol 4 · revisor-datos

## INT-14 · Los timestamps que gobiernan el dinero los pone el cliente, sin cota — **ALTA**

**Ubicación:** `src/app/api/sesiones/route.ts:45-49`, `95-112`;
`src/app/api/sesiones/[id]/salida/route.ts:47-57`;
`src/lib/tarificacion.ts:61-63`

**Evidencia:**

```ts
// route.ts:45-49 — única validación: que sea parseable
function fechaValida(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}
...
// route.ts:107-112 — única invariante comprobada
  if (fin < inicio) {
    return NextResponse.json({ error: "tecleoFinAt no puede ser anterior a tecleoInicioAt." }, { status: 400 });
  }
```

`entradaAt` se persiste tal cual (`route.ts:121`) y a la salida se usa sin más:

```ts
// salida/route.ts:47-56
  const salidaAt = new Date();                       // reloj del servidor
  ...
  const montoCalculado = calcularMonto({ entradaAt: sesion.entradaAt, salidaAt }, {...});
```

y `calcularMonto` lanza si la entrada es posterior a la salida:

```ts
// tarificacion.ts:61-63
  if (ms < 0) {
    throw new Error("salidaAt no puede ser anterior a entradaAt.");
  }
```

La ruta **no captura** esa excepción (`salida/route.ts:21-66`, sin `try`).

**Impacto — dos fallos distintos, ambos del mundo real, ninguno hipotético:**

1. **Reloj del dispositivo adelantado** (habitual en teléfonos baratos y tras un
   arranque sin red): `entradaAt` queda en el futuro. Al tocar "Salida", la ruta
   lanza → **500**. La sesión nunca pasa a `cerrada`; el operador no puede
   cobrarla y no tiene otro camino en la interfaz. Y como el servidor la sigue
   listando activa, el dispositivo **conserva su patente para siempre**
   (`cola-local.ts:147-154` no toca las activas): reabre M-4 por una puerta que
   la corrección de M-4 no puede cerrar.
2. **Reloj atrasado**: `entradaAt` semanas atrás → `monto_calculado` enorme, que
   la pantalla muestra como monto a cobrar en efectivo (`spec.md` §5). Con
   `entradaAt` suficientemente antiguo, el monto excede `integer` de Postgres
   (2 147 483 647) y el `UPDATE` falla con 22003 → 500 y sesión igualmente
   incerrable.

Colateral sobre H1: `tecleoInicioAt`/`tecleoFinAt` también son del cliente y sin
cota superior. La métrica que justifica el piloto entero (`spec.md` §6) no tiene
verificación de plausibilidad de ningún tipo.

**Verificación propuesta:**

```powershell
# con cookie de operador y OPERACION_REAL_HABILITADA=false
$id = [guid]::NewGuid().ToString()
$futuro = (Get-Date).AddDays(1).ToUniversalTime().ToString("o")
$body = @{ id=$id; patente="FIXT99"; entradaAt=$futuro; tecleoInicioAt=$futuro; tecleoFinAt=$futuro } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/sesiones -Method Post -ContentType 'application/json' -Body $body -WebSession $s
# → se espera 201 (el servidor acepta una entrada en el futuro)
Invoke-WebRequest -Uri "http://localhost:3000/api/sesiones/$id/salida" -Method Post -WebSession $s
# → se espera 500, y la sesión queda 'activa' en la base
```

*(Este verificador escribe en la base: queda fuera del alcance de solo lectura de
esta revisión. Se propone, no se ejecutó. Limpiar después con `npm run limpiar:fixtures`.)*

## INT-15 · Nada impide dos sesiones activas para la misma patente — **MEDIA**

**Ubicación:** `src/db/schema.ts:84-107`;
`drizzle/0000_polite_scorpion.sql:12-24`

**Evidencia:** el único índice único de todo el esquema es el del email
(`0000_polite_scorpion.sql:41`). El POST solo resuelve conflictos por `id`
(`api/sesiones/route.ts:130`), que el cliente genera nuevo en cada confirmación
(`pantalla-operador.tsx:264`, `crypto.randomUUID()`).

**Impacto:** un doble toque en "Confirmar", o el mismo vehículo registrado dos
veces tras una recarga sin red, crea dos sesiones activas con la misma patente.
La ocupación del panel del dueño queda inflada (`dueno/page.tsx:45-53`,
`count()`), que es justamente la cifra contra la que se mide el descuadre —el
indicador existe para detectar cobros por fuera, y este defecto le mete ruido en
la misma dirección. Además, la segunda sesión no tiene vehículo que la cierre y
queda activa indefinidamente, con su patente retenida en base y en dispositivo.

**Verificación propuesta:**

```sql
-- lectura, no escribe nada
SELECT patente, count(*) FROM sesion_vehiculo
WHERE estado = 'activa' GROUP BY patente HAVING count(*) > 1;
```

```powershell
Select-String -Pattern "unique|UNIQUE" -Path src/db/schema.ts, drizzle/0000_polite_scorpion.sql
# → solo usuario.email
```

## INT-16 · Sin `CHECK` de invariantes temporales ni de monto — **MEDIA**

**Ubicación:** `drizzle/0000_polite_scorpion.sql:12-24`

**Evidencia:** la tabla no declara ningún `CHECK`. Las invariantes
`tecleo_fin_at >= tecleo_inicio_at`, `salida_at >= entrada_at`,
`monto_calculado >= 0` y `capacidad_total > 0` viven solo en el código de
aplicación —y la primera solo en una ruta (`api/sesiones/route.ts:107-112`),
mientras que la segunda no está en ningún lado (ver INT-14).

**Impacto:** cualquier camino que no pase por esa ruta —los propios scripts de
verificación insertan por SQL directo— puede escribir estado imposible. La base
es el último lugar donde una invariante sobrevive a un refactor.

## INT-17 · Sin índice para la consulta caliente — **BAJA**

`GET /api/sesiones` filtra por `(estacionamiento_id, estado)`
(`api/sesiones/route.ts:34-39`) y el panel del dueño por
`(estacionamiento_id, estado, salida_at)` (`dueno/page.tsx:55-64`). No hay
índices más allá de las PK y las FK. Irrelevante a escala de piloto; se anota
porque el índice parcial que resolvería INT-15 cubriría también parte de esto.

## DAT-obs-1 · AC-DATA-1 se sostiene

Comparación campo a campo `src/db/schema.ts:29-107` ↔ `spec.md:111-144`: cuatro
entidades, mismos campos, mismos tipos, mismas nulabilidades. `tecleo_inicio_at`
y `tecleo_fin_at` son `NOT NULL` en esquema y migración
(`0000_polite_scorpion.sql:20-21`), que es lo que hace exigible AC-MEAS-1. Las
cuatro FK existen (`0000_polite_scorpion.sql:44-47`), todas `ON DELETE no
action` — lo que, dicho sea de paso, bloqueará el borrado de un `usuario` que
tenga sesiones: relevante para la política de retención de INT-7.

## DAT-obs-2 · Pooling e inicialización

`max: 1` con `idle_timeout: 20` e init perezosa detrás de un `Proxy`
(`src/db/index.ts:44-63`) es la configuración correcta para funciones
serverless, y resolvió un fallo de build real (`LEDGER.md:938-950`). Sin
objeciones.

---

# Rol 5 · revisor-confiabilidad

## INT-1 (repetido desde el rol 1) · higiene de logging del driver — **ALTA**

Es el hallazgo de este rol tanto como del de appsec. Se reporta una sola vez, en
el rol 1. **No es una anécdota histórica: es una condición vigente del código.**

## INT-19 · Ninguna ruta captura errores de base — **MEDIA**

**Ubicación:** `src/app/api/login/route.ts:33`, `src/app/api/sesiones/route.ts:31`
y `114`, `src/app/api/sesiones/[id]/salida/route.ts:35` y `59`,
`src/app/dueno/page.tsx:45` y `55`

**Evidencia:** los `try` que existen en las rutas envuelven exclusivamente
`request.json()` (por ejemplo `api/sesiones/route.ts:56-61`). Ningún acceso a
`db` está dentro de un `try`.

**Impacto:** cualquier fallo transitorio de Railway se convierte en un 500 sin
cuerpo tipado. Del lado del operador eso está razonablemente contenido —la cola
clasifica 5xx como recuperable y reintenta (`cola-local.ts:308-315`)—, pero la
**salida no tiene reintento automático**: `registrarSalida` muestra "No se pudo
registrar la salida. Reintentá." (`pantalla-operador.tsx:290-292`) y deja al
operador con un cliente esperando el monto. Y en el panel del dueño, un fallo de
base tira la página entera sin `error.tsx` que la contenga.

**Verificación propuesta:**

```powershell
Select-String -Pattern "try\s*\{" -Path src/app/api/**/*.ts -Context 0,3
# → confirmar que todos envuelven request.json() y ninguno el acceso a db
Get-ChildItem -Recurse src/app -Filter "error.tsx"
# → sin resultados
```

## INT-20 · Errores de configuración indistinguibles de errores de servicio — **BAJA**

`obtenerEstacionamiento` y `obtenerTarifaVigente` lanzan `Error` genérico
(`src/lib/contexto.ts:19-22`, `54-57`), igual que `exigirEnv`
(`src/lib/env.ts:44-46`) y `claveCorrecta` cuando falta `CLAVE_ACCESO`
(`src/lib/auth.ts:111`). Todos terminan en el mismo 500. Un despliegue sin
`CLAVE_ACCESO` no da "mal configurado", da "el login está roto" — y en un piloto
con una sola persona operando, esa diferencia es media hora de diagnóstico.

## REL-obs-1 · Saneo de entorno — **CORRECTO Y BIEN MOTIVADO**

`src/lib/env.ts:33-39` normaliza BOM, espacio de ancho cero y blancos; el módulo
es ASCII puro y construye los invisibles desde códigos (`env.ts:17-30`), que es
la lección aprendida del incidente registrado en `LEDGER.md:954-979`.
`operacionRealHabilitada()` (`env.ts:66-68`) falla en seguro: cualquier valor que
no sea exactamente `"true"` deja la barrera puesta.

## REL-obs-2 · Cold start

Con `max: 1` e init perezosa, una invocación que no toca la base no abre
conexión. `connect_timeout: 10` es coherente con los límites de función de
Vercel. Sin objeciones.

## REL-obs-3 · Ruido en la corrida de pruebas

`npm test` emite `MODULE_TYPELESS_PACKAGE_JSON` (el runner carga `.ts` sin
`"type"` en `package.json`). No rompe nada; 47/47 en verde.

---

# Rol 6 · sintetizador (lead)

## Deduplicación y resolución de conflictos de severidad

| Origen | Resolución |
|---|---|
| PRV-1 (Alta) y REL-1 (Alta) de la pasada previa | Mismo hallazgo, y **la severidad estaba inflada**: los cuerpos 400/403 son literales sin patente. Degradado a **PRV-obs-1**. |
| INT-1 reportado por appsec y por confiabilidad | Uno solo, **Alta**, en el rol 1. |
| INT-3 (appsec) e INT-12 (offline) | Causa y consecuencia. Se mantienen separados porque la corrección es distinta: INT-12 se arregla versionando el caché; INT-3 es la razón por la que urge. |
| A-2 "cerrado" en el ledger | El **incidente** está cerrado (credencial rotada y verificada en las dos direcciones). La **causa** no. Se reabre como INT-1, con severidad propia. |
| M-3 (rol congelado en la cookie) de la pasada previa | Absorbido por A-1: la corrección de A-1 —validar contra la tabla `usuario`— lo resuelve. No se cuenta aparte. |

## Orden por RIESGO REAL

No es orden por severidad nominal. El criterio es: probabilidad × daño ×
irreversibilidad, con el estado real del sistema (público, base productiva
detrás, `OPERACION_REAL_HABILITADA=false`).

| # | Hallazgo | Sev. | Por qué acá |
|---|---|---|---|
| 1 | **INT-1** · el driver reimprime la credencial | Alta | El gate terminal A-2 se levantó sin arreglar lo que lo bajó. Se reabre solo, sin intervención de nadie, en el próximo fallo de conexión. Único hallazgo que puede volver a comprometer la base entera. |
| 2 | **C-1** · login sin freno | Crítica | Puerta única de todo el sistema, expuesta a internet, sin costo ni señal para quien la ataque. Sigue segundo solo porque la clave actual de 20 caracteres hace la fuerza bruta impracticable **hoy** — y esa mitigación es una propiedad del valor, no del sistema. |
| 3 | **INT-14** · timestamps del cliente sin cota | Alta | Es el único hallazgo que rompe la operación *en régimen normal*, sin atacante: un reloj desajustado deja una sesión imposible de cerrar, con su patente retenida indefinidamente, y hace cobrar un monto arbitrario en efectivo. Reabre M-4 por una puerta lateral. |
| 4 | **INT-7** · sin mecanismo de retención | Alta | Bloquea de verdad `OPERACION_REAL_HABILITADA`. Resolver los placeholders no alcanza: no hay dónde escribir la decisión. `patente NOT NULL` además impide el enmascaramiento que `spec.md:150` promete. |
| 5 | **A-1** + **INT-11** | Alta + Media | Se agravan mutuamente y hay que corregirlos juntos: hoy la cookie no vence; en cuanto venza, la primera navegación cachea el login como shell offline y el operador sin red se queda afuera con vehículos adentro. Corregir A-1 sin INT-11 rompe el offline-first. |
| 6 | **M-1** + **M-2** + **INT-4** | Media ×3 | Mismo cambio en cuatro lugares: derivar el estacionamiento del usuario autenticado y recortar la respuesta. M-2 no es solo lectura cruzada: escribe patentes ajenas en el dispositivo. |
| 7 | **INT-12** + **INT-3** | Media ×2 | El caché sin versionar deja correr offline un cliente anterior a la barrera de A-3. Bajo hoy (`false`), material el día que la barrera importe. |
| 8 | **INT-15** + **INT-16** | Media ×2 | Integridad que hoy vive solo en una ruta. Ensucia la única métrica que responde H2. |
| 9 | **INT-19** · sin captura de errores de base | Media | Contenido por la cola en el ingreso; expuesto en la salida, que es donde hay un cliente esperando. |
| 10 | **INT-8** · sin cierre de sesión | Media | Dispositivo compartido por turnos, con patentes activas en IndexedDB por diseño. |
| 11 | **INT-2** · sin CSP | Media | Defensa en profundidad; sin vector concreto hoy. |
| 12 | **INT-9**, **B-1**, **B-2**, **B-3**, **B-4**, **INT-17**, **INT-20** | Baja | Se corrigen cuando toque el archivo. |

## Reconciliación con `docs/revision-seguridad-2026-08-09.md`

| Hallazgo | Estado tras esta revisión |
|---|---|
| A-3 | **Cerrado**, sin bypass por los flujos vivos (tabla de caminos, rol 1). Residual **INT-3** por el service worker. |
| A-2 | Incidente **cerrado** (rotación verificada, `LEDGER.md:1245-1274`). Causa raíz **abierta** como INT-1. |
| M-4 | **Corregido en el árbol de trabajo** (ciclo 2), **sin asiento de cierre en el ledger** y contradicho por `STATE.md:32`. No se declara PASS acá: esta revisión no corrió `verificar:m4`. **INT-14** e **INT-9** abren dos puertas que lo reabren parcialmente. |
| C-1 | Abierto, confirmado, sin cambios. |
| A-1 | Abierto, confirmado. Ahora acoplado a INT-11. |
| M-1 | Abierto, confirmado. |
| M-2 | Abierto, confirmado y **agravado** (escribe en el dispositivo, no solo lee). |
| M-3 | Absorbido por A-1. |
| B-1…B-4 | Abiertos, confirmados, sin cambios. |

## GATES TERMINALES

- **A-2 — levantado, con reserva.** La credencial expuesta (`36e1f8c4`) está
  muerta y la vigente (`1b199545`) verificada en las dos direcciones
  (`LEDGER.md:1245-1274`). **Reserva:** el gate protege contra una exposición que
  el código puede volver a producir (INT-1). Se recomienda tratar INT-1 como
  condición del gate, no como hallazgo ordinario.

## BLOQUEOS HUMANOS (ningún cambio de código los resuelve)

1. **`{{BASE_LICITUD}}`** y **`{{PLAZO_RETENCION_PATENTE}}`**
   (`spec.md:150-155`, `310-311`). Con el agregado de INT-7: además de decidirlos,
   hay que **construir** el mecanismo que los aplique, y eso incluye poder borrar
   la patente sin borrar la fila —hoy imposible, `patente` es `NOT NULL`—.
2. **Deploy por `git push`** (`spec.md` §8): sigue por CLI; falta conectar el
   remoto de GitHub.
3. **Redondeo del monto**: `Math.round` neutro (`tarificacion.ts:37-39`),
   pendiente de confirmación comercial.
4. **Asiento de cierre de M-4 ciclo 2** en `LEDGER.md`, con auditoría y
   verificación. Es decisión de proceso, no de código.

## Lo verificado en esta auditoría

```
npm test        → 47 pruebas, 0 fallos, 10 suites
npm run build   → PASS · Next.js 16.3.0 · 9 rutas · TypeScript limpio
```

Nada más se ejecutó. Los comandos de verificación de cada hallazgo están
propuestos, no corridos: varios escriben en la base y quedan fuera del alcance de
solo lectura de esta revisión.
