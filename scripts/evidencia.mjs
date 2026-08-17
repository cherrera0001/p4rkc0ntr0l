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
 *   2. **Un comando que no resumió nada se reporta `SIN VEREDICTO`**, con su
 *      exit code. No se infiere PASS de un exit 0: si el script murió antes de
 *      resumir, lo que hay es ausencia de evidencia, no evidencia de ausencia.
 *      Pero `FALLARON:` **sí es** un veredicto FAIL, y esto lo pagó un veto:
 *      ninguno de los verificadores reales del repo imprime una línea
 *      `ETIQUETA: FAIL` — todos cierran con el recuento, la lista `FALLARON: …`
 *      y exit 1, y salen antes del veredicto. Leyendo solo la línea de veredicto,
 *      la columna nunca podía decir FAIL para ellos: `verificar:verificadores`
 *      con 38/39 salía publicado como `SIN VEREDICTO`. El script sí resumió; lo
 *      hizo en el idioma real del repo. `SIN VEREDICTO` queda para el que no
 *      resumió nada.
 *   3. **Se estampa el commit y si el árbol estaba sucio.** Una evidencia
 *      tomada sobre cambios sin commitear no describe ningún estado
 *      reproducible, y tiene que decirlo ella misma.
 *
 * Cuatro propiedades más, y las cuatro las pagó **este** script: un auditor lo
 * vetó con nueve hallazgos reproducidos, y el defecto de fondo era siempre el
 * mismo —el que las tres de arriba decían matar—: **resolver la duda hacia el
 * lado optimista.** Fabricaba `EVIDENCIA: PASS` con exit 0 sobre verificadores
 * que habían salido exit 1 imprimiendo FAIL.
 *
 *   4. **El veredicto se lee de `stdout` y solo de `stdout`, anclado a columna
 *      0, y se cruza contra el exit code.** Se concatenaba `stdout + stderr`, así
 *      que una línea de stderr ganaba sobre el veredicto real por orden de
 *      concatenación y no por orden cronológico; y el regex admitía espacios
 *      iniciales, así que una línea de DETALLE indentada terminada en `: PASS`
 *      se convertía en veredicto. **Un exit≠0 no puede rendir PASS**: esa
 *      contradicción se marca `CONTRADICTORIO` y hace fallar al generador. No se
 *      resuelve hacia ninguno de los dos lados, porque resolverla es justo lo que
 *      un verificador comprometido necesita que hagamos.
 *   5. **Un comando que no se pudo ejecutar completo no rinde veredicto.**
 *      `r.error` de `spawnSync` no se inspeccionaba: un verificador que
 *      desbordaba `maxBuffer` —40 MB de ruido y después `FAIL` + exit 1— llegaba
 *      con la salida truncada, el veredicto se leía del pedazo que sí entró, y el
 *      bloque salía verde. Si hubo error de ejecución, la salida se **descarta**
 *      entera: truncada no es evidencia.
 *   6. **Procedencia desconocida no es procedencia limpia.** El estado de git se
 *      leía como `stdout ?? ""`, y un `git` ausente del PATH producía cadena
 *      vacía, que se estampaba como *"árbol limpio"* — una afirmación positiva y
 *      falsa sobre un repo realmente sucio.
 *   7. **`--actualizar` exige exactamente UN par de marcadores.** Se usaba el
 *      `indexOf` de la primera ocurrencia: si el marcador aparecía citado en
 *      prosa antes del bloque real, el bloque se inyectaba dentro de la frase, el
 *      real quedaba viejo, y el destino terminaba con dos bloques que se
 *      contradicen — mientras se imprimía `PASS · bloque regenerado`.
 *
 * Y una comprobación que faltaba entera: **lo que el bloque en disco publica
 * tiene que ser lo que esta corrida midió**. Sin eso, el desfase que este script
 * existe para matar seguía sin detectarse — y de hecho seguía presente, con la
 * suite entera en verde.
 *
 *   8. **El bloque se compara por CONTENIDO, no por procedencia.** El primer
 *      intento comparaba revisiones con `git diff --name-only <estampa> HEAD` y
 *      se llamaba *"el bloque corresponde a HEAD"*, pero lo que verificaba era
 *      *"existe alguna revisión resolvible y ningún archivo fuera de los
 *      destinos cambió"*: **el contenido del bloque no estaba atado a ninguna
 *      corrida.** Un auditor lo reprodujo tres veces — un bloque tecleado a mano
 *      que estampa la cadena literal `HEAD` hace que el diff sea vacío para
 *      siempre; los DESTINOS estaban exentos de la comparación y el bloque vive
 *      dentro de los destinos, así que editarlo a mano y commitear solo los
 *      destinos daba verde; y cualquier archivo suelto sin commitear fuera de
 *      los destinos tumbaba la corrida entera. Verde ante un bloque fabricado y
 *      rojo en desarrollo normal: lo peor de los dos mundos. Ahora se parsean
 *      las filas del bloque en disco y se exige que **cada comando que esta
 *      corrida midió de verdad** coincida en recuento y veredicto con la fila
 *      recién generada. Los que esta corrida no midió se saltan explícitamente y
 *      se cuentan en el detalle: no se pueden juzgar, y callarlo sería la misma
 *      mentira optimista que NO CORRIDO vino a matar. La fecha no se compara:
 *      cambia sola y no es evidencia de nada.
 *   9. **Queda UNA sola comprobación de procedencia, la barata.** El sello tiene
 *      que ser un SHA que `git rev-parse --verify <sello>^{commit}` resuelva.
 *      La cadena literal `HEAD` —o `main`, o `sin-generar`— no pasa. Si git no
 *      responde, **falla cerrado**: no se salta en silencio.
 *
 * Probado con el fallo plantado, no contra un repo limpio:
 * `scripts/evidencia.prueba.mjs`. Un gate que solo se probó en el caso que ya
 * pasa no se probó.
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
 *       node scripts/evidencia.mjs --raiz=…        # otra raíz (la usa la prueba)
 *       node scripts/evidencia.mjs --timeout=60000 # ms por comando
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  { script: "evidencia:prueba", grupo: "estatico" },
  { script: "verificar:ac", grupo: "estatico" },
  { script: "verificar:citas", grupo: "estatico" },
  { script: "verificar:verificadores", grupo: "estatico" },
  { script: "verificar:agentes", grupo: "estatico" },
  { script: "verificar:esquema", grupo: "base" },
  { script: "verificar:invariantes", grupo: "base" },
  { script: "verificar:meas1", grupo: "base" },
  {
    script: "verificar:h1",
    grupo: "base",
    nota: "**se espera FAIL** mientras el banco esté vacío: es el entregable de FASE D, no una regresión. *«No pude medirlo» no es «está bien»*",
  },
  { script: "build", grupo: "build" },
  { script: "verificar:salida", grupo: "servidor", url: true },
  { script: "verificar:pwa", grupo: "navegador", url: true },
  { script: "verificar:op1", grupo: "navegador", url: true },
  { script: "verificar:a3", grupo: "navegador", url: true },
  { script: "verificar:m4", grupo: "navegador", url: true },
  { script: "verificar:meas2", grupo: "navegador", url: true },
  { script: "verificar:temporizador", grupo: "navegador", url: true },
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

/**
 * La raíz sobre la que se corre. Existe por la misma razón que el argumento
 * `[raíz]` de `verificar-alcance.mjs`: **un gate que solo se probó contra el
 * propio repo no se probó.** `evidencia.prueba.mjs` construye árboles falsos con
 * el fallo plantado y apunta acá.
 */
const RAIZ = resolve(valor("raiz") ?? join(dirname(fileURLToPath(import.meta.url)), ".."));

/**
 * Techo de tiempo por comando. Sin techo, un verificador colgado —esperando un
 * navegador que nunca abre, o una base que no responde— deja el generador vivo
 * indefinidamente y sin una sola línea de salida. Un cuelgue tiene que
 * convertirse en evidencia, no en silencio.
 */
const TIMEOUT_MS = Number(valor("timeout") ?? 10 * 60 * 1000);

/** Tope de salida capturada. Desbordarlo NO produce veredicto: ver propiedad 5. */
const MAXBUFFER = 32 * 1024 * 1024;

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

// `--grupo=` vacío seleccionaba cero grupos, corría cero comandos y salía verde
// —y con `--actualizar` sobrescribía los destinos con un bloque todo-NO-CORRIDO—.
// Cero mediciones no es una corrida exitosa: es ninguna corrida.
if (grupos.length === 0) {
  console.error("FAIL · --grupo= no seleccionó ningún grupo: una corrida de cero comandos no es evidencia");
  console.error(`       conocidos: ${[...gruposConocidos].join(", ")}`);
  process.exit(1);
}

// --- Procedencia --------------------------------------------------------------

/**
 * `null` significa **no sé**, y no se colapsa a cadena vacía.
 *
 * La versión anterior era `spawnSync("git", …).stdout?.trim() ?? ""`, y con git
 * fuera del PATH eso daba `""` → `.length > 0` falso → el bloque estampaba
 * *"árbol limpio"* sobre un repo realmente sucio. Una afirmación positiva y
 * falsa sobre la reproducibilidad de la evidencia.
 */
const git = (...a) => {
  const r = spawnSync("git", a, { cwd: RAIZ, encoding: "utf8" });
  if (r.error || r.status !== 0) return null;
  return r.stdout?.trim() ?? "";
};

const commitLeido = git("rev-parse", "--short", "HEAD");
const estadoLeido = git("status", "--porcelain");
const commit = commitLeido || "desconocido";
/** `limpio` | `sucio` | `desconocido`. Desconocido **no** es limpio. */
const procedencia =
  commitLeido === null || estadoLeido === null ? "desconocido" : estadoLeido.length > 0 ? "sucio" : "limpio";
const SELLO = {
  limpio: " · árbol limpio",
  sucio: " · ⚠ **árbol sucio**: esta corrida no describe un estado reproducible",
  desconocido: " · ⚠ **procedencia desconocida**: git no respondió, esta corrida no se puede atribuir a ningún commit",
};
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
 * Verificadores deliberadamente fuera del bloque de evidencia. **Vacío, y esa es
 * la decisión.**
 *
 * `verificar-ac.mjs` tiene un `META_GUARDS` que excluye los guards de
 * documentación de §9, y con razón: §9 es el contrato del producto, y meter ahí
 * un guard de documentos ascendería un subproducto a criterio de aceptación
 * permanente. Acá el criterio es el opuesto y no hay que duplicar aquel: el
 * bloque de evidencia reporta **todo lo que se puede correr**, guards incluidos
 * —de hecho `verificar:citas`, `verificar:ac` y `verificar:verificadores` ya
 * están en el catálogo—. Por eso hay **una sola** entrada acá, y sacar algo más
 * de la evidencia tiene que ser una línea en el diff que alguien justifique.
 *
 * La única: **`evidencia` es este mismo script.** No puede ser una fila de su
 * propio bloque —se invocaría a sí mismo sin fondo—, y su evidencia no falta:
 * la da `evidencia:prueba`, que sí está en el catálogo y sí se mide. Apareció al
 * ampliar la detección más allá del prefijo `verificar:`.
 *
 * **La exclusión la declara el bloque.** Una exclusión silenciosa baja la
 * cobertura sin explicar por qué, que es exactamente la familia de defecto que
 * `NO CORRIDO` vino a matar: el lector ve "N de M" y no tiene forma de saber que
 * hubo un M' mayor.
 */
const FUERA_DEL_CATALOGO = new Set(["evidencia"]);

/**
 * **Deriva del catálogo.** Un verificador presente en package.json y ausente
 * del catálogo desaparecía del bloque sin dejar rastro, y el pie seguía
 * publicando "Cobertura: N de 19" como si 19 fuera el total. Reproducido
 * agregando `verificar:critico`: el verificador nuevo era invisible y el bloque
 * daba verde. `verificar-ac.mjs` sí detecta el huérfano; la evidencia no.
 *
 * **No basta el prefijo `verificar:`.** Mirarlo solo a él dejaba escapar a
 * `e2e:humo`, `chequear:tarifa` o `verificar-nuevo` (con guion): scripts que son
 * verificadores por todo concepto, invisibles para el bloque, con el generador
 * en verde. Se mira el nombre por segmentos —`:`, `-`, `_`— **y además el
 * archivo que el comando invoca**, que es la señal que no depende de cómo
 * alguien decidió bautizar el atajo.
 */
const NOMBRE_DE_VERIFICADOR =
  /(^|[:\-_])(verificar|verificación|chequear|comprobar|validar|auditar|probar|prueba|pruebas|test|tests|e2e|humo|smoke|regresion|regresión|evidencia)([:\-_]|$)/i;
const ARCHIVO_DE_VERIFICADOR =
  /(^|[\\/])(verificar|chequear|comprobar|validar|auditar|evidencia|e2e|humo)[\w.·-]*\.[cm]?[jt]s\b|\.(prueba|test|spec)\.[cm]?[jt]s\b/i;

const esVerificador = (nombre, comando) =>
  NOMBRE_DE_VERIFICADOR.test(nombre) || ARCHIVO_DE_VERIFICADOR.test(String(comando ?? ""));

const enCatalogo = new Set(CATALOGO.map((c) => c.script));
const derivados = Object.keys(scripts).filter(
  (s) => esVerificador(s, scripts[s]) && !enCatalogo.has(s) && !FUERA_DEL_CATALOGO.has(s),
);
if (derivados.length) {
  console.error(`FAIL · package.json define verificador(es) que el catálogo no enumera: ${derivados.join(", ")}`);
  console.error("       lo que no está en el catálogo no puede reportarse como NO CORRIDO: desaparece.");
  console.error("       agregarlo a CATALOGO (o, con motivo, a FUERA_DEL_CATALOGO).");
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
  //
  // **El primer carácter no puede ser espacio ni tabulación.** La clase de
  // caracteres los incluía y el lookahead solo miraba la columna 0, así que una
  // línea de detalle INDENTADA terminada en ": PASS" —"    tarifa nocturna:
  // PASS"— matcheaba entera y se convertía en el veredicto del comando. Un
  // veredicto vive al ras del margen; lo indentado es detalle de otra cosa.
  const veredictoFinal = [
    ...salida.matchAll(
      /^(?!PASS · |FAIL · )[\wÁÉÍÓÚÑáéíóúñ./·-][\wÁÉÍÓÚÑáéíóúñ ./·-]*:[ \t]*(PASS|FAIL)[ \t]*$/gm,
    ),
  ].at(-1);

  const recuento = recuentoVerificador ? `${recuentoVerificador[1]}/${recuentoVerificador[2]}` : "—";

  // **`FALLARON:` es un veredicto FAIL.** Es *la* forma de fallo del repo: los
  // 16 verificadores reales cierran con el recuento, la lista de fallidos y
  // exit 1, y salen ANTES de imprimir línea de veredicto — o sea que ninguno
  // imprime jamás `ETIQUETA: FAIL`. Exigir esa línea dejaba la columna Veredicto
  // incapaz de decir FAIL para 15 de los 16, y volvía código muerto al cruce con
  // el exit code. Pasaba en el repo: `verificar:verificadores | exit=1 · 38/39 |
  // SIN VEREDICTO`. Manda sobre la línea de veredicto, y no al revés: un script
  // que enumeró fallidos y además imprimió PASS no se resuelve hacia el lado
  // optimista.
  if (/^FALLARON:/m.test(salida)) return { recuento, veredicto: "FAIL" };

  if (veredictoFinal) return { recuento, veredicto: veredictoFinal[1] };
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

  const r = spawnSync(comando, {
    cwd: RAIZ,
    encoding: "utf8",
    shell: true,
    maxBuffer: MAXBUFFER,
    timeout: TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
  const exit = r.status ?? -1;

  // `r.error` no se inspeccionaba nunca. Un verificador que desborda `maxBuffer`
  // o que se cuelga llega acá con la salida TRUNCADA y `status` en null; leer un
  // veredicto de ese pedazo es leerlo de un archivo cortado por la mitad. La
  // salida se descarta entera: el dato es que el comando no se pudo ejecutar.
  //
  // El desborde de captura se manifiesta de más de una forma según cómo caiga el
  // temporizado del pipe —medido en Windows: a veces `ENOBUFS`, a veces una
  // señal, a veces stdout vacío con `status` 1—. Por eso se mira además el
  // tamaño: cualquiera de esas formas termina en "no rinde veredicto", que es la
  // propiedad que importa.
  const truncada = (r.stdout?.length ?? 0) >= MAXBUFFER || (r.stderr?.length ?? 0) >= MAXBUFFER;
  const falloEjecucion = r.error
    ? r.error.code === "ENOBUFS"
      ? `salida desbordó los ${MAXBUFFER} bytes de captura`
      : r.error.code === "ETIMEDOUT"
        ? `tiempo agotado a los ${TIMEOUT_MS} ms`
        : r.signal
          ? `terminado por señal ${r.signal}`
          : (r.error.code ?? r.error.message ?? "error de ejecución")
    : truncada
      ? `salida truncada en el tope de captura (${MAXBUFFER} bytes)`
      : null;

  // El veredicto se lee SOLO de stdout. Concatenar `stdout + "\n" + stderr`
  // ponía stderr siempre después, así que el "último veredicto" era el último
  // por orden de concatenación y no por orden cronológico: una línea de stderr
  // le ganaba al veredicto real impreso por el script en stdout.
  const { recuento, veredicto } = falloEjecucion
    ? { recuento: "—", veredicto: "SIN VEREDICTO" }
    : interpretar(r.stdout ?? "", exit);

  // Un exit≠0 no puede rendir PASS, y un exit 0 no puede rendir FAIL. Cuando el
  // script se contradice a sí mismo, el generador no elige un lado: lo dice.
  const contradictorio =
    !falloEjecucion && (veredicto === "PASS" || veredicto === "FAIL") && (exit === 0) !== (veredicto === "PASS");

  filas.push({ ...entrada, corrido: true, exit, recuento, veredicto, falloEjecucion, contradictorio });
}

// --- El bloque ----------------------------------------------------------------

const INICIO = "<!-- EVIDENCIA:INICIO -->";
const FIN = "<!-- EVIDENCIA:FIN -->";

const corridas = filas.filter((f) => f.corrido);
const noCorridas = filas.filter((f) => !f.corrido);

// Rojo es todo lo que no es un PASS limpio: el veredicto impreso, el exit code y
// la ejecución tienen que estar los tres de acuerdo. Filtrar solo por
// `veredicto !== "PASS"` dejaba pasar cualquier FAIL malparseado como PASS.
const rojas = corridas.filter((f) => f.veredicto !== "PASS" || f.exit !== 0 || f.falloEjecucion || f.contradictorio);
const contradictorias = corridas.filter((f) => f.contradictorio);
const trabadas = corridas.filter((f) => f.falloEjecucion);

const celda = (f) => {
  if (!f.corrido) return `**NO CORRIDO** · grupo \`${f.grupo}\``;
  if (f.falloEjecucion) return `\`exit=${f.exit}\` · ⚠ **no se ejecutó completo**: ${f.falloEjecucion}`;
  return `\`exit=${f.exit}\` · ${f.recuento}`;
};

const veredictoCelda = (f) => {
  if (!f.corrido) return "—";
  if (f.contradictorio) return `⚠ **CONTRADICTORIO** · imprimió ${f.veredicto} con \`exit=${f.exit}\``;
  return f.veredicto;
};

const bloque = [
  INICIO,
  `<!-- Generado por \`npm run evidencia\`. No editar a mano: se regenera y se desfasa. -->`,
  ``,
  `**Commit:** \`${commit}\`${SELLO[procedencia]} · **corrido:** ${fecha} · **grupos:** ${grupos.join(", ")}`,
  ``,
  `| Comando | Resultado | Veredicto | Nota |`,
  `|---|---|---|---|`,
  ...filas.map((f) => `| \`npm run ${f.script}\` | ${celda(f)} | ${veredictoCelda(f)} | ${f.nota ?? ""} |`),
  ``,
  `**Cobertura de esta corrida: ${corridas.length} de ${filas.length} comandos.**` +
    (noCorridas.length
      ? ` Los ${noCorridas.length} restantes dicen NO CORRIDO a propósito: un bloque que omite lo que no corrió se lee como si todo hubiera pasado.`
      : ""),
  // La exclusión se declara o no existe: bajar la cobertura sin decir por qué es
  // la misma mentira por omisión que NO CORRIDO vino a matar.
  ...(FUERA_DEL_CATALOGO.size
    ? [
        ``,
        `**Excluidos del catálogo a propósito (${FUERA_DEL_CATALOGO.size}):** ` +
          [...FUERA_DEL_CATALOGO].map((s) => `\`npm run ${s}\``).join(", ") +
          `. No están medidos acá y esta línea existe para que la cobertura no baje en silencio.`,
      ]
    : []),
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

/** Cuántas veces aparece `aguja` en `texto`. */
const cuenta = (texto, aguja) => texto.split(aguja).length - 1;

if (bandera("actualizar")) {
  for (const destino of DESTINOS) {
    const ruta = join(RAIZ, destino);
    if (!existsSync(ruta)) {
      comprobar(`${destino} · existe`, false);
      continue;
    }
    const texto = leer(ruta);
    const inicios = cuenta(texto, INICIO);
    const fines = cuenta(texto, FIN);

    // **Exactamente uno de cada marcador, o no se escribe.** Con `indexOf` de la
    // primera ocurrencia, un marcador citado en prosa antes del bloque real
    // hacía que el bloque se inyectara dentro de la frase: el real quedaba
    // viejo, el archivo terminaba con dos bloques que se contradicen, y esto
    // imprimía `PASS · bloque regenerado`. Corromper el destino y declararse
    // exitoso es el peor modo de falla posible para un generador de evidencia.
    if (inicios !== 1 || fines !== 1) {
      comprobar(
        `${destino} · trae exactamente un par de marcadores de evidencia`,
        false,
        `${inicios} INICIO / ${fines} FIN · no se escribió nada: con marcadores ambiguos la reescritura corrompe el archivo`,
      );
      continue;
    }
    const i = texto.indexOf(INICIO);
    const j = texto.indexOf(FIN);
    if (j < i) {
      comprobar(`${destino} · los marcadores están en orden`, false, "FIN aparece antes que INICIO");
      continue;
    }
    writeFileSync(ruta, texto.slice(0, i) + bloque + texto.slice(j + FIN.length), "utf8");
    comprobar(`${destino} · bloque regenerado`, true);
  }
} else {
  console.error(`INFO · ${DESTINOS.length} destino(s) declarado(s); correr con --actualizar para reescribirlos`);
}

/**
 * **Lo publicado tiene que ser lo medido.** Nadie lo verificaba, y por eso el
 * desfase que este script existe para matar seguía vivo: `STATE.md` y la matriz
 * publicaban un bloque de otro commit con la suite entera en verde.
 *
 * **Por qué NO se compara por procedencia.** El primer intento hacía
 * `git diff --name-only <estampa> HEAD` y toleraba la deriva de los destinos. Se
 * llamaba *"el bloque corresponde a HEAD"* pero comprobaba *"existe alguna
 * revisión resolvible y ningún archivo fuera de los destinos cambió"*, que no
 * ata **nada** del contenido a **ninguna** corrida. Tres reproducciones:
 *
 *   - estampar la cadena literal `` `HEAD` `` a mano hace que el diff sea
 *     `HEAD..HEAD` — vacío para siempre, con cualquier tabla debajo;
 *   - el bloque VIVE dentro de los destinos, y los destinos estaban exentos:
 *     regenerar, commitear, editar la tabla a mano poniendo `exit=0 · 30/30 |
 *     PASS` en cada NO CORRIDO y commitear solo los destinos daba verde;
 *   - cualquier archivo suelto sin commitear fuera de los destinos tumbaba la
 *     corrida entera, así que en desarrollo normal el criterio era insatisfacible.
 *
 * Comparar revisiones nunca iba a atar el contenido, y cada parche abría otro
 * agujero. Lo que se compara ahora es el **contenido**:
 *
 *   1. se parsean las filas del bloque que hay EN DISCO;
 *   2. para **cada comando que esta corrida midió de verdad**, la fila publicada
 *      tiene que coincidir con la recién generada en resultado y veredicto; si
 *      no, FAIL nombrando el comando y los dos valores;
 *   3. los comandos que esta corrida **no** midió se saltan y se cuentan: no se
 *      pueden juzgar, y decir cuántos quedaron sin juzgar es parte del veredicto;
 *   4. la fecha y el sello no entran en la comparación: cambian solos.
 *
 * Y **una sola** comprobación de procedencia, la barata: el sello tiene que ser
 * un SHA que `git rev-parse --verify <sello>^{commit}` resuelva. Eso mata el
 * bloque tecleado con `HEAD`, con `main` o con `sin-generar`. Si git no
 * responde, falla cerrado — una procedencia que no se puede comprobar no es una
 * procedencia limpia.
 *
 * Esto es satisfacible en régimen: tras `--actualizar` el disco tiene justo las
 * filas que se acaban de generar, y volver a correr con los mismos grupos da
 * verde. Un criterio que no puede estar verde en operación normal se termina
 * apagando, y un gate apagado es peor que ninguno.
 */

/** Un sello legítimo es un SHA, no un nombre de revisión. `HEAD` no es un SHA. */
const SELLO_ES_SHA = /^[0-9a-f]{7,40}$/i;

/**
 * Filas del bloque en disco, indexadas por script. Markdown no admite `|` sin
 * escapar dentro de una celda, así que partir por `|` es exacto.
 */
function filasPublicadas(textoBloque) {
  const mapa = new Map();
  for (const linea of textoBloque.split("\n")) {
    if (!linea.trimStart().startsWith("|")) continue;
    const celdas = linea.split("|").slice(1, -1).map((c) => c.trim());
    if (celdas.length < 3) continue;
    const m = celdas[0].match(/^`npm run (.+)`$/);
    if (m) mapa.set(m[1], { resultado: celdas[1], veredicto: celdas[2] });
  }
  return mapa;
}

/** Compara texto de celda sin que un espacio de más decida un veredicto. */
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

for (const destino of DESTINOS) {
  const ruta = join(RAIZ, destino);
  const nombreSello = `${destino} · el sello es un commit que este repo resuelve`;
  const nombreFilas = `${destino} · lo publicado coincide con lo que esta corrida midió`;

  if (!existsSync(ruta)) {
    comprobar(nombreSello, false, "no existe");
    comprobar(nombreFilas, false, "no existe");
    continue;
  }
  const texto = leer(ruta);
  const bloqueEstampado = texto.match(new RegExp(`${INICIO}[\\s\\S]*?${FIN}`))?.[0];
  if (!bloqueEstampado) {
    comprobar(nombreSello, false, "no trae bloque de evidencia");
    comprobar(nombreFilas, false, "no trae bloque de evidencia");
    continue;
  }

  // --- Procedencia (la única, y barata) ---------------------------------------
  const estampado = bloqueEstampado.match(/\*\*Commit:\*\* `([^`]+)`/)?.[1];
  if (!estampado || !SELLO_ES_SHA.test(estampado)) {
    comprobar(
      nombreSello,
      false,
      `estampa \`${estampado ?? "nada"}\`, que no es un SHA: un bloque tecleado a mano puede poner ahí cualquier nombre de revisión · regenerar con --actualizar`,
    );
  } else {
    // Falla cerrado: si git no responde, la procedencia no queda comprobada, y
    // no comprobada no es limpia.
    const resuelto = git("rev-parse", "--verify", "--quiet", `${estampado}^{commit}`);
    comprobar(
      nombreSello,
      Boolean(resuelto),
      resuelto
        ? `${estampado} → ${resuelto.slice(0, 12)}`
        : `git no resolvió \`${estampado}^{commit}\` (commit inexistente, o git ausente: sin git no hay procedencia comprobada)`,
    );
  }

  // --- Contenido ---------------------------------------------------------------
  const publicadas = filasPublicadas(bloqueEstampado);
  const discrepancias = [];
  let comparadas = 0;

  for (const f of corridas) {
    const pub = publicadas.get(f.script);
    if (!pub) {
      discrepancias.push(`${f.script}: esta corrida lo midió y el bloque no lo publica`);
      continue;
    }
    comparadas++;
    const esperado = { resultado: celda(f), veredicto: veredictoCelda(f) };
    if (norm(pub.resultado) !== norm(esperado.resultado) || norm(pub.veredicto) !== norm(esperado.veredicto)) {
      discrepancias.push(
        `${f.script}: publicado "${norm(pub.resultado)} / ${norm(pub.veredicto)}" ≠ medido "${norm(esperado.resultado)} / ${norm(esperado.veredicto)}"`,
      );
    }
  }

  // Lo que esta corrida no midió no se juzga, y se dice cuántos son. Callarlo
  // convertiría "N filas verdes" en una afirmación sobre filas que nadie miró.
  const saltadas = noCorridas.length;
  const resumen =
    `${comparadas} fila(s) comparadas contra lo medido` +
    (saltadas ? `, ${saltadas} saltada(s): esta corrida no las midió y no se pueden juzgar` : "");

  comprobar(
    nombreFilas,
    discrepancias.length === 0,
    discrepancias.length
      ? `${discrepancias.length} discrepancia(s) · ${discrepancias.slice(0, 3).join(" · ")} · regenerar con --actualizar`
      : resumen,
  );
}

comprobar(
  "la procedencia de esta corrida es conocida",
  procedencia !== "desconocido",
  procedencia === "desconocido" ? "git no respondió: procedencia desconocida NO es procedencia limpia" : procedencia,
);

comprobar("la corrida midió al menos un comando", corridas.length > 0, `${corridas.length} corrido(s)`);

comprobar("todo comando corrido se pudo ejecutar completo", trabadas.length === 0,
  trabadas.map((f) => `${f.script}: ${f.falloEjecucion}`).join(", "));

comprobar("ningún comando corrido contradice su exit code", contradictorias.length === 0,
  contradictorias.map((f) => `${f.script}: imprimió ${f.veredicto} con exit=${f.exit}`).join(", "));

comprobar("todo comando corrido imprimió un veredicto", corridas.every((f) => f.veredicto !== "SIN VEREDICTO"),
  corridas.filter((f) => f.veredicto === "SIN VEREDICTO").map((f) => f.script).join(", "));

comprobar("ningún comando corrido quedó en rojo", rojas.length === 0,
  rojas.map((f) => `${f.script}=${f.veredicto} exit=${f.exit}`).join(", "));

const fallidos = resultados.filter((r) => !r.ok);
console.error(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.error("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.error("EVIDENCIA: PASS");
