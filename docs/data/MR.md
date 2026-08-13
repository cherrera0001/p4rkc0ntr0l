# MR — Modelo relacional

> Derivado de `src/db/schema.ts` y de `docs/data/MER.md`. Los tipos y las
> restricciones que se listan **existen en el esquema**; los que no, se marcan
> como propuesta.
>
> Fecha: 2026-08-13 · Árbol: commit `8c28d9a`

---

## 1. Tablas

### `estacionamiento` — `src/db/schema.ts:33`

| Columna | Tipo | Restricción | Dominio |
|---|---|---|---|
| `id` | `uuid` | **PK**, `defaultRandom()` | — |
| `nombre` | `text` | `NOT NULL` | libre |
| `capacidad_total` | `integer` | `NOT NULL`, `CHECK > 0` (`schema.ts:46`) | cupos |
| `zona_horaria` | `text` | `NOT NULL` | **identificador IANA** (`America/Santiago`) |
| `created_at` | `timestamptz` | `NOT NULL`, `defaultNow()` | instante UTC |

### `usuario` — `src/db/schema.ts:50`

| Columna | Tipo | Restricción | Dominio |
|---|---|---|---|
| `id` | `uuid` | **PK** | — |
| `email` | `text` | `NOT NULL`, **UNIQUE** (`schema.ts:52`) | correo |
| `rol` | `rol_usuario` | `NOT NULL` | `operador \| dueño` |
| `estacionamiento_id` | `uuid` | `NOT NULL`, **FK →** `estacionamiento.id` | — |
| `created_at` | `timestamptz` | `NOT NULL`, `defaultNow()` | instante UTC |

### `tarifa` — `src/db/schema.ts:68`

| Columna | Tipo | Restricción | Dominio |
|---|---|---|---|
| `id` | `uuid` | **PK** | — |
| `estacionamiento_id` | `uuid` | `NOT NULL`, **FK** | — |
| `valor_hora` | `integer` | `NOT NULL`, `CHECK >= 0` (`schema.ts:86`) | **CLP entero** |
| `fraccion_minutos` | `integer` | `NOT NULL`, `CHECK > 0` (`schema.ts:87`) | minutos |
| `monto_minimo` | `integer` | `NOT NULL`, `CHECK >= 0` (`schema.ts:88`) | **CLP entero** |
| `vigente_desde` | `timestamptz` | `NOT NULL` | instante UTC |

### `sesion_vehiculo` — `src/db/schema.ts:105`

| Columna | Tipo | Restricción | Dominio |
|---|---|---|---|
| `id` | `uuid` | **PK** | lo genera **el cliente** (ver §5) |
| `estacionamiento_id` | `uuid` | `NOT NULL`, **FK** | — |
| `operador_id` | `uuid` | `NOT NULL`, **FK →** `usuario.id` | — |
| `patente` | `text` | `NOT NULL` | normalizada: 4–8 caracteres, ≥1 dígito (`src/lib/patente.ts:53`) · **dato personal** |
| `entrada_at` | `timestamptz` | `NOT NULL` | instante UTC, acotado al presente (`src/lib/tiempo.ts:91`) |
| `salida_at` | `timestamptz` | NULL | instante UTC · `CHECK >= entrada_at` (`schema.ts:162`) |
| `monto_calculado` | `integer` | NULL | **CLP entero** · `CHECK >= 0` (`schema.ts:166`) · cota en `src/lib/tiempo.ts:51` |
| `tecleo_inicio_at` | `timestamptz` | `NOT NULL` | instante UTC |
| `tecleo_fin_at` | `timestamptz` | `NOT NULL` | `CHECK >= tecleo_inicio_at` (`schema.ts:161`) |
| `estado` | `estado_sesion` | `NOT NULL`, default `activa` | `activa \| cerrada` |
| `sync_estado` | `estado_sync` | `NOT NULL`, default `local` | `local \| sincronizada` |

Índices:

| Índice | Tipo | Cita | Para qué |
|---|---|---|---|
| `sesion_vehiculo_activa_unica` | **UNIQUE parcial** `WHERE estado='activa'` sobre (`estacionamiento_id`, `patente`) | `schema.ts:148` | un vehículo no está dos veces adentro (INT-15) |
| `sesion_vehiculo_por_estado` | btree (`estacionamiento_id`, `estado`) | `schema.ts:177` | lista de activas del operador |
| `sesion_vehiculo_por_salida` | btree (`estacionamiento_id`, `estado`, `salida_at`) | `schema.ts:178` | agregado diario del panel |

---

## 2. Dominios, explícitos

| Dominio | Representación | Por qué |
|---|---|---|
| **Dinero del estacionamiento** | `integer`, pesos chilenos | El peso no tiene subunidad en circulación. `integer` evita el error de coma flotante en dinero. Cota superior en `src/lib/tiempo.ts:51` para no desbordar el `integer` de Postgres. |
| **Dinero de la suscripción** | `numeric` en **UF** — **propuesto, no existe** | `spec.md` §1 define H2 en UF. La UF tiene 2 decimales y **no** es un entero: usar el mismo dominio que el estacionamiento sería un error. Bloqueado: `{{PRECIO_SUSCRIPCION_UF}}` sin definir. |
| **Instantes** | `timestamptz`, siempre UTC | Todos los `timestamp` del esquema llevan `withTimezone: true`. |
| **Corte del día** | `estacionamiento.zona_horaria`, IANA | El panel calcula el inicio del día en la zona del estacionamiento, no en la del servidor: `src/app/dueno/page.tsx:23`. Un servidor en UTC cortaría el día del operador a las 21:00. |
| **Patente** | `text` normalizado | Mayúsculas, sin separadores: `src/lib/patente.ts:24`. `bb.bb-12` y `BBBB12` son la misma sesión. |

---

## 3. Normalización

**El esquema está en 3NF.** Verificación por tabla:

| Tabla | 1NF | 2NF | 3NF |
|---|---|---|---|
| `estacionamiento` | atómica | PK simple | ningún atributo depende de otro no-clave |
| `usuario` | atómica | PK simple | `rol` y `email` son independientes entre sí |
| `tarifa` | atómica | PK simple | los tres valores son independientes; `vigente_desde` no los determina |
| `sesion_vehiculo` | atómica | PK simple | ver el análisis de `monto_calculado`, abajo |

### El único candidato a violación de 3NF, y por qué no lo es

`monto_calculado` **es derivable** de `entrada_at`, `salida_at` y la tarifa
vigente. Un dato derivado almacenado suele ser una violación.

No lo es acá, por dos razones que conviene dejar escritas:

1. **No depende de otro atributo no-clave de la misma fila.** Depende de una fila
   de `tarifa`, que es otra relación. Formalmente no hay dependencia transitiva
   dentro de `sesion_vehiculo`.
2. **Es un hecho histórico, no un cálculo.** El monto que se le cobró a alguien
   en efectivo ocurrió. Recalcularlo después con otra tarifa daría un número
   distinto del que se cobró, y ese número es lo que el dueño compara contra su
   caja (`spec.md` §6). Almacenarlo no es redundancia: es el registro del hecho.

---

## 4. La desnormalización que NO se hizo, y su costo

**`sesion_vehiculo` no referencia la tarifa con la que se calculó su monto.**

Estado hoy:

- El monto se computa a la salida con `obtenerTarifaVigente()`
  (`src/lib/contexto.ts:57`), que toma la tarifa más reciente cuyo
  `vigente_desde` ya pasó (`contexto.ts:63`).
- El histórico de tarifas **sí** se conserva: se insertan filas nuevas, no se
  pisan. El comentario de `contexto.ts:54` lo dice: *"guardar el histórico en vez
  de pisarlo permite recalcular una salida vieja con la tarifa que regía
  entonces"*.
- Pero la sesión **no guarda cuál se usó**.

### Por qué importa, en términos de auditabilidad

La reconstrucción es *inferible*, no *registrada*. Para saber con qué tarifa se
cobró una sesión hay que replicar la consulta de `contexto.ts:63` con
`salida_at` como momento. Eso funciona **mientras nadie inserte una tarifa con
`vigente_desde` retroactivo** — que el esquema permite, porque no hay `CHECK`
que lo impida.

Con una tarifa retroactiva, la inferencia devuelve una tarifa que **no** es la que
se usó, y el sistema afirmaría un cálculo falso sobre un cobro real. La maqueta
`1e` promete exactamente lo contrario: *"las sesiones cerradas conservan el valor
con que se calcularon"*. Se conserva el valor; **no se conserva el cómo**.

### Las dos salidas, y cuál se recomienda

| Opción | Efecto | Costo |
|---|---|---|
| **A. FK `tarifa_id` nullable** | La sesión registra qué tarifa se aplicó. Reconstrucción exacta, inmune a retroactividad. | Aditiva. No toca ningún AC vigente. Requiere migración. |
| B. Snapshot de los tres valores en la sesión | Ídem, sin JOIN. | Triplica columnas y desnormaliza de verdad; el JOIN no es un problema a escala de piloto. |

**Recomendada: A.** Es la que el gate de H2 justifica —la visibilidad es el
producto— y la que menos superficie agrega. **No se implementa en este loop**
(no se toca `src/`); queda como deuda de modelo priorizada.

---

## 5. Decisiones de identidad

**El `id` de `sesion_vehiculo` lo genera el cliente**, no la base, aunque la
columna tenga `defaultRandom()` (`src/db/schema.ts:108`).

Razón, registrada en `LEDGER.md` (cierre de AC-OP-1): sin un id estable generado
antes de guardar en IndexedDB, una reconexión inestable duplica sesiones en cada
reintento. El id es la clave de idempotencia del outbox.

Consecuencia para el modelo: **la PK no es un secreto ni un contador**. Es un
uuid v4 elegido por el dispositivo, y el servidor resuelve conflictos por él.

---

## 6. Relaciones M:N

**Ninguna.** Ver `MER.md` §4: el dominio no la tiene, y la candidata natural
—una tabla `vehiculo`— se descarta por minimización, no por simplicidad.

Si en el futuro entra `suscripcion` con más de un estacionamiento por cuenta,
aparecería una M:N entre cuenta y estacionamiento. **Eso es multisitio y sigue
excluido** (ADR-004 alternativa 2).

---

## 7. AC-DATA-* → tabla/campo

Estado actual: `spec.md` §9 tiene **un solo** `AC-DATA-1`, que cubre el modelo
entero de una vez.

| AC | Qué afirma | Objetos que toca | Verificación |
|---|---|---|---|
| `AC-DATA-1` | el modelo coincide con `spec.md` §4 | las 4 tablas, los 3 enums, las 4 FK | `npm run verificar:esquema` |

La verificación además comprueba que `tecleo_inicio_at` y `tecleo_fin_at` sigan
`NOT NULL`, de lo que depende AC-MEAS-1.

**Brecha de cobertura.** `AC-DATA-1` verifica **presencia y forma**, no las
invariantes que el endurecimiento agregó: el índice único parcial de INT-15, los
tres `CHECK` de INT-16 y los índices de INT-17 se comprueban en
`verificar:invariantes`, que **no tiene AC en `spec.md`**.

Es un caso de `CONSTRUIDO + NO_ESPECIFICADO`. La FASE 3 propone los `AC-DATA-*`
que lo formalizan — formalizar lo que ya existe y ya se verifica es formalización,
no decisión.

---

## 8. Lo que este modelo relacional no puede sostener

`patente` es `NOT NULL` (`src/db/schema.ts:116`). La promesa de `spec.md:150`
—*"la patente se elimina o se enmascara"*— **no es implementable sobre este
esquema**: enmascarar exige `NULL` o un centinela, y ninguno cabe hoy.

Además no hay columna de retención, ni tarea de purga, ni AC que lo exija.
Es INT-7, bloqueado por `{{PLAZO_RETENCION_PATENTE}}` y `{{BASE_LICITUD}}`.
