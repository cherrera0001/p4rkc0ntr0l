/**
 * Guard sobre los propios verificadores. Estático, sin red y sin base.
 *
 * Origen (LEDGER 2026-08-12): `verificar-endurecimiento.mjs` abortó contra
 * producción con `SyntaxError: Unexpected end of JSON input` al recibir un 500
 * con cuerpo vacío. Murió en la comprobación 15 de 30 y reportó "10 FAIL"
 * cuando el número real era 19. El error del verificador se leyó, durante dos
 * días, como si producción estuviera menos rota de lo que estaba.
 *
 * La lección generalizable: **un verificador que se muere miente hacia el lado
 * optimista.** Lo que no alcanzó a correr no aparece como FAIL, aparece como
 * nada. Por eso este check existe en vez de una nota en LEARNINGS.md.
 *
 * Qué exige:
 *
 *   1. Ningún verificador llama `.json()` directo sobre una respuesta HTTP.
 *      Se usa `leerJson()` de `scripts/lib/respuesta.mjs`, que ante un cuerpo
 *      ilegible devuelve evidencia en vez de lanzar.
 *   2. Todo verificador termina imprimiendo su recuento de comprobaciones.
 *      Un script que puede salir sin resumen puede salir sin que se note.
 *
 * Uso:  node scripts/verificar-verificadores.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));

// Los que comprueban propiedades de la app corriendo. Los de operación
// (sembrar, limpiar, rotar) no reportan comprobaciones y no aplican.
const VERIFICADORES = readdirSync(DIR)
  .filter((f) => f.startsWith("verificar-") && f.endsWith(".mjs"))
  .filter((f) => f !== "verificar-verificadores.mjs");

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

comprobar("hay verificadores que revisar", VERIFICADORES.length > 0, `${VERIFICADORES.length} archivo(s)`);

for (const archivo of VERIFICADORES) {
  const texto = readFileSync(join(DIR, archivo), "utf8");

  // Los comentarios se ignoran en las dos comprobaciones: describen el defecto,
  // no lo cometen. Los template literals solo se borran para la primera —el
  // veredicto final de la segunda vive justamente dentro de uno.
  const sinComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const codigo = sinComentarios.replace(/`[^`]*`/g, "``");

  const crudas = [...codigo.matchAll(/\b(?:await\s+)?[\w.)\]]+\.json\(\)/g)].map((m) => m[0].trim());

  comprobar(
    `${archivo} · no llama .json() crudo sobre una respuesta`,
    crudas.length === 0,
    crudas.length ? `${crudas.length}: ${crudas.slice(0, 3).join(" | ")} → usar leerJson()` : "",
  );

  // El veredicto puede ser un recuento ("N/M comprobaciones PASS") o una
  // sentencia de criterio ("AC-MEAS-1: PASS"). Lo que no se acepta es un script
  // que pueda terminar sin decir nada.
  const veredicto = /comprobaciones PASS|:\s*\$\{?.*PASS|: PASS/.test(sinComentarios);
  comprobar(
    `${archivo} · imprime un veredicto final`,
    veredicto,
    veredicto ? "" : "un script sin veredicto puede morir sin que se note",
  );
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("VERIFICADORES: PASS");
