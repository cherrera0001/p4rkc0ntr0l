/**
 * Gate de alcance (ADR-001, enmendado por ADR-004) — AC-SCOPE-1, 2 y 3.
 *
 * **Por qué es un script y no un `grep` en una tabla.** La versión anterior de
 * estos criterios vivía como expresión regular dentro de una celda de tabla
 * markdown, y eso los rompía de dos maneras a la vez:
 *
 *   1. En una tabla markdown el pipe va escapado (`\|`). Copiado tal cual a
 *      PowerShell, `\|` en regex .NET es **un pipe literal**, no alternancia:
 *      el patrón busca la cadena `stripe|mercadopago|…` completa y **nunca
 *      matchea**. Medido: `Select-String "next\|react"` → 0 líneas;
 *      `"next|react"` → 9. Un criterio que reporta PASS incondicionalmente es
 *      peor que no tener criterio.
 *   2. La propuesta que lo reemplazaba enumeraba cuatro archivos. Cualquier ruta
 *      nueva —`src/app/api/cobro/route.ts`— la evadía por construcción.
 *
 * Acá el escaneo es **por exclusión, no por enumeración**: se mira toda la
 * superficie del producto y se exceptúa explícitamente la frontera declarada de
 * suscripción. Agregar un archivo no crea un agujero; agregarlo dentro de la
 * frontera es una decisión visible en el diff.
 *
 * **La línea que este gate defiende**, y que ADR-004 NO movió:
 *
 *   - cobro de **suscripción** (dueño → C4A): permitido, acotado a
 *     `src/lib/suscripcion/`;
 *   - cobro del **estacionamiento** (conductor → local): **prohibido**. Sigue
 *     siendo en efectivo, fuera del sistema.
 *
 * Probado con el fallo plantado, no contra un árbol limpio: ver
 * `scripts/verificar-alcance.prueba.mjs`. Un gate que solo se probó en el caso
 * que ya pasa no se probó.
 *
 * Uso:  node scripts/verificar-alcance.mjs [raíz]
 *       npm run verificar:alcance
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));

/** Frontera declarada de la suscripción (ADR-004). Lo único exceptuado. */
const FRONTERA_SUSCRIPCION = "src/lib/suscripcion";

/**
 * Marcas de pasarela. Se listan las seis del mercado local más las globales que
 * ya aparecían en ADR-001. `\b…\b` importa: sin los límites, `flow` matchea
 * dentro de `overflow-hidden` y el gate se vuelve ruido.
 */
const PASARELAS = /\b(stripe|mercadopago|mercado[_-]?pago|webpay|transbank|flow|khipu)\b/i;

/** Entidades que el modelo no puede tener (AC-SCOPE-2). */
const ENTIDADES_PROHIBIDAS = /\b(pago|pagos|transaccion|transacciones|sucursal|sucursales|reserva|reservas)\b/i;

/** Captura de imagen y lectura de patente (AC-SCOPE-3). */
const LPR = /\b(getUserMedia|MediaDevices|ImageCapture|tesseract|\bLPR\b|\bOCR\b)\b/;

const EXTENSIONES = [".ts", ".tsx", ".js", ".mjs", ".css", ".json", ".sql"];

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

/** Archivos de un árbol, con su ruta relativa a la raíz, en POSIX. */
function archivos(...raices) {
  const salida = [];
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir)) {
      if (entrada === "node_modules" || entrada.startsWith(".")) continue;
      const ruta = join(dir, entrada);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (EXTENSIONES.includes(ruta.slice(ruta.lastIndexOf("."))))
        salida.push(relative(RAIZ, ruta).replace(/\\/g, "/"));
    }
  };
  for (const r of raices) {
    const abs = join(RAIZ, r);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isFile()) salida.push(r);
    else recorrer(abs);
  }
  return salida;
}

/**
 * Busca un patrón, ignorando comentarios.
 *
 * Los comentarios de este repo **nombran** lo prohibido a propósito: explican
 * por qué el cobro es en efectivo y qué queda fuera. Un gate que los cuente
 * obliga a dejar de documentar la razón, que es peor que el riesgo que evita.
 */
function coincidencias(rutas, patron) {
  const hallazgos = [];
  for (const ruta of rutas) {
    const crudo = readFileSync(join(RAIZ, ruta), "utf8").replace(/^﻿/, "");
    const codigo = crudo
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*(\/\/|\*|#|--).*$/gm, "");
    codigo.split("\n").forEach((linea, i) => {
      if (patron.test(linea)) hallazgos.push(`${ruta}:${i + 1}: ${linea.trim().slice(0, 60)}`);
    });
  }
  return hallazgos;
}

const enFrontera = (ruta) => ruta.startsWith(`${FRONTERA_SUSCRIPCION}/`);

// --- Superficie del producto --------------------------------------------------

const superficie = archivos("src", "public", "package.json");
comprobar("hay superficie de producto que escanear", superficie.length > 0, `${superficie.length} archivos`);

/**
 * `package.json` se excluye de 1a y tiene sus propias comprobaciones (1b/1c).
 *
 * No es una concesión: una dependencia de pasarela de suscripción **tiene que**
 * estar declarada en el manifiesto — es lo que significa adoptarla. Contarla
 * como "pasarela suelta" habría bloqueado el camino que ADR-004 aprueba.
 *
 * Lo encontró la prueba con el fallo plantado, no la revisión: contra el repo
 * limpio este gate daba 7/7.
 */
const fueraDeFrontera = superficie.filter((r) => !enFrontera(r) && r !== "package.json");
const dentroDeFrontera = superficie.filter(enFrontera);

// --- AC-SCOPE-1a · el conductor no paga dentro del sistema ---------------------

const pasarelaSuelta = coincidencias(fueraDeFrontera, PASARELAS);
comprobar(
  "AC-SCOPE-1a · ninguna pasarela fuera de la frontera de suscripción",
  pasarelaSuelta.length === 0,
  pasarelaSuelta.length
    ? `${pasarelaSuelta.length} · ${pasarelaSuelta.slice(0, 3).join(" | ")}`
    : `${fueraDeFrontera.length} archivos limpios${dentroDeFrontera.length ? ` · ${dentroDeFrontera.length} en la frontera` : ""}`,
);

// El flujo del estacionamiento tampoco puede IMPORTAR desde la frontera: la
// suscripción la paga el dueño desde su panel, nunca el conductor desde la vía.
const importaSuscripcion = coincidencias(
  fueraDeFrontera.filter((r) => r.startsWith("src/app/api/sesiones") || r === "src/app/pantalla-operador.tsx"),
  new RegExp(`from ["'].*${FRONTERA_SUSCRIPCION.replace("src/", "@/").replace(/\//g, "\\/")}`),
);
comprobar(
  "AC-SCOPE-1a · el flujo del estacionamiento no importa la frontera de suscripción",
  importaSuscripcion.length === 0,
  importaSuscripcion.join(" | "),
);

// --- AC-SCOPE-1b · el manifiesto ----------------------------------------------
// Mientras no exista la frontera, cero dependencias de pasarela. Cuando exista,
// la dependencia es legítima pero SIGUE vigilada: nunca deja de mirarse.

const paqueteCrudo = readFileSync(join(RAIZ, "package.json"), "utf8").replace(/^﻿/, "");
const paquete = JSON.parse(paqueteCrudo);
const deps = { ...(paquete.dependencies ?? {}), ...(paquete.devDependencies ?? {}) };
const depsPasarela = Object.keys(deps).filter((d) => PASARELAS.test(d));
const fronteraExiste = existsSync(join(RAIZ, FRONTERA_SUSCRIPCION));

comprobar(
  fronteraExiste
    ? "AC-SCOPE-1b · las dependencias de pasarela son las de suscripción declaradas"
    : "AC-SCOPE-1b · sin frontera de suscripción, cero dependencias de pasarela",
  fronteraExiste ? true : depsPasarela.length === 0,
  depsPasarela.length ? `declara: ${depsPasarela.join(", ")}` : "ninguna",
);

// Y al revés: una dependencia de pasarela sin frontera que la contenga es una
// pasarela suelta, aunque todavía no se importe en ningún lado.
comprobar(
  "AC-SCOPE-1c · toda dependencia de pasarela tiene su frontera declarada",
  depsPasarela.length === 0 || fronteraExiste,
  depsPasarela.length && !fronteraExiste
    ? `${depsPasarela.join(", ")} sin ${FRONTERA_SUSCRIPCION}/ · ADR-004 exige la frontera`
    : "",
);

// --- AC-SCOPE-2 · el esquema no define entidades prohibidas -------------------

const entidades = coincidencias(archivos("src/db"), ENTIDADES_PROHIBIDAS);
comprobar(
  "AC-SCOPE-2 · el esquema no define Pago/Transaccion/Sucursal/Reserva",
  entidades.length === 0,
  entidades.slice(0, 3).join(" | "),
);

// --- AC-SCOPE-3 · sin LPR ni captura de imagen --------------------------------

const lpr = coincidencias(superficie, LPR);
comprobar(
  "AC-SCOPE-3 · no existe módulo de LPR ni captura de imagen",
  lpr.length === 0,
  lpr.slice(0, 3).join(" | "),
);

// --- Cierre -------------------------------------------------------------------

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("ALCANCE: PASS");
