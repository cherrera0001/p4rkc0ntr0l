/**
 * Esquema de datos — SPEC-001 (spec.md §4).
 *
 * Principio rector: minimización. Solo los campos que responden H1 (velocidad de
 * registro) y H2 (visibilidad para el dueño). Ningún campo "por si sirve".
 *
 * El gate de alcance (ADR-001) prohíbe entidades de cobro electrónico, de
 * multisitio y de cupos anticipados. El cobro es en efectivo, fuera del sistema.
 */

import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Estado del ciclo de vida de una sesión (spec.md §4). */
export const estadoSesion = pgEnum("estado_sesion", ["activa", "cerrada"]);

/** Estado de sincronización offline-first (spec.md §3 y §5). */
export const estadoSync = pgEnum("estado_sync", ["local", "sincronizada"]);

/** Roles de la v1. Auth mínima, dos roles, sin más (spec.md §3). */
export const rolUsuario = pgEnum("rol_usuario", ["operador", "dueño"]);

export const estacionamiento = pgTable("estacionamiento", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  capacidadTotal: integer("capacidad_total").notNull(),
  zonaHoraria: text("zona_horaria").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usuario = pgTable("usuario", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  rol: rolUsuario("rol").notNull(),
  estacionamientoId: uuid("estacionamiento_id")
    .notNull()
    .references(() => estacionamiento.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Tarifa vigente de un estacionamiento.
 *
 * Los tres valores son datos de operación que carga el dueño, NO constantes de
 * negocio: no se hardcodean (spec.md §11). Montos en pesos, enteros.
 */
export const tarifa = pgTable("tarifa", {
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
});

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
export const sesionVehiculo = pgTable("sesion_vehiculo", {
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
});

export type Estacionamiento = typeof estacionamiento.$inferSelect;
export type Usuario = typeof usuario.$inferSelect;
export type Tarifa = typeof tarifa.$inferSelect;
export type SesionVehiculo = typeof sesionVehiculo.$inferSelect;
export type NuevaSesionVehiculo = typeof sesionVehiculo.$inferInsert;
