# ParkControl · MR — modelo relacional

> Traducción del `MER.md` a tablas, claves, tipos y restricciones, para **SQLite
> con WAL** (motor declarado del servidor) y con la migración a PostgreSQL
> anotada donde el SQL **cambia de verdad**.
>
> **Las restricciones van en la base, no solo en la aplicación.** Una invariante
> que vive únicamente en Node se rompe el día que alguien escribe por otro
> camino: una corrección manual, un script de migración, un segundo proceso.

---

## 1. Convenciones

| Decisión | Por qué |
|---|---|
| **PK `TEXT` con UUID**, no `INTEGER AUTOINCREMENT` | el `id` del movimiento **lo genera el dispositivo** antes de haber red: no puede depender de un autoincremento del servidor. Y un id secuencial filtra volumen de negocio |
| **Instantes en UTC, `TEXT` ISO-8601** | SQLite no tiene tipo fecha. El corte de día y de turno se calcula con `cliente.zona_horaria`, **nunca con la del servidor** |
| **Dinero en enteros** (unidad mínima de la moneda) | nada de `REAL`: el redondeo de punto flotante en cobros es un descuadre que nadie puede explicar después |
| **Booleanos como `INTEGER 0/1`** con `CHECK` | SQLite no tiene booleano |
| **`cliente_id` en toda tabla de negocio** | es la columna de aislamiento; sin ella no hay filtro posible |

---

## 2. Tablas

```sql
CREATE TABLE plan (
  codigo        TEXT PRIMARY KEY CHECK (codigo IN ('lite','pro')),
  max_admins    INTEGER NOT NULL CHECK (max_admins  > 0),
  max_cajeros   INTEGER NOT NULL CHECK (max_cajeros > 0),
  capacidades   TEXT    NOT NULL          -- JSON: lista de capacidades habilitadas
);

CREATE TABLE cliente (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  zona_horaria  TEXT NOT NULL,            -- IANA; se valida contra la librería, no contra una lista propia
  plan_codigo   TEXT NOT NULL REFERENCES plan(codigo),
  estado        TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','suspendido')),
  creado_at     TEXT NOT NULL
);

CREATE TABLE usuario (
  id               TEXT PRIMARY KEY,
  cliente_id       TEXT REFERENCES cliente(id),
  email            TEXT NOT NULL,
  credencial_hash  TEXT NOT NULL,         -- POR USUARIO. Ver MER.md §4
  rol              TEXT NOT NULL CHECK (rol IN ('superadmin','admin','cajero')),
  estado           TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','suspendido')),
  creado_at        TEXT NOT NULL,

  -- LA invariante de aislamiento: nulo exactamente cuando el rol es superadmin.
  -- Sin esto, un cajero sin cliente filtraría contra NULL y TODAS las cláusulas
  -- de aislamiento del producto dejarían de aislar.
  CONSTRAINT pertenencia_por_rol CHECK (
    (rol = 'superadmin' AND cliente_id IS NULL) OR
    (rol <> 'superadmin' AND cliente_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX ux_usuario_email ON usuario (lower(email));

CREATE TABLE tarifa (
  id                 TEXT PRIMARY KEY,
  cliente_id         TEXT NOT NULL REFERENCES cliente(id),
  valor_hora         INTEGER NOT NULL CHECK (valor_hora        >= 0),
  fraccion_minutos   INTEGER NOT NULL CHECK (fraccion_minutos   > 0),
  tolerancia_minutos INTEGER NOT NULL CHECK (tolerancia_minutos >= 0),
  monto_minimo       INTEGER NOT NULL CHECK (monto_minimo      >= 0),
  vigente_desde      TEXT NOT NULL          -- lo pone el SERVIDOR, nunca el cuerpo
);
CREATE INDEX ix_tarifa_vigencia ON tarifa (cliente_id, vigente_desde DESC);

CREATE TABLE turno_caja (
  id              TEXT PRIMARY KEY,
  cliente_id      TEXT NOT NULL REFERENCES cliente(id),
  usuario_id      TEXT NOT NULL REFERENCES usuario(id),
  monto_inicial   INTEGER NOT NULL CHECK (monto_inicial   >= 0),
  monto_declarado INTEGER          CHECK (monto_declarado >= 0),
  monto_esperado  INTEGER,
  abierto_at      TEXT NOT NULL,
  cerrado_at      TEXT,
  estado          TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado')),

  CONSTRAINT cierre_coherente CHECK (
    (estado = 'abierto' AND cerrado_at IS NULL     AND monto_declarado IS NULL) OR
    (estado = 'cerrado' AND cerrado_at IS NOT NULL AND monto_declarado IS NOT NULL)
  ),
  CONSTRAINT cierre_posterior CHECK (cerrado_at IS NULL OR cerrado_at >= abierto_at)
);
-- Un solo turno abierto por cajero. Es lo que impide que dos aperturas
-- simultáneas creen dos turnos y partan la recaudación en dos.
CREATE UNIQUE INDEX ux_turno_abierto
  ON turno_caja (cliente_id, usuario_id) WHERE estado = 'abierto';

CREATE TABLE movimiento (
  id               TEXT PRIMARY KEY,       -- generado por el DISPOSITIVO = clave de idempotencia
  cliente_id       TEXT NOT NULL REFERENCES cliente(id),
  usuario_id       TEXT NOT NULL REFERENCES usuario(id),
  turno_id         TEXT REFERENCES turno_caja(id),
  tarifa_id        TEXT REFERENCES tarifa(id),   -- con qué versión se cobró
  patente          TEXT NOT NULL,          -- DATO PERSONAL
  tipo_vehiculo    TEXT NOT NULL,
  entrada_at       TEXT NOT NULL,
  salida_at        TEXT,
  monto_cobrado    INTEGER CHECK (monto_cobrado >= 0),
  tecleo_inicio_at TEXT,
  tecleo_fin_at    TEXT,
  estado           TEXT NOT NULL DEFAULT 'dentro' CHECK (estado IN ('dentro','cerrado')),

  CONSTRAINT salida_posterior  CHECK (salida_at IS NULL OR salida_at >= entrada_at),
  CONSTRAINT tecleo_coherente  CHECK (tecleo_fin_at IS NULL OR tecleo_inicio_at IS NULL
                                      OR tecleo_fin_at >= tecleo_inicio_at),
  CONSTRAINT cerrado_coherente CHECK (
    (estado = 'dentro'  AND salida_at IS NULL     AND monto_cobrado IS NULL) OR
    (estado = 'cerrado' AND salida_at IS NOT NULL AND monto_cobrado IS NOT NULL)
  )
);

-- LA restricción que impide el vehículo duplicado, y que hace posible que el
-- reintento de la cola sea idempotente: un choque aquí se traduce a "ya existe",
-- no a un 500.
CREATE UNIQUE INDEX ux_movimiento_dentro
  ON movimiento (cliente_id, patente) WHERE estado = 'dentro';

CREATE INDEX ix_movimiento_dentro   ON movimiento (cliente_id, estado);
CREATE INDEX ix_movimiento_periodo  ON movimiento (cliente_id, salida_at);
CREATE INDEX ix_movimiento_turno    ON movimiento (turno_id);

CREATE TABLE suscripcion (
  id            TEXT PRIMARY KEY,
  cliente_id    TEXT NOT NULL REFERENCES cliente(id),
  plan_codigo   TEXT NOT NULL REFERENCES plan(codigo),
  vigente_desde TEXT NOT NULL,
  vence_at      TEXT NOT NULL,
  estado        TEXT NOT NULL CHECK (estado IN ('al_dia','vencida','suspendida')),
  CONSTRAINT vigencia_coherente CHECK (vence_at >= vigente_desde)
);

CREATE TABLE auditoria (
  id          TEXT PRIMARY KEY,
  cliente_id  TEXT REFERENCES cliente(id),
  usuario_id  TEXT NOT NULL REFERENCES usuario(id),
  accion      TEXT NOT NULL,
  recurso_id  TEXT,
  ocurrido_at TEXT NOT NULL
);
CREATE INDEX ix_auditoria_cliente ON auditoria (cliente_id, ocurrido_at DESC);
```

---

## 3. Las cuatro restricciones que sostienen el producto

Si alguna de estas vive solo en la aplicación, **el producto no cumple lo que
promete**, aunque los tests pasen:

| # | Restricción | Qué se rompe sin ella |
|---|---|---|
| 1 | `ux_movimiento_dentro` | el mismo auto entra dos veces; y el reintento de la cola **duplica** en vez de ser idempotente |
| 2 | `ux_turno_abierto` | dos aperturas simultáneas parten la recaudación del turno en dos, y el arqueo acusa a alguien |
| 3 | `pertenencia_por_rol` | un usuario sin cliente filtra contra `NULL` y **el aislamiento entre clientes deja de aislar** |
| 4 | `cerrado_coherente` | existen movimientos «cerrados» sin monto, que la contabilidad suma como cero |

> **Verificalas contra el motor, no contra el DDL.** Que el `CREATE TABLE` diga
> `CHECK` no prueba que la restricción esté aplicada en la base que está
> corriendo: la migración pudo no haberse ejecutado. Se comprueba **intentando
> violarla** y confirmando el error.
>
> Y cuidado con el guard: comprobar que **el nombre** de la restricción existe no
> es comprobar **su definición**. Un `CHECK (1=1)` con el nombre correcto pasaría.

---

## 4. Aislamiento — la regla, en una línea

**`cliente_id` nunca viene del cuerpo de la petición.** Sale de la fila del
usuario autenticado, releída en cada petición. Toda consulta de negocio filtra
por él.

Y la forma de la respuesta importa: **un recurso de otro cliente responde 404, no
403.** La diferencia entre «no existe» y «no es tuyo» ya es información.

**Se prueba con dos clientes sembrados, o no se probó.** Con uno solo, el
aislamiento se cumple por casualidad, y esa casualidad es toda la separación que
hay.

---

## 5. SQLite con WAL — lo que hay que saber antes de confiarse

| Propiedad | Consecuencia real |
|---|---|
| **WAL = un escritor, N lectores** | las escrituras se serializan. Con varios recintos activos, los cierres de salida **hacen cola**. Es correcto, no es concurrente |
| **`busy_timeout` importa** | sin él, un segundo escritor recibe `SQLITE_BUSY` inmediato y el error sube como 5xx — que la cola local trata como recuperable y **corta el lote del turno** |
| **Índice único parcial** | soportado, y es lo que hace idempotente al reintento |
| **Un solo archivo** | el respaldo es copiar el archivo **con el WAL**, no solo el `.db`. Copiar el `.db` solo produce respaldos silenciosamente incompletos |
| **Sin tipos de fecha ni booleanos** | de ahí las convenciones de §1 |

### Migrar a PostgreSQL: qué cambia de verdad

*«Listo para migrar»* es una afirmación sin comando hasta que exista una capa de
acceso sin SQL específico del motor **y se pruebe corriendo la suite contra los
dos**. Lo que cambia:

| SQLite | PostgreSQL |
|---|---|
| `TEXT` ISO-8601 | `timestamptz` — y el corte de día pasa a poder hacerse en SQL |
| `INTEGER 0/1` | `boolean` |
| `TEXT` + `CHECK IN (…)` | `enum` o dominio |
| `lower(email)` indexado | `citext` o índice funcional |
| un escritor | MVCC: **desaparece la serialización**, y con ella la razón de varios diseños de arriba |
| `INSERT … ON CONFLICT DO NOTHING` | igual — la idempotencia se conserva |

**La migración que importa no es la de tipos: es la de supuestos.** Todo código
escrito asumiendo un escritor único puede estar tapando una carrera que aparece
recién en Postgres.

---

## 6. Consultas que hay que tener escritas y probadas

No son ejemplos: son las que deciden si el producto dice la verdad.

1. **Vehículos dentro** — `WHERE cliente_id = ? AND estado = 'dentro'`, más antiguo primero.
2. **Tarifa vigente al instante T** — la de mayor `vigente_desde <= T` del cliente. Es la que valoriza la salida, **y la que permite reconstruir un monto viejo**.
3. **Esperado del turno** — suma de `monto_cobrado` de movimientos cerrados dentro de la ventana del turno, **en la zona horaria del recinto**.
4. **Uso del plan** — conteo de usuarios activos por rol contra `max_admins` / `max_cajeros`, evaluado **dentro de la transacción** que crea el usuario.
5. **Velocidad de registro** — mediana de `tecleo_fin_at − tecleo_inicio_at` **con su tamaño de muestra**, separando datos de prueba de operación real. Sin `n`, la mediana no es evidencia de nada.
