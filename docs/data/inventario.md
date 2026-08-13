# Inventario de datos — FASE 0

> **Insumo crudo.** Lo que existe HOY en el código, con su cita `archivo:línea`,
> contrastado contra lo que `spec.md` implica. No decide nada: alimenta el MER,
> el MR, los casos de uso y la matriz de trazabilidad.
>
> **Regla de este documento:** una fila marcada `VERIFICADO_CODIGO` significa que
> alguien abrió ese archivo en esa línea. Nada se declara por leer un docstring.
>
> Fecha: 2026-08-13 · Árbol: commit `8c28d9a`

---

## 1. Fuentes leídas

| Fuente | Qué aporta |
|---|---|
| `spec.md` §2 §4 §5 §6 §7 §9 §10 §12 | alcance, modelo, flujo, medición, AC, placeholders |
| `docs/adr/ADR-001` (en `spec.md` §2) | gate de exclusión: pago, LPR, reservas, multisitio |
| `docs/adr/ADR-004-multisitio-y-suscripcion.md` | aceptado parcialmente: suscripción sí, multisitio no |
| `docs/diseno-2026-08-12-traduccion.md` | SPEC-004 (AC-UI-1..4), SPEC-005 (AC-UX-1..8), auditoría data-driven |
| `src/db/schema.ts` | esquema real |
| `src/lib/{tarificacion,tiempo,sesion-token,patente,fixtures,env,contexto,auth}.ts` | reglas de dominio |
| `src/app/api/**` | fronteras de entrada |
| `LEDGER.md`, `STATE.md`, `LEARNINGS.md` | historia y veredictos |

---

## 2. Entidades que existen HOY en código

### 2.1 `estacionamiento` — `src/db/schema.ts:33`

| Campo | Tipo | Nulo | Cita | En `spec.md` §4 |
|---|---|---|---|---|
| `id` | uuid PK | no | `schema.ts:36` | sí |
| `nombre` | text | no | `schema.ts:37` | sí |
| `capacidad_total` | integer | no | `schema.ts:38` | sí |
| `zona_horaria` | text | no | `schema.ts:39` | sí |
| `created_at` | timestamptz | no | `schema.ts:40` | sí |

Invariante no declarada en `spec.md`: `CHECK capacidad_positiva` (`schema.ts:46`).
**Deriva menor** — es endurecimiento (INT-16), no un campo nuevo.

### 2.2 `usuario` — `src/db/schema.ts:50`

| Campo | Tipo | Nulo | Cita | En `spec.md` §4 |
|---|---|---|---|---|
| `id` | uuid PK | no | `schema.ts:51` | sí |
| `email` | text UNIQUE | no | `schema.ts:52` | sí |
| `rol` | enum `rol_usuario` | no | `schema.ts:53` | sí |
| `estacionamiento_id` | uuid FK | no | `schema.ts:54` | sí |
| `created_at` | timestamptz | no | `schema.ts:57` | sí |

**Sin campo de credencial, y es deliberado.** La barrera es una clave compartida
del piloto, comparada en `src/lib/auth.ts:113` contra `CLAVE_ACCESO` del entorno.
`spec.md` §3 dice "auth mínima, dos roles" y no exige más.

### 2.3 `tarifa` — `src/db/schema.ts:68`

| Campo | Tipo | Nulo | Cita | En `spec.md` §4 |
|---|---|---|---|---|
| `id` | uuid PK | no | `schema.ts:71` | sí |
| `estacionamiento_id` | uuid FK | no | `schema.ts:72` | sí |
| `valor_hora` | integer (CLP) | no | `schema.ts:76` | sí |
| `fraccion_minutos` | integer | no | `schema.ts:78` | sí |
| `monto_minimo` | integer (CLP) | no | `schema.ts:80` | sí |
| `vigente_desde` | timestamptz | no | `schema.ts:81` | sí |

CHECKs: `valor_hora_no_negativo` (`:86`), `fraccion_positiva` (`:87`),
`monto_minimo_no_negativo` (`:88`).

Resolución de vigencia: `src/lib/contexto.ts:57` `obtenerTarifaVigente()`.

### 2.4 `sesion_vehiculo` — `src/db/schema.ts:105`

| Campo | Tipo | Nulo | Cita | En `spec.md` §4 |
|---|---|---|---|---|
| `id` | uuid PK | no | `schema.ts:108` | sí |
| `estacionamiento_id` | uuid FK | no | `schema.ts:109` | sí |
| `operador_id` | uuid FK | no | `schema.ts:112` | sí |
| `patente` | text · **dato personal** | no | `schema.ts:116` | sí |
| `entrada_at` | timestamptz | no | `schema.ts:117` | sí |
| `salida_at` | timestamptz | **sí** | `schema.ts:119` | sí |
| `monto_calculado` | integer (CLP) | **sí** | `schema.ts:121` | sí |
| `tecleo_inicio_at` | timestamptz | no | `schema.ts:123` | sí |
| `tecleo_fin_at` | timestamptz | no | `schema.ts:127` | sí |
| `estado` | enum `estado_sesion` | no | `schema.ts:128` | sí |
| `sync_estado` | enum `estado_sync` | no | `schema.ts:129` | sí |

**Coincide campo por campo con `spec.md` §4. Cero campos de más, cero de menos.**

Índices e invariantes añadidos por endurecimiento:

| Objeto | Cita | Hallazgo |
|---|---|---|
| `uniqueIndex sesion_vehiculo_activa_unica` (parcial, `estado='activa'`) | `schema.ts:148` | INT-15 |
| `CHECK tecleo_coherente` | `schema.ts:161` | INT-16 |
| `CHECK salida_posterior_a_entrada` | `schema.ts:162` | INT-16 |
| `CHECK monto_no_negativo` | `schema.ts:166` | INT-16 |
| `index sesion_vehiculo_por_estado` | `schema.ts:177` | INT-17 |
| `index sesion_vehiculo_por_salida` | `schema.ts:178` | INT-17 |

### 2.5 Enums — `src/db/schema.ts:25-31`

`estado_sesion` = `activa | cerrada` (`:25`) · `estado_sync` = `local |
sincronizada` (`:28`) · `rol_usuario` = `operador | dueño` (`:31`).

---

## 3. Estado que existe fuera de la base

No todo el estado del sistema vive en Postgres. Esto importa para el MER: son
datos que el modelo relacional **no** contiene y que igual sostienen el flujo.

| Almacén | Qué guarda | Cita | Persistencia |
|---|---|---|---|
| IndexedDB `estacionamiento/sesiones` | cola offline + espejo de activas | `src/lib/cola-local.ts:35-37`, tipo en `:39` | dispositivo del operador |
| Cookie `sesion` | carga firmada HMAC con `exp` | `src/lib/auth.ts:50`, formato en `src/lib/sesion-token.ts:40` | navegador, 12 h (`sesion-token.ts:30`) |
| Limitador de intentos | conteo por email/IP | `src/lib/limite-intentos.ts:49` | memoria del proceso |
| Ocupación observada (descuadre) | conteo que teclea el dueño | `src/app/dueno/descuadre.tsx:26` | **no se persiste** — decisión de `spec.md` §6 |

**El descuadre no tiene entidad y no debe tenerla.** `spec.md` §6 dice que el
panel no requiere tabla adicional; en minimización es además lo correcto —
persistir la sospecha sería registrar un hecho sobre una persona.

---

## 4. Reglas de dominio, y dónde viven

| Regla | Cita | Notas |
|---|---|---|
| Redondeo por fracción y piso mínimo | `src/lib/tarificacion.ts:49`, `:75` | función pura, sin reloj ni base |
| Normalización y validación de patente | `src/lib/patente.ts:24`, `:53` | 4–8 caracteres, ≥1 dígito |
| Formato de patente (`antiguo`/`nuevo`/`otro`) | `src/lib/patente.ts:39` | `otro` se acepta a propósito |
| Cota del reloj del cliente | `src/lib/tiempo.ts:73`, `:91` | INT-14 |
| Permanencia máxima facturable | `src/lib/tiempo.ts:48` | 30 días · **techo técnico, no regla de negocio** |
| Desfase ignorable | `src/lib/tiempo.ts:37` | 2 s |
| Monto almacenable | `src/lib/tiempo.ts:51`, `:131` | cota de integer de Postgres |
| Barrera de datos reales | `src/lib/fixtures.ts:12`, `:15` | prefijo `FIXT`, **no configurable** |
| Vigencia de sesión | `src/lib/sesion-token.ts:30` | 12 h · **decisión de operación, no de `spec.md`** |
| Saneo de errores | `src/lib/errores.ts:82`, `:185` | INT-1 |

---

## 5. Fronteras de entrada

| Ruta | Método | Rol | Cita |
|---|---|---|---|
| `/api/login` | POST | — | `src/app/api/login/route.ts:47` |
| `/api/login` | DELETE | sesión activa | `src/app/api/login/route.ts:115` |
| `/api/sesiones` | GET | operador | `src/app/api/sesiones/route.ts:42` |
| `/api/sesiones` | POST | operador | `src/app/api/sesiones/route.ts:77` |
| `/api/sesiones/[id]/salida` | POST | operador | `src/app/api/sesiones/[id]/salida/route.ts:38` |

Minimización comprobable en el código: el `GET` proyecta **tres columnas**
(`route.ts:50-52`) y la salida proyecta seis (`salida/route.ts:29-36`). Ninguna
ruta devuelve la fila completa.

Pertenencia, no solo rol: el `GET` filtra por `operador.estacionamientoId`
(`route.ts:58`) y la salida también (`salida/route.ts:66`) — hallazgos M-1/M-2.

---

## 6. Deriva código ↔ spec

### 6.1 Deriva REAL: reglas operativas sin lugar en `spec.md`

Existen en código, gobiernan el comportamiento, y `spec.md` no las menciona. **No
son campos ni entidades: son constantes de operación.**

| Constante | Valor | Cita | Naturaleza |
|---|---|---|---|
| Vigencia de sesión | 12 h | `sesion-token.ts:30` | decisión de operación |
| Permanencia máxima facturable | 30 días | `tiempo.ts:48` | techo técnico contra reloj roto |
| Desfase ignorable | 2 s | `tiempo.ts:37` | tolerancia de reloj |
| Redondeo del monto | `Math.round` (neutro) | `tarificacion.ts:75` | **decisión comercial pendiente** |
| Prefijo de fixture | `FIXT` | `fixtures.ts:12` | barrera de cumplimiento |

**Ninguna se propone incorporar a `spec.md` en la FASE 3.** Fijar un umbral es
DECISIÓN, no formalización; van a la lista de decisiones pendientes.

### 6.2 Deriva REAL: `spec.md` promete algo que nadie ejecuta

**`spec.md:150`** — *"Vencido el plazo, la patente se elimina o se enmascara"*.

**No hay mecanismo de purga**: ni tarea, ni columna de retención, ni job, ni AC
que lo exija. Es INT-7, bloqueado por `{{PLAZO_RETENCION_PATENTE}}` y
`{{BASE_LICITUD}}`.

**El esquema NO es el bloqueo**, y decir que lo era fue un error de este
inventario. `patente` es `NOT NULL` (`schema.ts:116`) pero sin CHECK de formato,
el índice único es parcial sobre las activas (`schema.ts:148`) y ninguna FK
apunta a `sesion_vehiculo`: un `UPDATE … SET patente='XXXXXX' WHERE estado
= 'cerrada' AND salida_at < $plazo` cumple la promesa **sin migración**. Ver
`MR.md` §8.

**Deriva de nivel spec, no de código.** Se registra; no se resuelve acá.

### 6.3 Deriva REAL: `spec.md` §8 pide algo que no se cumple

*"deploy por `git push`"*. El deploy corre por CLI de Vercel. El remoto existe
(`origin` → `p4rkc0ntr0l`, commit `8c28d9a`) pero **no está conectado al proyecto
de Vercel**. Deuda declarada desde M4.

### 6.4 Deriva REAL: asimetría no escrita

El ingreso funciona sin red; **la salida requiere conexión**, porque el monto se
calcula en el servidor con la tarifa vigente. Está registrado en `LEDGER.md`
(cierre de M2) y lo señala AC-UX-3 de la traducción, pero **`spec.md` §5 no lo
dice**. Una restricción de producto que vive solo en un ledger es una restricción
que el próximo lector no va a encontrar.

### 6.5 NO es deriva: campos que la spec pide y el esquema tiene

Los 11 campos de `sesion_vehiculo`, los 5 de `estacionamiento`, los 6 de
`tarifa` y los 5 de `usuario` coinciden uno a uno con `spec.md` §4. Verificado
por comando en `verificar:esquema` (FASE 2).

### 6.6 NO es deriva: entidades prohibidas ausentes

`Pago`, `Transaccion`, `Sucursal`, `Reserva`: **ninguna existe**. Es AC-SCOPE-2,
y se comprueba con `grep` en `src/db/` (FASE 2).

---

## 7. Lo que el diseño pide y el modelo NO tiene

De `docs/diseno-2026-08-12-traduccion.md` §4. Se listan acá como insumo del gate
de la FASE 1; **ninguno entra al modelo en este loop**.

| Dato de la maqueta | Falta | Justificación H1/H2 |
|---|---|---|
| `1e` *"aplicada a 1.412 salidas"* | `sesion_vehiculo.tarifa_id` | **H2** — el dueño no puede reconstruir un monto tras cambiar la tarifa |
| `1f` estado *Activo/Suspendido* | `usuario.estado` | **operativa** — hoy dar de baja exige borrar la fila, y la FK lo impide |
| `1d` *"+12,4% vs ayer"* | — | derivable con dos ventanas: es trabajo, no esquema |
| `1d`/`1n` descuadre persistido | tabla nueva | **rechazado**: `spec.md` §6 lo prohíbe explícitamente |
| `1h` dirección del estacionamiento | `estacionamiento.direccion` | **rechazado**: ninguna hipótesis lo necesita |
| `1a` *"¿Olvidaste tu clave?"* | credencial por usuario | no aplica: la clave es compartida (`auth.ts:113`) |
| `1f` *"Invitar usuario"* | alta en producto | hoy se siembran (`scripts/sembrar.mjs`) |
| `1i`/`1j` planes, UF, facturación | `suscripcion` | **bloqueado**: ADR-004 aceptado pero AC-SCOPE-1 sin reescribir |

---

## 8. Placeholders vivos, tal como están

Ninguno se rellena. Se listan con quién los bloquea.

| Placeholder | Bloquea | Cita |
|---|---|---|
| `{{BASE_LICITUD}}` | operar con patentes reales | `spec.md` §4, §12 |
| `{{PLAZO_RETENCION_PATENTE}}` | ídem + INT-7 | `spec.md` §4, §12 |
| `{{PRECIO_SUSCRIPCION_UF}}` | validar H2 · `1i`/`1j` | `spec.md` §12 |
| `{{UMBRAL_H1_SEGUNDOS}}` | definir "validado" para H1 | `spec.md` §1, §12 |
| `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` | ídem | `spec.md` §12 |
| `{{UMBRAL_H2_DUEÑOS}}` · `{{PLAZO_PILOTO}}` | definir "validado" para H2 | `spec.md` §12 |
| `{{EQUIPO_REVISOR}}` | gobernanza | `spec.md` §12 |
| `{{PASARELA_SUSCRIPCION}}` | elegir Webpay o Flow | ADR-004 |

---

## 9. El hallazgo de fondo, que no es un campo

**La instrumentación de H1 existe y nunca midió nada.**

- `tecleo_inicio_at` y `tecleo_fin_at` son `NOT NULL` (`schema.ts:123`, `:127`).
- AC-MEAS-1 comprueba que ninguna sesión cerrada los tenga nulos.
- Pero **el numerador está vacío**: cada verificador de navegador llama
  `limpiarFixtures()` al iniciar (`scripts/lib/fixtures.mjs`), y toda tanda
  termina en `sesiones restantes en la base: 0`.

El criterio mide una **propiedad del esquema**, no una **medición del piloto**.
`spec.md` §1 define H1 contra `{{UMBRAL_H1_SEGUNDOS}}`, que además no existe.

Esto va como fila propia en la matriz de la FASE 2, con estado
**ESPECIFICADO · INSTRUMENTADO · SIN DATOS**.
