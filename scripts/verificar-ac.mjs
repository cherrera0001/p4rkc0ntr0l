/**
 * Guard de `spec.md` §9: **todo criterio de aceptación tiene que apuntar a algo
 * que se pueda correr.**
 *
 * Por qué existe. `spec.md` §9 cierra con una lección escrita al pie:
 *
 *   > un criterio de aceptación que se ata al nombre de una herramienta externa
 *   > caduca cuando la herramienta cambia. Describir la propiedad; sugerir la
 *   > herramienta.
 *
 * La pagó AC-PWA-1: decía *"auditoría PWA (Lighthouse)"*, Lighthouse eliminó la
 * categoría PWA, y el criterio quedó **inverificable en cualquier máquina**. Se
 * detectó recién al intentar cerrar M1, tras tres intentos fallidos.
 *
 * Esa lección sigue siendo prosa. Este script la vuelve mecanismo, acotado a lo
 * que se puede decidir sin ejecutar la suite: **que la columna de Verificación
 * de cada AC mapee a un script real de `package.json`, a un archivo de
 * `scripts/` que exista, o a un comando inline ejecutable.**
 *
 * Qué NO hace, dicho para que nadie lea el PASS como más de lo que es:
 *
 *   - no corre los verificadores: eso es la suite, y tarda minutos;
 *   - no comprueba que el comando *pruebe* lo que el criterio afirma. Un
 *     `npm run verificar:pwa` colgado de AC-OP-1 pasaría este guard. Eso es
 *     revisión humana.
 *
 * Lo que sí garantiza: que ningún AC apunte a una herramienta ausente, a un
 * script inexistente, o a una frase que nadie puede ejecutar.
 *
 * El veredicto se **deriva** del parseo de `spec.md` más `package.json`. No hay
 * bandera, ni archivo de estado, ni número recordado — lección de INT-12: un
 * resultado se recalcula, no se recuerda, y recalcular sobre datos confiados no
 * es verificar.
 *
 * Uso:  node scripts/verificar-ac.mjs
 *       npm run verificar:ac
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = join(RAIZ, "spec.md");

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

if (!existsSync(SPEC)) {
  console.error("FAIL · no existe spec.md");
  process.exit(1);
}

/**
 * Lectura que tolera el BOM.
 *
 * PowerShell 5.1 antepone un BOM al escribir con `-Encoding utf8`, y
 * `JSON.parse` no lo tolera. Este proyecto ya lo pagó tres veces: el BOM en
 * `DATABASE_URL` que rompió el login en producción (M4), el que destruyó la
 * línea base de `verificar-int12`, y este. **Cuando un valor puede llegar
 * degenerado, el manejo por defecto tiene que ser tolerante al leer y ruidoso
 * al fallar.**
 */
const leer = (ruta) => readFileSync(ruta, "utf8").replace(/^﻿/, "");

const spec = leer(SPEC);

let paquete;
try {
  paquete = JSON.parse(leer(join(RAIZ, "package.json")));
} catch (e) {
  console.error(`FAIL · package.json no se pudo leer como JSON: ${e?.message ?? e}`);
  process.exit(1);
}
const scripts = paquete.scripts ?? {};

/**
 * Comandos inline que cuentan como ejecutables. Se listan a propósito en vez de
 * aceptar cualquier cosa entre backticks: la gracia del guard es distinguir un
 * comando de una frase que suena a comando.
 */
const EJECUTABLES = ["npm", "npx", "node", "grep", "Select-String", "Get-ChildItem", "git"];

// --- Parseo de la tabla de §9 -------------------------------------------------

const seccion = spec.split(/^## 9\./m)[1];
comprobar("se encontró la sección §9 de spec.md", Boolean(seccion));

const filas = (seccion ?? "")
  .split("\n")
  .map((l) => l.trim())
  // `[A-Z0-9]+` y no `[A-Z]+`: **`AC-H1-1` tiene un dígito en el medio.** Con el
  // patrón anterior su fila no matcheaba y el guard la **descartaba en silencio**
  // —§9 declaraba 14 criterios y acá se contaban 13—, así que un AC nuevo podía
  // entrar a la fuente de verdad y quedar invisible para el guard que existe para
  // vigilarla. Encontrado al cablear AC-H1-1 el 2026-08-16.
  .filter((l) => /^\|\s*AC-[A-Z0-9]+-\w+/.test(l))
  .map((l) => {
    // En una tabla markdown un pipe dentro de una celda va escapado como `\|`.
    // Partir en todo `|` rompe justo las celdas que contienen una alternancia de
    // regex — que son las de AC-SCOPE-1 y AC-SCOPE-2. Se parte solo en los
    // pipes NO escapados y después se desescapa, que es lo que ve quien lee la
    // tabla renderizada.
    const celdas = l
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((c) => c.replace(/\\\|/g, "|").trim());
    return {
      id: celdas[0],
      criterio: celdas[1] ?? "",
      verificacion: celdas[2] ?? "",
      tipo: (celdas[3] ?? "").toLowerCase().replace(/[^a-z]/g, ""),
    };
  });

comprobar("§9 declara criterios de aceptación", filas.length > 0, `${filas.length} AC`);

// Los IDs no se repiten: dos filas con el mismo ID hacen que una gane en silencio.
const repetidos = filas.map((f) => f.id).filter((id, i, todos) => todos.indexOf(id) !== i);
comprobar("ningún AC tiene el ID repetido", repetidos.length === 0, [...new Set(repetidos)].join(", "));

// --- Universal o existencial ---------------------------------------------------
//
// **Por qué esta columna existe.** `AC-MEAS-1` estuvo meses en verde sin un solo
// dato: sus dos guardas son un `count(*)` sobre un `WHERE` —vacuamente verdadero
// sobre el conjunto vacío— y una lectura de `information_schema`. *Un criterio
// universal —«todo X cumple P»— es automáticamente verdadero si no hay ningún X.*
//
// El defecto no fue de quien lo escribió: el criterio hacía exactamente lo que
// decía. Lo que faltaba era **la obligación de preguntárselo**. Nada en §9 forzaba
// a declarar si un criterio puede pasar sobre la nada, así que nadie lo notó hasta
// que FASE D fue a buscar el número de H1 y no había ninguno.
//
// La clasificación es **una declaración de quien escribe el AC**, no una medición:
// este guard comprueba que esté, no la re-deriva. Decirlo importa — afirmar que
// está medida sería el defecto que este repo persigue.
const TIPOS = new Set(["universal", "existencial"]);
const sinTipo = filas.filter((f) => !TIPOS.has(f.tipo));
comprobar(
  "cada AC declara si es universal o existencial",
  sinTipo.length === 0,
  sinTipo.length
    ? `${sinTipo.length} sin declarar: ${sinTipo.map((f) => `${f.id}="${f.tipo || "vacío"}"`).join(", ")}`
    : `${filas.filter((f) => f.tipo === "existencial").length} existencial(es) · ` +
      `${filas.filter((f) => f.tipo === "universal").length} universal(es)`,
);

// **Piso contra el contrato vacuo.** Si todos los criterios fueran universales, §9
// entero podría pasar sobre un sistema sin un solo dato — que es exactamente el
// estado en el que este proyecto estuvo hasta FASE D. Al menos uno tiene que
// exigir que algo exista.
const existenciales = filas.filter((f) => f.tipo === "existencial");
comprobar(
  "al menos un AC exige que existan datos",
  existenciales.length > 0,
  existenciales.length
    ? existenciales.map((f) => f.id).join(", ")
    : "todos universales: §9 entero pasaría sobre un sistema vacío",
);

// --- Cada AC apunta a algo ejecutable -----------------------------------------

/** Extrae lo que parece un comando de la celda de verificación. */
function comandosDe(celda) {
  // Se prefieren los que van entre backticks, que es como los escribe la spec.
  const entreBackticks = [...celda.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  if (entreBackticks.length > 0) return entreBackticks;
  return [];
}

/** ¿Este texto es algo que alguien puede ejecutar tal cual? */
function esEjecutable(comando) {
  const primera = comando.split(/\s+/)[0];
  if (!EJECUTABLES.includes(primera)) return { ok: false, motivo: `"${primera}" no es un ejecutable conocido` };

  // `npm run X` tiene que existir en package.json.
  const npmRun = comando.match(/^npm run ([\w:.-]+)/);
  if (npmRun && !(npmRun[1] in scripts)) {
    return { ok: false, motivo: `package.json no define el script "${npmRun[1]}"` };
  }

  // `node scripts/X.mjs` tiene que existir en disco.
  const nodeScript = comando.match(/^node\s+(?:--[\w=.-]+\s+)*([\w./-]+\.mjs)/);
  if (nodeScript && !existsSync(join(RAIZ, nodeScript[1]))) {
    return { ok: false, motivo: `no existe ${nodeScript[1]}` };
  }

  return { ok: true };
}

const sinComando = [];
const noEjecutables = [];

for (const fila of filas) {
  const comandos = comandosDe(fila.verificacion);
  if (comandos.length === 0) {
    sinComando.push(`${fila.id}: "${fila.verificacion.slice(0, 50)}"`);
    continue;
  }
  for (const c of comandos) {
    const veredicto = esEjecutable(c);
    if (!veredicto.ok) noEjecutables.push(`${fila.id}: ${veredicto.motivo}`);
  }
}

comprobar(
  "cada AC cita al menos un comando, no una descripción en prosa",
  sinComando.length === 0,
  sinComando.length ? `${sinComando.length}/${filas.length} sin comando · ${sinComando.join(" | ")}` : `${filas.length} AC`,
);

comprobar(
  "todo comando citado existe y se puede correr",
  noEjecutables.length === 0,
  noEjecutables.length ? noEjecutables.join(" | ") : "",
);

// --- Los verificadores del repo están alcanzados por algún AC ------------------
// El espejo del anterior: un verificador que ningún AC cita es un verificador
// que nadie va a correr cuando cierre un hito.

/**
 * Guards del repo: verifican la documentación y los propios verificadores, no
 * el producto. **No deben estar en §9 y no se cuentan como huérfanos.**
 *
 * Meter un guard de documentación en §9 convertiría documentos derivados en
 * criterio de aceptación permanente de la v1 — el subproducto ascendiendo al
 * contrato que estaba auditando. Queda dicho acá para que la exclusión sea una
 * decisión visible y no un olvido.
 */
const META_GUARDS = new Set([
  "verificar:citas",
  "verificar:verificadores",
  "verificar:ac",
  // La prueba del gate de alcance no es un verificador de producto: es lo que
  // demuestra que `verificar:alcance` funciona. Sin esta línea aparecía en la
  // lista de huérfanos, y un refactor podía borrarla sin violar nada — llevándose
  // la única evidencia de que el gate no es decorativo.
  "verificar:alcance:prueba",
  // Vigila que las definiciones de agente no diverjan entre harnesses. Es del
  // mismo género: verifica el andamio del repo, no el producto.
  "verificar:agentes",
]);

/**
 * Verificadores **soltados a propósito**: verifican algo real y ningún AC los
 * exige, y eso es una decisión tomada, no un olvido.
 *
 * ## Por qué existe este mapa
 *
 * Hasta el 2026-08-16 los huérfanos se reportaban como `INFO` con la leyenda
 * *«decisión pendiente de especificar-o-soltar»*. El argumento para no fallar era
 * bueno y se conserva entero: **forzar el FAIL empujaría a especificar
 * retroactivamente todo lo que tiene verificador, y eso es autorar requisitos, no
 * formalizar.** Un guard no puede decidir esa frontera; una persona sí.
 *
 * Pero «pendiente» sin fecha ni gate es una decisión que no se toma, y el contador
 * puede crecer en silencio: **subió de 5 a 6 el 2026-08-16 cuando se agregó
 * `verificar:agentes`, y nada falló.**
 *
 * La regla que cierra la fuga sin romper el argumento: **nadie está obligado a
 * subir un verificador a §9; todos están obligados a declararlo.** Un huérfano
 * declarado acá, con su motivo y dónde vive la decisión, es legítimo. Un huérfano
 * **no declarado** es FAIL.
 *
 * Los motivos de abajo **no se inventaron acá**: ya estaban escritos en el repo.
 * Esto los vuelve exigibles.
 */
const SOLTADOS = new Map([
  [
    "verificar:endurecimiento",
    "spec.md §9, nota de FASE C (2026-08-14): verifica propiedades que §1–§8 nunca enunció. Si se quiere exigible, va por ADR",
  ],
  [
    "verificar:m4",
    "spec.md §9, nota de FASE C (2026-08-14): la purga del dispositivo nace de la revisión de seguridad, posterior a la spec",
  ],
  [
    "verificar:ui",
    "spec.md §9, nota de FASE C (2026-08-14): la capa de presentación nace de la traducción de diseño, posterior a la spec",
  ],
  [
    "verificar:int12",
    "spec.md §9, nota de FASE C (2026-08-14) + LEDGER 2026-08-14: además su gate está registrado FAIL como riesgo aceptado",
  ],
  [
    "verificar:reportes",
    "spec.md §9, misma nota de FASE C que verificar:ui: los reportes nacen de la maqueta 1g (docs/diseno-2026-08-12-traduccion.md:47), posterior a la spec. §6 enuncia ocupación e ingresos observados, pero no la vista por período: subir un AC nuevo sería autorar requisitos, y eso va por ADR",
  ],
  [
    "verificar:tarifas",
    "spec.md §9, misma nota de FASE C que verificar:ui: la carga de tarifas nace de la maqueta 1e (docs/diseno-2026-08-12-traduccion.md:45), posterior a la spec. §4 dice que los tres valores los carga el dueño, pero §1–§8 nunca enunció la pantalla ni la ruta: subir un AC nuevo sería autorar requisitos, y eso va por ADR",
  ],
  [
    "verificar:temporizador",
    "docs/data/matriz-trazabilidad.md:96 (2026-08-14): AC-OP-3 no se escribe hasta que el comando sostenga lo que el criterio afirmaría; el verificador está VETADO",
  ],
]);

const verificadores = Object.keys(scripts)
  .filter((s) => s.startsWith("verificar:"))
  .filter((s) => !META_GUARDS.has(s));
const citados = new Set();
for (const fila of filas) {
  for (const c of comandosDe(fila.verificacion)) {
    const m = c.match(/^npm run ([\w:.-]+)/);
    if (m) citados.add(m[1]);
    const n = c.match(/scripts\/([\w-]+)\.mjs/);
    if (n) {
      const equivalente = verificadores.find((v) => scripts[v].includes(`${n[1]}.mjs`));
      if (equivalente) citados.add(equivalente);
    }
  }
}

const huerfanos = verificadores.filter((v) => !citados.has(v));

// **Un huérfano no declarado es FAIL.** Ver el fundamento en `SOLTADOS`: nadie
// está obligado a subir un verificador a §9, todos están obligados a declararlo.
const noDeclarados = huerfanos.filter((v) => !SOLTADOS.has(v));
comprobar(
  "todo verificador está en §9 o declarado como soltado",
  noDeclarados.length === 0,
  noDeclarados.length
    ? `sin declarar: ${noDeclarados.join(", ")} → o lo cita un AC, o entra a SOLTADOS con su motivo`
    : `${citados.size} citado(s) por un AC · ${huerfanos.length} soltado(s) con motivo escrito`,
);

// El espejo: una declaración que sobra también es ruido. Si un verificador soltado
// vuelve a §9 y nadie saca su línea de acá, el mapa deja de describir el territorio.
const soltadosDeMas = [...SOLTADOS.keys()].filter((v) => !huerfanos.includes(v));
comprobar(
  "ningún soltado sobra en la lista",
  soltadosDeMas.length === 0,
  soltadosDeMas.length
    ? `ya no son huérfanos y siguen declarados: ${soltadosDeMas.join(", ")}`
    : "la lista de soltados coincide con los huérfanos reales",
);

for (const v of huerfanos) {
  console.log(`INFO · soltado a propósito · ${v} · ${SOLTADOS.get(v)}`);
}

// --- Cierre -------------------------------------------------------------------

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("AC EJECUTABLES: PASS");
