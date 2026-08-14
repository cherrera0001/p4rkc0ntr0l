/**
 * Generador del bloque de evidencia. **El bloque se genera; no se teclea.**
 *
 * Por qué existe. `docs/data/matriz-trazabilidad.md` §0 se titula *"medida, no
 * afirmada"* y pega la salida de la suite. Se tecleó a mano, y por eso ya se
 * desfasó dos veces:
 *
 *   - `verificar:citas 15/15` cuando el comando daba 17/17 — corregido a mano
 *     dentro del propio documento, con la nota de que *"un conteo deriva y
 *     crece"*;
 *   - `verificar:esquema 4/4` cuando hoy da 8/8, porque `b933ccb` lo hizo
 *     comparar los 27 campos en vez de contar tablas. Ese quedó sin corregir.
 *
 * El proyecto ya sacó la lección correcta —los AC citan el comando, no el
 * número— pero los bloques de evidencia siguieron teniendo números escritos a
 * mano. **La lección que no se vuelve mecanismo se repite**, y ésta se repitió.
 *
 * Tres propiedades, y las tres existen por un defecto ya pagado:
 *
 *   1. **Lo que no se corrió dice `NO CORRIDO`, no desaparece.** Un bloque que
 *      omite lo que no corrió se lee como si todo hubiera pasado. Es la misma
 *      forma del defecto de `verificar-endurecimiento` muriendo en la
 *      comprobación 15 de 30: *un verificador que se muere miente hacia el lado
 *      optimista*, y un informe que calla, también.
 *   2. **Un comando sin línea de recuento se reporta `SIN VEREDICTO`**, con su
 *      exit code. No se infiere PASS de un exit 0: si el script murió antes de
 *      resumir, lo que hay es ausencia de evidencia, no evidencia de ausencia.
 *   3. **Se estampa el commit y si el árbol estaba sucio.** Una evidencia
 *      tomada sobre cambios sin commitear no describe ningún estado
 *      reproducible, y tiene que decirlo ella misma.
 *
 * Qué NO hace, para que el PASS no se lea como más de lo que es: no juzga si el
 * comando prueba lo que su AC afirma (eso es `verificar:ac` y revisión humana),
 * y no interpreta veredictos — copia el que imprimió cada script. La columna
 * *Nota* es texto humano declarado en la tabla de abajo, y existe para un caso
 * concreto: `verificar:int12` imprime `PASS` y su gate está **registrado como
 * FAIL**. Un bloque que mostrara ese PASS pelado repetiría la trampa exacta que
 * el ledger documentó.
 *
 * Uso:  node scripts/evidencia.mjs                 # estático + base
 *       node scripts/evidencia.mjs --todos         # incluye build y navegador
 *       node scripts/evidencia.mjs --grupo=estatico
 *       node scripts/evidencia.mjs --actualizar    # reescribe los bloques marcados
 *       node scripts/evidencia.mjs --url=https://…  # pasa la URL a los de navegador
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * El catálogo completo de la base de evidencia. **Enumerar acá es la única
 * forma de que un comando pueda faltar visiblemente**: lo que no está en esta
 * tabla no puede reportarse como NO CORRIDO, simplemente no existe para el
 * bloque. Agregar un verificador nuevo exige agregarlo acá.
 *
 * `grupo` describe qué necesita para correr, no qué tan importante es:
 *   estatico   — nada externo
 *   base       — DATABASE_URL
 *   build      — lento, sin dependencias externas
 *   servidor   — la app levantada
 *   navegador  — la app levantada y un Edge/Chrome
 */
const CATALOGO = [
  { script: "test", grupo: "estatico" },
  { script: "verificar:alcance", grupo: "estatico" },
  { script: "verificar:alcance:prueba", grupo: "estatico" },
  { script: "verificar:ac", grupo: "estatico" },
  { script: "verificar:citas", grupo: "estatico" },
  { script: "verificar:verificadores", grupo: "estatico" },
  { script: "verificar:esquema", grupo: "base" },
  { script: "verificar:invariantes", grupo: "base" },
  { script: "verificar:meas1", grupo: "base" },
  { script: "build", grupo: "build" },
  { script: "verificar:salida", grupo: "servidor", url: true },
  { script: "verificar:pwa", grupo: "navegador", url: true },
  { script: "verificar:op1", grupo: "navegador", url: true },
  { script: "verificar:a3", grupo: "navegador", url: true },
  { script: "verificar:m4", grupo: "navegador", url: true },
  { script: "verificar:meas2", grupo: "navegador", url: true },
  { script: "verificar:endurecimiento", grupo: "navegador", url: true },
  { script: "verificar:ui", grupo: "navegador", url: true },
  {
    script: "verificar:int12",
    grupo: "navegador",
    url: true,
    nota: "gate registrado **FAIL** (LEDGER 2026-08-13). Su PASS no es evidencia: el historial se puede forjar y borrar",
  },
];

const GRUPOS_POR_DEFECTO = ["estatico", "base"];

// --- Argumentos ---------------------------------------------------------------

const args = process.argv.slice(2);
const bandera = (nombre) => args.find((a) => a === `--${nombre}` || a.startsWith(`--${nombre}=`));
const valor = (nombre) => {
  const a = bandera(nombre);
  return a && a.includes("=") ? a.slice(a.indexOf("=") + 1) : undefined;
};

const url = valor("url");
const grupos = bandera("todos")
  ? [...new Set(CATALOGO.map((c) => c.grupo))]
  : (valor("grupo") ?? GRUPOS_POR_DEFECTO.join(",")).split(",").map((g) => g.trim()).filter(Boolean);

const gruposConocidos = new Set(CATALOGO.map((c) => c.grupo));
const desconocidos = grupos.filter((g) => !gruposConocidos.has(g));
if (desconocidos.length) {
  console.error(`FAIL · grupo(s) inexistente(s): ${desconocidos.join(", ")}`);
  console.error(`       conocidos: ${[...gruposConocidos].join(", ")}`);
  process.exit(1);
}

// --- Procedencia --------------------------------------------------------------

const git = (...a) => spawnSync("git", a, { cwd: RAIZ, encoding: "utf8" }).stdout?.trim() ?? "";
const commit = git("rev-parse", "--short", "HEAD") || "desconocido";
const sucio = git("status", "--porcelain").length > 0;
const fecha = new Date().toISOString().slice(0, 10);

// --- Ejecución ----------------------------------------------------------------

const leer = (ruta) => readFileSync(ruta, "utf8").replace(/^﻿/, "");

let paquete;
try {
  paquete = JSON.parse(leer(join(RAIZ, "package.json")));
} catch (e) {
  console.error(`FAIL · package.json no se pudo leer como JSON: ${e?.message ?? e}`);
  process.exit(1);
}
const scripts = paquete.scripts ?? {};

const faltantes = CATALOGO.filter((c) => !(c.script in scripts));
if (faltantes.length) {
  console.error(`FAIL · el catálogo cita scripts que package.json no define: ${faltantes.map((f) => f.script).join(", ")}`);
  process.exit(1);
}

/**
 * Extrae el recuento y el veredicto de la salida, sin inventar ninguno.
 *
 * Los verificadores cierran con `N/M comprobaciones PASS` y una línea final
 * `ETIQUETA: PASS`. `npm test` usa el formato TAP de `node --test`. Cualquier
 * otra cosa es `SIN VEREDICTO`: el script no llegó a resumir, y eso es un dato,
 * no un detalle de formato.
 *
 * **El recuento y el veredicto son independientes.** La primera corrida de este
 * generador marcó `verificar:meas1` como SIN VEREDICTO por exigir el recuento
 * antes de mirar el veredicto, y `meas1` imprime `AC-MEAS-1: PASS` sin recuento
 * —sus cuatro líneas son cifras, no comprobaciones—. El defecto era del lector,
 * no del verificador: `verificar:verificadores` lo acepta, y con razón. Un
 * recuento ausente se reporta como `—`; lo que no se infiere nunca es el
 * veredicto desde el exit code.
 */
function interpretar(salida, exit) {
  const recuentoVerificador = salida.match(/(\d+)\/(\d+) comprobaciones PASS/);
  // La etiqueta admite minúsculas y acentos: `verificar:salida` cierra con
  // "Ciclo ingreso/salida: PASS". El lookahead descarta las líneas de
  // comprobación individual, que empiezan con "PASS ·" y podrían terminar en
  // ": PASS" por el texto del detalle. Se toma la última coincidencia porque el
  // veredicto es lo último que imprime el script.
  const veredictoFinal = [
    ...salida.matchAll(/^(?!PASS · |FAIL · )([\wÁÉÍÓÚÑáéíóúñ ./·-]+):[ \t]*(PASS|FAIL)[ \t]*$/gm),
  ].at(-1);

  const recuento = recuentoVerificador ? `${recuentoVerificador[1]}/${recuentoVerificador[2]}` : "—";
  if (veredictoFinal) return { recuento, veredicto: veredictoFinal[2] };
  if (recuentoVerificador) return { recuento, veredicto: "SIN VEREDICTO" };

  const pasan = salida.match(/^ℹ pass (\d+)$/m);
  const fallan = salida.match(/^ℹ fail (\d+)$/m);
  if (pasan && fallan) {
    const total = Number(pasan[1]) + Number(fallan[1]);
    return { recuento: `${pasan[1]}/${total}`, veredicto: Number(fallan[1]) === 0 ? "PASS" : "FAIL" };
  }

  // `next build` no imprime recuentos; su evidencia es el exit code y lo dice así.
  if (/Compiled successfully|✓ Compiled/.test(salida)) {
    return { recuento: "—", veredicto: exit === 0 ? "PASS" : "FAIL" };
  }

  return { recuento: "—", veredicto: "SIN VEREDICTO" };
}

const filas = [];

for (const entrada of CATALOGO) {
  if (!grupos.includes(entrada.grupo)) {
    filas.push({ ...entrada, corrido: false });
    continue;
  }

  const comando = scripts[entrada.script] + (entrada.url && url ? ` ${url}` : "");
  process.stderr.write(`… ${entrada.script}\n`);

  const r = spawnSync(comando, { cwd: RAIZ, encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024 });
  const salida = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const exit = r.status ?? -1;
  const { recuento, veredicto } = interpretar(salida, exit);

  filas.push({ ...entrada, corrido: true, exit, recuento, veredicto });
}

// --- El bloque ----------------------------------------------------------------

const INICIO = "<!-- EVIDENCIA:INICIO -->";
const FIN = "<!-- EVIDENCIA:FIN -->";

const corridas = filas.filter((f) => f.corrido);
const noCorridas = filas.filter((f) => !f.corrido);
const rojas = corridas.filter((f) => f.veredicto !== "PASS");

const celda = (f) => {
  if (!f.corrido) return `**NO CORRIDO** · grupo \`${f.grupo}\``;
  return `\`exit=${f.exit}\` · ${f.recuento}`;
};

const bloque = [
  INICIO,
  `<!-- Generado por \`npm run evidencia\`. No editar a mano: se regenera y se desfasa. -->`,
  ``,
  `**Commit:** \`${commit}\`${sucio ? " · ⚠ **árbol sucio**: esta corrida no describe un estado reproducible" : " · árbol limpio"} · **corrido:** ${fecha} · **grupos:** ${grupos.join(", ")}`,
  ``,
  `| Comando | Resultado | Veredicto | Nota |`,
  `|---|---|---|---|`,
  ...filas.map((f) => `| \`npm run ${f.script}\` | ${celda(f)} | ${f.corrido ? f.veredicto : "—"} | ${f.nota ?? ""} |`),
  ``,
  `**Cobertura de esta corrida: ${corridas.length} de ${filas.length} comandos.**` +
    (noCorridas.length
      ? ` Los ${noCorridas.length} restantes dicen NO CORRIDO a propósito: un bloque que omite lo que no corrió se lee como si todo hubiera pasado.`
      : ""),
  FIN,
].join("\n");

console.log(bloque);

// --- Actualización de los documentos que lo declaran --------------------------

/**
 * Los documentos que declaran tener un bloque de evidencia. Si uno no trae los
 * marcadores, se reporta: el punto del mecanismo es que ninguno quede fuera en
 * silencio.
 */
const DESTINOS = ["STATE.md", join("docs", "data", "matriz-trazabilidad.md")];

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.error(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

console.error("");

if (bandera("actualizar")) {
  for (const destino of DESTINOS) {
    const ruta = join(RAIZ, destino);
    if (!existsSync(ruta)) {
      comprobar(`${destino} · existe`, false);
      continue;
    }
    const texto = leer(ruta);
    const i = texto.indexOf(INICIO);
    const j = texto.indexOf(FIN);
    if (i === -1 || j === -1 || j < i) {
      comprobar(`${destino} · declara los marcadores de evidencia`, false, "falta EVIDENCIA:INICIO/FIN");
      continue;
    }
    writeFileSync(ruta, texto.slice(0, i) + bloque + texto.slice(j + FIN.length), "utf8");
    comprobar(`${destino} · bloque regenerado`, true);
  }
} else {
  console.error(`INFO · ${DESTINOS.length} destino(s) declarado(s); correr con --actualizar para reescribirlos`);
}

comprobar("todo comando corrido imprimió un veredicto", corridas.every((f) => f.veredicto !== "SIN VEREDICTO"),
  corridas.filter((f) => f.veredicto === "SIN VEREDICTO").map((f) => f.script).join(", "));

comprobar("ningún comando corrido quedó en rojo", rojas.length === 0,
  rojas.map((f) => `${f.script}=${f.veredicto}`).join(", "));

const fallidos = resultados.filter((r) => !r.ok);
console.error(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.error("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.error("EVIDENCIA: PASS");
