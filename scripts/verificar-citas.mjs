/**
 * Guard de la documentación derivada: **toda cita `archivo:línea` resuelve.**
 *
 * Por qué existe. Los documentos de `docs/data/` afirman cosas sobre el código
 * citando `src/db/schema.ts:116`. Una cita que no resuelve —porque el archivo se
 * movió, porque el número quedó viejo tras un refactor, o porque se escribió de
 * memoria— convierte un documento verificable en un documento que *parece*
 * verificable. Es la misma familia que este proyecto viene persiguiendo: el
 * mecanismo que existe, se ve correcto, y no está conectado a nada.
 *
 * Qué comprueba:
 *   1. cada `archivo:línea` citado existe y el archivo tiene esa línea;
 *   2. los bloques ```mermaid están balanceados y declaran un tipo de diagrama;
 *   3. ningún documento derivado rellenó un `{{placeholder}}` con un valor.
 *
 * NO comprueba que la línea diga lo que la cita afirma: eso lo audita una
 * persona. Comprueba que la cita no sea humo, que es lo automatizable.
 *
 * Uso:  node scripts/verificar-citas.mjs [directorio]
 *       npm run verificar:citas
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Qué se barre por defecto.
 *
 * Hasta el 2026-08-16 era **solo `docs/data`**, y eso dejaba fuera del guard a los
 * documentos que más citan código: `spec.md` —la fuente de verdad—, los ADR y las
 * specs de `docs/`. Sus citas resolvían, pero **ningún comando lo sostenía**: es
 * la regla U7 aplicada al propio guard de las citas.
 *
 * Se sigue aceptando un directorio por argumento para barrer uno solo.
 */
const OBJETIVOS = process.argv[2]
  ? [process.argv[2]]
  : ["docs/data", "docs", "docs/adr", "spec.md"];

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

/** Un objetivo puede ser un directorio (no recursivo) o un archivo suelto. */
function documentos(objetivo) {
  const ruta = resolve(RAIZ, objetivo);
  if (!existsSync(ruta)) return [];
  if (statSync(ruta).isFile()) return ruta.endsWith(".md") ? [ruta] : [];
  return readdirSync(ruta)
    .map((f) => join(ruta, f))
    .filter((f) => statSync(f).isFile() && f.endsWith(".md"));
}

const docs = [...new Set(OBJETIVOS.flatMap(documentos))].sort();
comprobar(
  "hay documentos derivados que revisar",
  docs.length > 0,
  `${docs.length} en ${OBJETIVOS.join(", ")}`,
);

// Rutas del repo que una cita puede referenciar. Se exige la extensión para no
// confundir una cita con un `nombre:línea` de prosa.
const CITA = /\b((?:src|scripts|public|drizzle|docs)\/[\w./[\]-]+\.(?:ts|tsx|mjs|js|css|json|sql|md)):(\d+)/g;

for (const doc of docs) {
  const texto = readFileSync(doc, "utf8");
  const corto = doc.slice(RAIZ.length + 1).replace(/\\/g, "/");

  // --- 1. Las citas resuelven ---
  const rotas = [];
  let total = 0;
  for (const m of texto.matchAll(CITA)) {
    total++;
    const [, ruta, linea] = m;
    const absoluta = resolve(RAIZ, ruta);
    if (!existsSync(absoluta)) {
      rotas.push(`${ruta}:${linea} (no existe el archivo)`);
      continue;
    }
    const lineas = readFileSync(absoluta, "utf8").split("\n").length;
    if (Number(linea) < 1 || Number(linea) > lineas) {
      rotas.push(`${ruta}:${linea} (el archivo tiene ${lineas} líneas)`);
    }
  }
  comprobar(
    `${corto} · todas las citas archivo:línea resuelven`,
    rotas.length === 0,
    rotas.length ? `${rotas.length}/${total} rotas · ${rotas.slice(0, 3).join(" | ")}` : `${total} citas`,
  );

  // --- 2. Los bloques mermaid están balanceados y tipados ---
  const bloques = [...texto.matchAll(/```mermaid\n([\s\S]*?)```/g)];
  const aperturas = (texto.match(/```mermaid/g) ?? []).length;
  if (aperturas > 0) {
    comprobar(
      `${corto} · los bloques mermaid están cerrados`,
      bloques.length === aperturas,
      `${bloques.length} cerrados de ${aperturas} abiertos`,
    );

    const sinTipo = bloques
      .map((b, i) => [i, b[1].trim().split("\n")[0].trim()])
      .filter(([, primera]) => !/^(erDiagram|stateDiagram(-v2)?|flowchart|graph|sequenceDiagram)\b/.test(primera));
    comprobar(
      `${corto} · cada mermaid declara un tipo de diagrama`,
      sinTipo.length === 0,
      sinTipo.length ? sinTipo.map(([i, p]) => `#${i + 1}: "${p.slice(0, 40)}"`).join(" | ") : `${bloques.length} diagramas`,
    );
  }

  // --- 3. Ningún placeholder rellenado ---
  // Los placeholders se citan; lo que se prohíbe es escribir un valor donde el
  // documento afirma que hay una decisión humana pendiente.
  const inventados = [...texto.matchAll(/\{\{([A-Z_Ñ]+)\}\}\s*=\s*([^\s|]+)/g)].map((m) => `${m[1]}=${m[2]}`);
  comprobar(
    `${corto} · ningún {{placeholder}} quedó con un valor asignado`,
    inventados.length === 0,
    inventados.slice(0, 3).join(" | "),
  );
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("CITAS: PASS");
