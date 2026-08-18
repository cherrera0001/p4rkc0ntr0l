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
 * **Quién puede importar la frontera. Enumerado a propósito, y al revés.**
 *
 * Un veto reprodujo el bypass que hace falta cerrar: exceptuar la frontera
 * entera de la búsqueda de pasarelas, y además comprobar la importación solo en
 * dos archivos enumerados, dejaba dos caminos abiertos:
 *
 *   1. `src/app/api/cobro-salida/route.ts` —ruta nueva, nombre neutro— importa
 *      la frontera y le cobra al conductor. **7/7 PASS.**
 *   2. `src/lib/suscripcion/cobro-conductor.ts` con Stripe: el cobro del
 *      conductor **dentro** de la frontera. También PASS, porque nada decía qué
 *      puede vivir adentro.
 *
 * La corrección invierte la enumeración: se enumera **lo permitido**, que es
 * chico y está respaldado por un ADR, y **todo lo demás se escanea por
 * exclusión**. Agregar una ruta nueva no abre nada; agregarla a esta lista es
 * una línea en el diff que alguien tiene que justificar.
 *
 * Hoy está **vacía**: no existe ninguna pantalla de suscripción. La suscripción
 * la paga el dueño desde su panel, nunca el conductor desde la vía.
 */
const SUPERFICIE_SUSCRIPCION = [];

/**
 * El dominio del estacionamiento. Si la frontera de suscripción importa esto,
 * está cobrando por estacionar — que es justo lo que ADR-004 **no** movió.
 */
const DOMINIO_ESTACIONAMIENTO = /from\s+["'][^"']*(tarificacion|sesion-?vehiculo|\/db)["']|sesionVehiculo|sesion_vehiculo/;

/**
 * Marcas de pasarela. Se listan las seis del mercado local más las globales que
 * ya aparecían en ADR-001. `\b…\b` importa: sin los límites, `flow` matchea
 * dentro de `overflow-hidden` y el gate se vuelve ruido.
 */
const PASARELAS =
  /\b(stripe|mercadopago|mercado[_-]?pago|webpay|transbank|flow|khipu|paypal|braintree|adyen|payku|kushki|dlocal|getnet|redelcom)\b/i;

/**
 * Entidades que el modelo no puede tener (AC-SCOPE-2).
 *
 * `_` es carácter de palabra, así que `\bpago\b` **no** matchea
 * `pagos_estacionamiento`. Se agregan límites que traten al guion bajo como
 * separador: medido, una tabla con ese nombre pasaba el gate.
 */
const ENTIDADES_PROHIBIDAS =
  /(^|[^A-Za-z0-9])(pago|pagos|transaccion|transacciones|sucursal|sucursales|reserva|reservas)([^A-Za-z0-9]|$)/i;

/** Captura de imagen y lectura de patente (AC-SCOPE-3). */
const LPR = /\b(getUserMedia|MediaDevices|ImageCapture|tesseract|\bLPR\b|\bOCR\b)\b/;

/**
 * ADR-001 prohíbe además el **selector de sucursal** en la interfaz, no solo la
 * entidad en el esquema. Un `src/app/selector-sucursal.tsx` pasaba con un PASS
 * explícito, que es peor que no mirarlo.
 */
const MULTISITIO_UI = /(selector|conmutador|switcher)[-_]?(de[-_]?)?(sucursal|sitio|empresa|tenant)/i;

// `.jsx`, `.cjs` y `.mts` son extensiones de primera clase del App Router y
// faltaban: medido, `src/app/cobro.jsx` con `import Stripe` daba 7/7 PASS.
const EXTENSIONES = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".css", ".json", ".sql"];

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

// **Nadie importa la frontera salvo la superficie declarada.** Se escanea TODO
// lo que está fuera de ella, no una lista de archivos: enumerar el flujo del
// estacionamiento dejaba pasar cualquier ruta nueva de nombre neutro.
const IMPORTA_FRONTERA = new RegExp(
  `from\\s+["'][^"']*(@/lib/suscripcion|${FRONTERA_SUSCRIPCION})`,
);
const importadores = coincidencias(
  fueraDeFrontera.filter((r) => !SUPERFICIE_SUSCRIPCION.includes(r)),
  IMPORTA_FRONTERA,
);
comprobar(
  "AC-SCOPE-1a · solo la superficie de suscripción declarada importa la frontera",
  importadores.length === 0,
  importadores.length
    ? `${importadores.length} · ${importadores.slice(0, 3).join(" | ")} · agregalo a SUPERFICIE_SUSCRIPCION si es legítimo`
    : SUPERFICIE_SUSCRIPCION.length
      ? `superficie declarada: ${SUPERFICIE_SUSCRIPCION.join(", ")}`
      : "superficie declarada vacía: nadie debe importarla todavía",
);

// Y al revés: la frontera no puede tocar el dominio del estacionamiento. Si
// importa la tarifa o la sesión del vehículo, está cobrando por estacionar —
// que es exactamente la línea que ADR-004 NO movió.
const fronteraTocaEstacionamiento = coincidencias(dentroDeFrontera, DOMINIO_ESTACIONAMIENTO);
comprobar(
  "AC-SCOPE-1a · la frontera de suscripción no toca el dominio del estacionamiento",
  fronteraTocaEstacionamiento.length === 0,
  fronteraTocaEstacionamiento.length
    ? `${fronteraTocaEstacionamiento.slice(0, 3).join(" | ")} · eso es cobrarle al conductor`
    : dentroDeFrontera.length
      ? `${dentroDeFrontera.length} archivos en la frontera, ninguno toca el estacionamiento`
      : "la frontera no existe todavía",
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
// Se miran también las MIGRACIONES: `CREATE TABLE "pago"` en un `.sql` pasaba
// sin que nadie lo viera, y AC-DATA-2 en esta misma spec eleva la migración a
// superficie verificable. Sería incoherente mirarla para una cosa y no la otra.

const entidades = coincidencias([...archivos("src/db"), ...archivos("drizzle")], ENTIDADES_PROHIBIDAS);
comprobar(
  "AC-SCOPE-2 · ni el esquema ni las migraciones definen Pago/Transaccion/Sucursal/Reserva",
  entidades.length === 0,
  entidades.slice(0, 3).join(" | "),
);

// ADR-001 prohíbe el selector de sucursal en la interfaz, no solo la entidad.
// Se mira el CONTENIDO y también el NOMBRE DEL ARCHIVO: `selector-sucursal.tsx`
// puede tener un cuerpo perfectamente neutro y ser exactamente lo prohibido.
// Medido: escaneando solo contenido, ese archivo pasaba.
const selector = [
  ...coincidencias(superficie, MULTISITIO_UI),
  ...superficie.filter((r) => MULTISITIO_UI.test(r)).map((r) => `${r} (nombre de archivo)`),
];
comprobar(
  "AC-SCOPE-2 · no hay selector de sucursal ni conmutador de empresa en la interfaz",
  selector.length === 0,
  selector.slice(0, 3).join(" | "),
);


// --- AC-SCOPE-4 · multisitio sigue fuera, y ahora lo hace cumplir un comando ---
//
// **Este bloque cierra el hueco que ADR-005 §2.5 documento y reprodujo:** el gate
// daba 9/9 PASS con la entidad `tenant`, el rol `plataforma` y una pantalla de
// alta plantadas. Lo que sostenia la exclusion era la prosa de ADR-004 y la
// revision humana, no un comando.
//
// **La distincion que hay que hacer cumplir, y es toda la razon de ser de esto:**
//
//   | multicliente | N clientes, UN recinto cada uno | PERMITIDO (ADR-005, alt. 2) |
//   | multisitio   | UN cliente, VARIOS recintos     | PROHIBIDO (ADR-001, ADR-004)|
//
// Lo prohibido no es tener varias filas en `estacionamiento`: eso es multicliente
// y esta habilitado. Lo prohibido es una **jerarquia por encima** de
// `estacionamiento` que agrupe varios bajo un mismo dueno. Por eso el patron
// busca la entidad agrupadora y su llave foranea, no la cantidad de clientes.
//
// El rol `plataforma` NO se rechaza: es parte de la alternativa aceptada.
const JERARQUIA_SOBRE_ESTACIONAMIENTO =
  /(^|[^A-Za-z0-9])(tenant|tenants|tenant_?id|empresa|empresas|empresa_?id|organizacion|organizaciones|organizacion_?id|casa_?matriz|cuenta_?maestra|sucursal_?id)([^A-Za-z0-9]|$)/i;

const jerarquia = coincidencias(
  [...archivos("src/db"), ...archivos("drizzle")],
  JERARQUIA_SOBRE_ESTACIONAMIENTO,
);
comprobar(
  "AC-SCOPE-4 · el modelo no tiene ninguna entidad por encima de estacionamiento",
  jerarquia.length === 0,
  jerarquia.length
    ? `${jerarquia.length} hallazgo(s): ${jerarquia.slice(0, 3).join(" | ")}`
    : "multicliente si, multisitio no: estacionamiento sigue siendo la raiz",
);

// Piso: si el escaner deja de ver el esquema, lo de arriba pasa sobre la nada.
comprobar(
  "AC-SCOPE-4 · el escaner ve el esquema y las migraciones",
  [...archivos("src/db"), ...archivos("drizzle")].length > 0,
  `${[...archivos("src/db"), ...archivos("drizzle")].length} archivo(s)`,
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
