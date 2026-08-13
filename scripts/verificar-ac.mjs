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
  .filter((l) => /^\|\s*AC-[A-Z]+-\w+/.test(l))
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
    return { id: celdas[0], criterio: celdas[1] ?? "", verificacion: celdas[2] ?? "" };
  });

comprobar("§9 declara criterios de aceptación", filas.length > 0, `${filas.length} AC`);

// Los IDs no se repiten: dos filas con el mismo ID hacen que una gane en silencio.
const repetidos = filas.map((f) => f.id).filter((id, i, todos) => todos.indexOf(id) !== i);
comprobar("ningún AC tiene el ID repetido", repetidos.length === 0, [...new Set(repetidos)].join(", "));

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

/**
 * **Informativo a propósito, no un FAIL.**
 *
 * Un verificador sin AC es un huérfano: verifica algo real y ningún criterio
 * escrito lo exige, así que un refactor podría borrarlo sin violar nada. Es
 * información valiosa.
 *
 * Pero hacerlo fallar empujaría a **especificar retroactivamente** todo lo que
 * tiene verificador —el endurecimiento entero, la capa de presentación— y eso es
 * autorar requisitos nuevos, no formalizar. La frontera que este proyecto
 * adoptó: *¿el AC hace exigible una afirmación que ya está en §1-§8, o introduce
 * una afirmación nueva?* Un guard no puede decidir eso; una persona sí.
 *
 * Así que se reporta y no se bloquea. Que la lista exista es el punto.
 */
if (huerfanos.length > 0) {
  console.log(
    `INFO · ${huerfanos.length} verificador(es) sin AC en §9, decisión pendiente de especificar-o-soltar: ${huerfanos.join(", ")}`,
  );
} else {
  console.log(`INFO · los ${verificadores.length} verificadores de producto están citados por algún AC`);
}

// --- Cierre -------------------------------------------------------------------

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("AC EJECUTABLES: PASS");
