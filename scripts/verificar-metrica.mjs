/**
 * AC-H1-2 — la métrica del código es la que `spec.md` §6 declara.
 *
 * **Comando propio, y no una sección de `verificar:h1`, por una razón concreta:**
 * `verificar:h1` sale con exit≠0 mientras el banco esté vacío —eso es su
 * entregable, no un defecto—, así que un criterio que colgara de él **nunca
 * podría registrarse PASS** en el bloque de evidencia. Sus comprobaciones además
 * salían indentadas, y `evidencia.mjs` solo lee veredictos al ras del margen: en
 * `STATE.md`, «la métrica dejó de ser la que la spec declara» y «todavía no hay
 * datos» eran **la misma fila**.
 *
 * Acá es estático, no toca la base, y su veredicto es distinguible.
 *
 * El fundamento de qué comprueba y por qué de esa forma está en
 * `scripts/lib/metrica.mjs`.
 *
 * Uso:  npm run verificar:metrica
 */

import postgres from "postgres";

import { comprobarMetrica, ejercitarMetrica } from "./lib/metrica.mjs";

const resultados = comprobarMetrica();

// --- Y la comprobación que ninguna forma sintáctica evade --------------------
//
// Las de arriba son estáticas: buscan una resta entre columnas de tiempo. Eso es
// enumeración de UNA forma, y hay al menos cuatro que la esquivan
// —`EXTRACT(…) - EXTRACT(…)`, `age()`, un cast entremedio, o restar en JS—.
// Acá se le pregunta a la consulta real, con una fila cuya duración de tecleo se
// conoce y cuya permanencia es deliberadamente otro número.
const url = process.env.DATABASE_URL;
if (!url) {
  resultados.push({
    corrido: false,
    nombre: "la consulta real publica la duración del tecleo",
    ok: false,
    detalle: "falta DATABASE_URL: NO CORRIDO no es PASS, así que esto es FAIL",
  });
} else {
  const sql = postgres(url, { max: 1 });
  try {
    const r = await ejercitarMetrica(sql);
    resultados.push(
      r.corrido
        ? {
            nombre: "la consulta real publica la duración del tecleo, y no otra de las seis",
            ok: r.ok,
            // Cuando no coincide se nombra **qué par publicó**. Un FAIL que dice
            // «midió salida_at − tecleo_inicio_at» ahorra la investigación entera;
            // uno que solo dice «esperaba 7, dio 900» la empieza de cero.
            detalle:
              `sonda de 4 instantes, 6 pares distintos · esperado ${r.esperado}s ` +
              `(${Object.entries(r.pares).map(([k, v]) => `${k}=${v}`).join(", ")}) ` +
              `→ publicó ${r.medido}s` +
              (r.ok ? "" : ` ≡ ${r.identificado ?? "ningún par conocido"}`),
          }
        : { nombre: "la consulta real publica la duración del tecleo", ok: false, detalle: r.motivo },
    );
  } finally {
    await sql.end();
  }
}
for (const r of resultados) {
  console.log(`${r.ok ? "PASS" : "FAIL"} · ${r.nombre}${r.detalle ? ` · ${r.detalle}` : ""}`);
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);

if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  console.log("\nLa métrica del código dejó de ser la que `spec.md` §6 declara.");
  console.log("Cualquier número que verificar:h1 publique responde otra pregunta que la");
  console.log("que la fuente de verdad hace, y nadie lo notaría leyendo la salida.");
  process.exit(1);
}

// **El veredicto NO se emite a nombre de AC-H1-2, y eso es el resultado de tres
// ciclos de auditoría en VETO (LEDGER 2026-08-17).**
//
// AC-H1-2 dice «TODA expresión con que verificar:h1 calcula la duración». Este
// comando no verifica eso: verifica la mediana por su forma exacta más un punto
// de la consulta real. `mín`, `máx`, el estadístico y cualquier transformación
// monótona quedan afuera — los tres huecos están reproducidos en el ledger, y el
// peor publicó 10 s sobre un tecleo real de 40 s con las 4 comprobaciones en
// verde. Firmar `AC-H1-2: PASS` desde acá sería publicar como probado lo que se
// demostró que no lo está, que es el defecto que este repo persigue desde
// AC-SCOPE-1.
console.log("\nNO cubre: mín, máx, el estadístico, ni transformaciones monótonas.");
console.log("AC-H1-2 sigue SIN VERIFICAR (spec.md §9, LEDGER 2026-08-17).");
console.log("\nCOMPROBACIONES DE METRICA: PASS");
