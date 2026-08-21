/**
 * Extrae el modelo entidad-relación DEL MOTOR, no del DDL.
 *
 * Es la regla que este repo ya aplica en `verificar:esquema` y en el agente de
 * backend: el DDL dice lo que alguien quiso; `pg_catalog` dice lo que hay. Si
 * una migración falló a medias, sólo el motor lo sabe.
 */
import postgres from "postgres";
import { writeFileSync } from "node:fs";

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });

const salida = [];
const p = (s = "") => salida.push(s);

try {
  const columnas = await sql`
    SELECT c.relname AS tabla, a.attname AS columna, a.attnum AS orden,
           format_type(a.atttypid, a.atttypmod) AS tipo,
           a.attnotnull AS obligatoria,
           pg_get_expr(d.adbin, d.adrelid) AS por_defecto
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum`;

  const restricciones = await sql`
    SELECT c.relname AS tabla, con.conname AS nombre, con.contype AS tipo,
           pg_get_constraintdef(con.oid) AS definicion,
           cf.relname AS tabla_referida
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_class cf ON cf.oid = con.confrelid
    WHERE n.nspname = 'public'
    ORDER BY c.relname, con.contype, con.conname`;

  const indices = await sql`
    SELECT c.relname AS tabla, i.relname AS indice,
           pg_get_indexdef(x.indexrelid) AS definicion,
           x.indisunique AS unico, x.indisprimary AS es_pk
    FROM pg_index x
    JOIN pg_class c ON c.oid = x.indrelid
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY c.relname, i.relname`;

  const filas = await sql`
    SELECT relname AS tabla, n_live_tup AS aprox
    FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname`;

  const tablas = [...new Set(columnas.map((c) => c.tabla))];

  p("# Modelo de datos — extraído del motor");
  p();
  p("**Fecha:** 2026-08-20");
  p("**Fuente:** `pg_catalog` de la base viva en Railway, **no** el DDL ni");
  p("`src/db/schema.ts`. Es la regla que `verificar:esquema` ya aplica: el DDL dice");
  p("lo que alguien quiso, el motor dice lo que hay.");
  p();
  p("**Generado por** `extraer-modelo.mjs`. No editar a mano: se regenera.");
  p();
  p(`**${tablas.length} entidades** en el esquema \`public\`.`);
  p();
  p("---");
  p();
  p("## Diagrama entidad-relación");
  p();
  p("```mermaid");
  p("erDiagram");

  const pkDe = (t) =>
    restricciones
      .filter((r) => r.tabla === t && r.tipo === "p")
      .map((r) => r.definicion.replace(/^PRIMARY KEY \((.*)\)$/, "$1"))
      .join(", ");

  for (const t of tablas) {
    p(`    ${t} {`);
    for (const c of columnas.filter((x) => x.tabla === t)) {
      const marca = pkDe(t).includes(c.columna)
        ? "PK"
        : restricciones.some(
              (r) => r.tabla === t && r.tipo === "f" && r.definicion.includes(`(${c.columna})`),
            )
          ? "FK"
          : "";
      const tipo = c.tipo.replace(/ /g, "_").replace(/[()]/g, "");
      p(`        ${tipo} ${c.columna} ${marca}${marca ? " " : ""}"${c.obligatoria ? "obligatoria" : "opcional"}"`);
    }
    p("    }");
  }

  for (const r of restricciones.filter((x) => x.tipo === "f")) {
    const col = r.definicion.match(/FOREIGN KEY \(([^)]+)\)/)?.[1] ?? "";
    p(`    ${r.tabla_referida} ||--o{ ${r.tabla} : "${col}"`);
  }
  p("```");
  p();
  p("---");
  p();
  p("## Entidades, campo por campo");

  for (const t of tablas) {
    const conteo = filas.find((f) => f.tabla === t);
    p();
    p(`### \`${t}\``);
    p();
    p(`Filas vivas (aprox., \`pg_stat_user_tables\`): **${conteo?.aprox ?? "?"}**`);
    p();
    p("| Campo | Tipo | Obligatorio | Por defecto |");
    p("|---|---|---|---|");
    for (const c of columnas.filter((x) => x.tabla === t)) {
      p(
        `| \`${c.columna}\` | \`${c.tipo}\` | ${c.obligatoria ? "sí" : "no"} | ${
          c.por_defecto ? `\`${c.por_defecto}\`` : "—"
        } |`,
      );
    }

    const rt = restricciones.filter((x) => x.tabla === t);
    if (rt.length) {
      p();
      p("**Restricciones declaradas en la base** (no en la aplicación):");
      p();
      const nombre = { p: "PK", f: "FK", u: "única", c: "CHECK", x: "exclusión" };
      for (const r of rt) {
        p(`- \`${r.nombre}\` · **${nombre[r.tipo] ?? r.tipo}** · \`${r.definicion}\``);
      }
    }

    const it = indices.filter((x) => x.tabla === t && !x.es_pk);
    if (it.length) {
      p();
      p("**Índices** (sin contar el de la clave primaria):");
      p();
      for (const i of it) p(`- \`${i.indice}\`${i.unico ? " · único" : ""} · \`${i.definicion}\``);
    }
  }

  p();
  p("---");
  p();
  p("## Lo que este documento NO dice");
  p();
  p("- **No es la especificación.** `spec.md` §4 manda; esto es lo que la base");
  p("  tiene hoy. Si divergen, es un hallazgo, y `AC-DATA-1` es quien lo detecta.");
  p("- **No incluye datos.** Los conteos son estadísticas del motor, no filas.");
  p("  Ninguna patente sale de la base por acá.");
  p();

  writeFileSync("docs/MODELO-datos.md", salida.join("\n") + "\n");
  console.log(`docs/MODELO-datos.md escrito · ${tablas.length} entidades · ${columnas.length} campos · ${restricciones.length} restricciones · ${indices.length} índices`);
} finally {
  await sql.end();
}
