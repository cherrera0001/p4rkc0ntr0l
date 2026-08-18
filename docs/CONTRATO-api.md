# Contrato de API

**Actualizado:** 2026-08-17 · **Derivado del código, no al revés.**

> Este documento **describe** lo que las rutas hacen. Si el contrato y una ruta
> discrepan, **manda la ruta** y el contrato está mal. No es una declaración de
> intenciones: cada afirmación de aquí se puede contrastar con un comando.
>
> Lo que hace cumplir el contrato:
> `npm run verificar:frontera` (AC-API-1) · `npm run verificar:concurrencia`
> (AC-OP-5) · `npm run verificar:aislamiento` (AC-ISO-1/2, AC-ADM-1) ·
> `npm run verificar:salida` (AC-OP-4) · `npm run verificar:endurecimiento`.

---

## 1. Reglas transversales

### 1.1 · Autenticación

Cookie de sesión `sesion`, HMAC-SHA256, `httpOnly` + `SameSite=Lax` + `Secure` en
producción, con `iat`/`exp` **verificados en el servidor**. Dura 12 horas.

**El rol se relee de la base en cada petición** (`src/lib/auth.ts:87-89`), no se
confía en lo que la cookie afirma: revocar o cambiar un rol tiene efecto
inmediato, sin esperar a que expire la sesión.

Toda ruta autenticada se construye con `rutaAutenticada`
(`src/lib/peticion.ts`). No es un detalle de estilo: garantiza que la resolución
de sesión —que toca la base— ocurra **dentro** del `try`, y que un fallo de
infraestructura salga como 503 tipado en vez de 500 mudo. Lo hace cumplir
`verificar:endurecimiento` **por exclusión**: recorre todo `src/app/api/` y falla
si alguna ruta llama a `exigirRol` por fuera.

### 1.2 · Roles y permisos

| Rol | Puede | No puede |
|---|---|---|
| `operador` | registrar ingresos (offline incluido), listar las activas de **su** estacionamiento, cerrar salidas | ver el panel del dueño; tocar datos de otro cliente |
| `dueño` | ver ocupación, ingresos observados y descuadre de **su** estacionamiento | listar patentes (`GET /api/sesiones` le responde 401); operar |
| `plataforma` | dar de alta clientes | **acceder a una patente por cualquier ruta** (AC-ISO-2) |

La tabla vive en código en `src/lib/roles.ts` y es **descriptiva**. La
autorización real la hace cada ruta; ocultar un enlace no es negar un permiso.

### 1.3 · Aislamiento entre clientes

El `estacionamiento_id` **nunca viene del cliente**: sale de la fila de `usuario`
releída en cada petición. Todas las consultas de producto filtran por él.

Un recurso de otro cliente responde **404**, no 403: la diferencia entre "no
existe" y "no es tuyo" ya es información.

Probado con **dos** clientes sembrados (`verificar:aislamiento`), y probado que
el verificador falla si se borra una cláusula de aislamiento real.

### 1.4 · Origen (CSRF)

Los métodos que mutan comprueban `Origin` / `Sec-Fetch-Site`. `GET /api/sesiones`
**no** lo comprueba, deliberadamente: un GET de otro sitio no lo puede leer el
atacante por CORS. La asimetría es explícita en cada ruta, no un default.

### 1.5 · Forma de los errores

Siempre `{ "error": "<texto>" }`, a veces con campos extra: `tipo`, `modo`,
`campos`, `esperaSegundos`, `motivo`, `duplicada`, `yaCerrada`.

### 1.6 · Códigos y qué significan para el cliente offline

**Esta tabla es el contrato más importante del sistema**, porque la cola local
del operador actúa distinto según el código, y equivocarse pierde datos:

| Código | Significado | Qué hace la cola local |
|---|---|---|
| 400, 403 | rechazo definitivo | **borra** el registro del dispositivo |
| 401, 408, 409, 429, 5xx | recuperable | lo deja en cola **y corta el lote** |

De ahí dos consecuencias que el sistema respeta en todas partes:

- **Nunca se devuelve 5xx por un dato que la base jamás va a aceptar.** Sería un
  reintento infinito que bloquea la sincronización entera del turno. Lo hace
  cumplir `AC-API-1`.
- **Los fallos de infraestructura son 503 y nunca 500**, con `Retry-After`, y
  distinguen `tipo: "configuracion"` de `tipo: "base-datos"`.

### 1.7 · Validación de frontera

No hay validador declarativo; la validación es explícita y vive en
`src/lib/frontera.ts` y `src/lib/patente.ts`.

- `esIdValido` valida **posiciones** de UUID. El guard anterior contaba
  caracteres de un alfabeto y aceptaba 36 guiones, que producía un 503.
- `esTextoAlmacenable` rechaza el **byte NUL**, que Postgres no admite en `text`
  ni escapado. Ningún otro carácter se rechaza: acentos, saltos de línea y
  espacios invisibles son texto legítimo.

---

## 2. Rutas

### `POST /api/login` — pública

**Cuerpo:** `{ email: string, clave: string }`

| Respuesta | Cuándo |
|---|---|
| `200 { rol, destino }` | credenciales correctas. `destino` sale de `src/lib/roles.ts` |
| `400 { error }` | email ausente, no-cadena, de más de 255, o con byte NUL |
| `401 { error }` | credenciales incorrectas. **Idéntico** para email inexistente y clave mala |
| `429 { error, esperaSegundos }` + `Retry-After` | límite de intentos por IP **y** por email |
| `403 { error }` | origen ajeno |
| `503 { error, tipo }` | fallo de configuración o de base |

El límite de intentos se consulta **antes** de tocar la base y antes de comparar
la clave: un intento frenado no cuesta una consulta ni da señal de temporizado.
La comparación es en tiempo constante y no filtra el largo.

**Limitación declarada:** el limitador es en memoria **por instancia**. En un
despliegue con varias instancias, un atacante repartido lo evade en parte.

### `DELETE /api/login`

Borra la cookie. Solo comprueba origen; no exige sesión. `200 { ok: true }`.

### `GET /api/sesiones` — rol `operador`

Sesiones activas del estacionamiento del operador, más antigua primero.

**Devuelve solo tres columnas** —`id`, `patente`, `entradaAt`— por minimización
(§7). El `dueño` y `plataforma` reciben **401**: el panel del dueño trabaja con
`count()` y `sum()` y nunca necesitó la lista de patentes.

### `POST /api/sesiones` — rol `operador`

**Cuerpo:** `{ id, patente, entradaAt, tecleoInicioAt, tecleoFinAt, clienteAhora }`

`id` lo genera **el cliente** antes de escribir en IndexedDB: es la clave de
idempotencia.

| Respuesta | Cuándo |
|---|---|
| `201 { sesion, duplicada: false }` | se creó |
| `200 { sesion, duplicada: true }` | el mismo `id` ya existía: reintento de sincronización, no error |
| `200 { sesion, duplicada: true, motivo: "patente-ya-activa" }` | otra sesión activa con esa patente (doble toque en Confirmar) |
| `400 { error }` | patente inválida, `id` no-UUID, fechas ausentes o inválidas, `tecleoFinAt < tecleoInicioAt` |
| `403 { error, modo: "piloto" }` | patente no-fixture con `OPERACION_REAL_HABILITADA=false` |

**Idempotencia en tres capas**, y las tres hacen falta: el `id` del cliente, un
`onConflictDoNothing` sobre él, y un índice único parcial
`(estacionamiento_id, patente) WHERE estado = 'activa'` cuyo `23505` se traduce a
200 en lugar de 503.

`estacionamientoId` y `operadorId` salen de la sesión, **nunca del cuerpo**.

El reloj del cliente se **corrige, no se rechaza**: un 400 sería definitivo para
la cola y borraría el ingreso del dispositivo, o sea que un teléfono mal puesto
en hora convertiría cada registro sin red en un registro perdido.

### `POST /api/sesiones/[id]/salida` — rol `operador`

Sin cuerpo. **La hora de salida la pone el servidor**, no el cliente.

| Respuesta | Cuándo |
|---|---|
| `200 { sesion, yaCerrada: false }` | esta petición cerró la sesión |
| `200 { sesion, yaCerrada: true }` | ya estaba cerrada, **o perdió la carrera**: devuelve el monto y la hora del ganador |
| `400 { error }` | `id` no es UUID |
| `404 { error }` | no existe **o es de otro cliente** |

**Se cierra exactamente una vez** (AC-OP-5). El `UPDATE` lleva
`estado = 'activa'` en su `WHERE`, así que en READ COMMITTED el segundo re-evalúa
contra la versión nueva y afecta cero filas. Medido antes de corregir: **ocho
salidas simultáneas cerraban las ocho**, con ocho horas distintas.

Perder la carrera y llegar segundo tras una reconexión son, desde afuera, el
mismo evento — por eso ambos son `yaCerrada: true` y no un 409 nuevo.

El monto se calcula en el servidor con la **tarifa vigente de la base**: el
cliente puede traer una tarifa vieja tras estar sin red. **El cobro es en
efectivo y fuera del sistema** (ADR-001): esto devuelve el monto, no registra
ningún movimiento de dinero.

### `POST /api/plataforma/clientes` — rol `plataforma`

Alta de cliente. **Cuerpo:** `nombre`, `zonaHoraria`, `capacidadTotal`,
`valorHora`, `fraccionMinutos`, `montoMinimo`, `emailDueno`, `emailOperador`.

| Respuesta | Cuándo |
|---|---|
| `201 { cliente: { id, nombre } }` | creado y operativo |
| `400 { error, campos: [...] }` | campos inválidos. **Se devuelven todos**, no el primero |
| `409 { error, campos }` | ya existe un usuario con ese email |
| `401` / `403` | sin rol `plataforma` / origen ajeno |

Escribe **cuatro filas en una transacción** —estacionamiento, tarifa, dueño y
operador—: un alta a medias dejaría un estacionamiento que no puede cobrar una
salida. Es la única operación del sistema que necesita transacción, y por eso es
la única que la usa.

Los enteros se exigen **como número**, no como texto numérico. La zona horaria se
valida contra `Intl`, no contra una lista propia.

---

## 3. Lo que este contrato NO cubre

Se dice en vez de omitirse, porque un contrato que calla se lee como completo:

- **No hay endpoint de sincronización por lotes.** La cola postea de a uno. No
  hay cursor, ni `updated_at`, ni vector clock: el servidor es la verdad sobre
  quién está adentro, y el dispositivo sobre lo que aún no subió.
- **No hay versionado de API** (`/v1/`). Con un solo cliente de la API —la propia
  PWA— versionar sería ceremonia.
- **No hay límite de tamaño de cuerpo** en ninguna ruta.
- **No hay rate limit fuera del login.**
- **No hay endpoint de salud ni de métricas.**
- **No hay rutas de edición** de tarifa, usuario o estacionamiento: lo que el
  alta crea, se cambia por SQL. Es deuda conocida, no un olvido.
