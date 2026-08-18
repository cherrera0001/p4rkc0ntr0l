/**
 * Esquema de datos — SPEC-001 (spec.md §4).
 *
 * Principio rector: minimización. Solo los campos que responden H1 (velocidad de
 * registro) y H2 (visibilidad para el dueño). Ningún campo "por si sirve".
 *
 * El gate de alcance (ADR-001) prohíbe entidades de cobro electrónico, de
 * multisitio y de cupos anticipados. El cobro es en efectivo, fuera del sistema.
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Estado del ciclo de vida de una sesión (spec.md §4). */
export const estadoSesion = pgEnum("estado_sesion", ["activa", "cerrada"]);

/** Estado de sincronización offline-first (spec.md §3 y §5). */
export const estadoSync = pgEnum("estado_sync", ["local", "sincronizada"]);

/**
 * Roles del sistema (spec.md §3, enmendado por ADR-005 alternativa 2).
 *
 * `plataforma` es el rol de C4A: da de alta clientes nuevos. Existe porque hasta
 * hoy esa operación —la de mayor privilegio del sistema— se hacía con
 * `DATABASE_URL` en la mano y `scripts/sembrar.mjs` a mano, o sea por el camino
 * menos auditable que hay.
 *
 * **No accede a `patente` por ninguna ruta** (REQ-ISO-3 de ADR-005): es el rol
 * con más poder y el más difícil de acotar, y la patente es dato personal.
 */
export const rolUsuario = pgEnum("rol_usuario", ["operador", "dueño", "plataforma"]);

export const estacionamiento = pgTable(
  "estacionamiento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    capacidadTotal: integer("capacidad_total").notNull(),
    zonaHoraria: text("zona_horaria").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Una capacidad de cero o negativa haría negativo el "libres" del panel.
    check("capacidad_positiva", sql`${t.capacidadTotal} > 0`),
  ],
);

export const usuario = pgTable("usuario", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  rol: rolUsuario("rol").notNull(),
  /**
   * **Nulo si y solo si el rol es `plataforma`**, y lo hace cumplir la base
   * (ver `pertenencia_por_rol` abajo).
   *
   * Aflojar esto a "nullable a secas" habría abierto un agujero de aislamiento:
   * un `operador` sin estacionamiento no tiene frontera contra la que filtrar, y
   * las seis cláusulas de aislamiento del producto quedarían comparando contra
   * `null`. La invariante va en la base y no en la aplicación, igual que las
   * otras siete (AC-DATA-2).
   */
  estacionamientoId: uuid("estacionamiento_id").references(() => estacionamiento.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  check(
    "pertenencia_por_rol",
    // **Se compara por texto, no por el valor del enum.** Postgres prohibe usar
    // un valor de enum recien agregado dentro de la misma transaccion que lo
    // agrego, y drizzle-kit corre cada migracion en una. Medido: sin el cast la
    // migracion aborta entera y no aplica ni el DROP NOT NULL.
    sql`(${t.rol}::text = 'plataforma' AND ${t.estacionamientoId} IS NULL)
        OR (${t.rol}::text <> 'plataforma' AND ${t.estacionamientoId} IS NOT NULL)`,
  ),
]);

/**
 * Tarifa vigente de un estacionamiento.
 *
 * Los tres valores son datos de operación que carga el dueño, NO constantes de
 * negocio: no se hardcodean (spec.md §11). Montos en pesos, enteros.
 */
export const tarifa = pgTable(
  "tarifa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    estacionamientoId: uuid("estacionamiento_id")
      .notNull()
      .references(() => estacionamiento.id),
    /** Valor por hora, en pesos. */
    valorHora: integer("valor_hora").notNull(),
    /** Unidad mínima de cobro, en minutos. La permanencia se redondea a este múltiplo. */
    fraccionMinutos: integer("fraccion_minutos").notNull(),
    /** Piso de cobro, en pesos. */
    montoMinimo: integer("monto_minimo").notNull(),
    vigenteDesde: timestamp("vigente_desde", { withTimezone: true }).notNull(),
  },
  (t) => [
    // `calcularMonto` ya rechaza estos valores; acá quedan como invariante de
    // la base, que es donde una regla sobrevive a un refactor (INT-16).
    check("valor_hora_no_negativo", sql`${t.valorHora} >= 0`),
    check("fraccion_positiva", sql`${t.fraccionMinutos} > 0`),
    check("monto_minimo_no_negativo", sql`${t.montoMinimo} >= 0`),
  ],
);

/**
 * SesionVehiculo — el corazón de la v1.
 *
 * `patente` es DATO PERSONAL bajo la Ley 21.719 (spec.md §7). Se guarda
 * normalizada y es el único identificador de vehículo que existe en el sistema.
 * Su plazo de retención y su base de licitud son {{PLAZO_RETENCION_PATENTE}} y
 * {{BASE_LICITUD}}: siguen sin resolver, y deben resolverse ANTES de operar con
 * datos reales.
 *
 * `tecleoInicioAt` / `tecleoFinAt` no son metadatos accesorios: son la métrica de
 * H1 (spec.md §6). Su diferencia es el tiempo de registro que el piloto mide.
 * Por eso son NOT NULL: una sesión sin ellos no aporta evidencia.
 */
export const sesionVehiculo = pgTable(
  "sesion_vehiculo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    estacionamientoId: uuid("estacionamiento_id")
      .notNull()
      .references(() => estacionamiento.id),
    operadorId: uuid("operador_id")
      .notNull()
      .references(() => usuario.id),
    /** Dato personal. Normalizada y validada en toda frontera de entrada. */
    patente: text("patente").notNull(),
    entradaAt: timestamp("entrada_at", { withTimezone: true }).notNull(),
    /** Nulo mientras la sesión está activa. */
    salidaAt: timestamp("salida_at", { withTimezone: true }),
    /** En pesos. Se computa a la salida desde la tarifa vigente. */
    montoCalculado: integer("monto_calculado"),
    /** Inicio del tecleo de patente — métrica H1. */
    tecleoInicioAt: timestamp("tecleo_inicio_at", {
      withTimezone: true,
    }).notNull(),
    /** Fin del tecleo de patente — métrica H1. */
    tecleoFinAt: timestamp("tecleo_fin_at", { withTimezone: true }).notNull(),
    estado: estadoSesion("estado").notNull().default("activa"),
    syncEstado: estadoSync("sync_estado").notNull().default("local"),
  },
  (t) => [
    /**
     * Un vehículo no puede estar dos veces adentro (hallazgo INT-15).
     *
     * El único índice único que tenía el esquema era el del email, y el POST de
     * ingreso resuelve conflictos por `id` —que el cliente genera nuevo en cada
     * confirmación—. Un doble toque en "Confirmar", o el mismo vehículo
     * registrado otra vez tras una recarga sin red, creaba dos sesiones activas
     * con la misma patente: la ocupación del panel del dueño quedaba inflada,
     * justo la cifra contra la que se mide el descuadre, y en la misma dirección
     * que el problema que el indicador existe para detectar. Y la segunda sesión
     * no tenía vehículo que la cerrara: quedaba activa para siempre, con su
     * patente retenida en base y en dispositivo.
     *
     * Parcial: solo restringe las activas. Un mismo auto puede entrar y salir
     * mil veces, que es lo normal.
     */
    uniqueIndex("sesion_vehiculo_activa_unica")
      .on(t.estacionamientoId, t.patente)
      .where(sql`${t.estado} = 'activa'`),

    /**
     * Invariantes temporales y de monto (hallazgo INT-16).
     *
     * Vivían solo en el código de aplicación —y `salida_at >= entrada_at` no
     * vivía en ningún lado—. Cualquier camino que no pase por la ruta, como los
     * propios scripts de verificación que insertan por SQL directo, podía
     * escribir estado imposible. La base es el último lugar donde una invariante
     * sobrevive a un refactor.
     */
    check("tecleo_coherente", sql`${t.tecleoFinAt} >= ${t.tecleoInicioAt}`),
    check(
      "salida_posterior_a_entrada",
      sql`${t.salidaAt} IS NULL OR ${t.salidaAt} >= ${t.entradaAt}`,
    ),
    check(
      "monto_no_negativo",
      sql`${t.montoCalculado} IS NULL OR ${t.montoCalculado} >= 0`,
    ),

    /**
     * Índices de las dos consultas calientes (hallazgo INT-17): la lista de
     * activas del operador y el agregado diario del panel del dueño. A escala de
     * piloto no cambia nada; se agregan acá porque el índice parcial de arriba
     * ya cubría media consulta y dejarlo a medias sería raro.
     */
    index("sesion_vehiculo_por_estado").on(t.estacionamientoId, t.estado),
    index("sesion_vehiculo_por_salida").on(
      t.estacionamientoId,
      t.estado,
      t.salidaAt,
    ),
  ],
);

export type Estacionamiento = typeof estacionamiento.$inferSelect;
export type Usuario = typeof usuario.$inferSelect;
export type Tarifa = typeof tarifa.$inferSelect;
export type SesionVehiculo = typeof sesionVehiculo.$inferSelect;
export type NuevaSesionVehiculo = typeof sesionVehiculo.$inferInsert;
