/**
 * Prueba del generador de evidencia **con el fallo plantado**.
 *
 * La regla del proyecto, que ya costó un veto en el gate de alcance: **un gate
 * que solo se probó contra un repo limpio no se probó.** `scripts/evidencia.mjs`
 * la había incumplido de la peor forma posible para un generador de evidencia:
 * un auditor reprodujo nueve defectos, cinco bloqueantes, y en cinco de ellos el
 * script imprimía `EVIDENCIA: PASS` con exit 0 sobre verificadores que habían
 * salido exit 1 diciendo FAIL. Corregirlo sin plantar los fallos habría dejado
 * exactamente la misma evidencia que el veto destruyó: "lo corrí y dio verde".
 *
 * Acá se construyen repos falsos en un directorio temporal —con su propio git,
 * su propio `package.json` y talones que imprimen lo que se les diga—, se corre
 * el generador real contra cada uno con `--raiz`, y se exige que **falle donde
 * tiene que fallar**. Nada toca el repo.
 *
 * Cada caso cita el hallazgo que lo pagó. El último es un control negativo: una
 * salida rara pero legítima que **no** debe disparar, porque un gate que falla
 * ante todo tampoco discrimina nada.
 *
 * **Segundo veto, y la lección propia de esta prueba:** los talones plantaban
 * `VERIFICADOR REAL: FAIL` en columna 0, una forma de fallo que **el repo no
 * produce**. Los 16 verificadores reales cierran con el recuento, `FALLARON: …`
 * y exit 1, sin línea de veredicto. Plantar una forma inventada es probar contra
 * un repo que no existe: el defecto real —la columna Veredicto incapaz de decir
 * FAIL para 15 de los 16— pasó por debajo de una prueba en verde. Ahora los
 * fallos se plantan con `talonFalla()`, que reproduce la forma real.
 *
 * Uso:  node scripts/evidencia.prueba.mjs
 *       npm run evidencia:prueba
 *       node scripts/evidencia.prueba.mjs --generador=…   # diferencial contra otra versión
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * El generador bajo prueba. Se puede apuntar a otro archivo para medir el
 * **diferencial honesto**: cuántas de estas comprobaciones distinguen la versión
 * nueva de la vieja. Sin esto, "lo probé contra la versión anterior" no se puede
 * reproducir — y ya pasó: un diferencial reportado como 3/14 era en realidad el
 * harness colapsando con ENOENT, porque la versión vieja no aceptaba `--raiz` y
 * nunca llegó a mirar el fixture.
 *
 *   node scripts/evidencia.prueba.mjs --generador=/ruta/a/evidencia-vieja.mjs
 */
const GENERADOR = resolve(
  process.argv.slice(2).find((a) => a.startsWith("--generador="))?.slice("--generador=".length) ??
    process.env.EVIDENCIA_GENERADOR ??
    join(RAIZ, "scripts", "evidencia.mjs"),
);
const GUARD = join(RAIZ, "scripts", "verificar-verificadores.mjs");

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

/** Corre el generador contra una raíz falsa y devuelve `{ codigo, salida }`. */
function correr(dir, args = [], env = process.env) {
  const r = spawnSync(process.execPath, [GENERADOR, `--raiz=${dir}`, ...args], {
    cwd: dir,
    encoding: "utf8",
    env,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { codigo: r.status ?? -1, salida: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const git = (dir, ...a) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });
const cabeza = (dir) => (git(dir, "rev-parse", "--short", "HEAD").stdout ?? "").trim();

/** La fila del bloque markdown correspondiente a un comando. */
const fila = (salida, script) =>
  salida.split("\n").find((l) => l.startsWith(`| \`npm run ${script}\` |`)) ?? "(sin fila)";

// --- Talones ------------------------------------------------------------------

const talon = (stdout, { stderr = "", exit = 0 } = {}) =>
  `process.stdout.write(${JSON.stringify(stdout)});\n` +
  `process.stderr.write(${JSON.stringify(stderr)});\n` +
  `process.exitCode = ${exit};\n`;

const TALON_OK = talon("FIXTURE: PASS\n");

/**
 * **La forma de fallo REAL del repo**, no una inventada.
 *
 * Los 16 verificadores fallan así: líneas de comprobación, línea en blanco,
 * recuento, `FALLARON: …`, exit 1 — y **salen antes de imprimir un veredicto**.
 * Ninguno imprime nunca `ETIQUETA: FAIL`. La prueba anterior plantaba
 * `VERIFICADOR REAL: FAIL` en columna 0, una forma que el repo no produce, y por
 * eso no detectó que la columna Veredicto era incapaz de decir FAIL para 15 de
 * los 16 verificadores reales.
 */
const talonFalla = (
  { comprobacion = "algo que el repo comprueba", recuento = "38/39", extra = "" } = {},
) =>
  talon(
    [
      `PASS · otra cosa`,
      `FAIL · ${comprobacion}`,
      ...(extra ? [extra] : []),
      ``,
      `${recuento} comprobaciones PASS`,
      `FALLARON: ${comprobacion}`,
      ``,
    ].join("\n"),
    { exit: 1 },
  );

/**
 * El catálogo del generador, preguntado al generador mismo: se le da un
 * `package.json` sin scripts y él enumera lo que le falta. Enumerarlo acá a mano
 * sería una segunda copia que se desfasa — el defecto H1 otra vez, ahora en la
 * prueba.
 */
const NOMBRES = (() => {
  const dir = mkdtempSync(join(tmpdir(), "evidencia-catalogo-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", scripts: {} }), "utf8");
  const { salida } = correr(dir);
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* limpieza best-effort */
  }
  const m = salida.match(/package\.json no define: (.+)/);
  return m ? m[1].trim().split(/,\s*/) : [];
})();

const BLOQUE_FIXTURE = [
  "<!-- EVIDENCIA:INICIO -->",
  "",
  "**Commit:** `sin-generar` · árbol limpio · **corrido:** 1970-01-01 · **grupos:** ninguno",
  "",
  "<!-- EVIDENCIA:FIN -->",
].join("\n");

const cuerpo = (titulo) => `# ${titulo}\n\n${BLOQUE_FIXTURE}\n\nProsa que va después del bloque.\n`;

const MATRIZ = join("docs", "data", "matriz-trazabilidad.md");

const temporales = [];

/**
 * Construye un repo falso: talones para todo el catálogo, los dos destinos con
 * su bloque, y un commit real —para que la procedencia sea la de un repo de
 * verdad y no una simulación.
 */
function arbol({ guiones = {}, scriptsExtra = {}, state, matriz, sucio = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "evidencia-"));
  temporales.push(dir);
  mkdirSync(join(dir, "talon"), { recursive: true });

  const scripts = {};
  const poner = (nombre, codigo) => {
    const archivo = `talon/${nombre.replace(/[^\w]/g, "_")}.mjs`;
    writeFileSync(join(dir, archivo), codigo, "utf8");
    scripts[nombre] = `"${process.execPath}" ${archivo}`;
  };
  for (const nombre of NOMBRES) poner(nombre, guiones[nombre] ?? TALON_OK);
  for (const [nombre, codigo] of Object.entries(scriptsExtra)) poner(nombre, codigo);

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "arbol-falso", scripts }, null, 2), "utf8");

  for (const [ruta, contenido] of [
    ["STATE.md", state ?? cuerpo("STATE fixture")],
    [MATRIZ, matriz ?? cuerpo("Matriz fixture")],
  ]) {
    const abs = join(dir, ruta);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contenido, "utf8");
  }

  git(dir, "init", "-q");
  git(dir, "config", "user.email", "prueba@example.invalid");
  git(dir, "config", "user.name", "prueba");
  git(dir, "config", "core.autocrlf", "false");
  git(dir, "add", "-A");
  git(dir, "-c", "commit.gpgsign=false", "commit", "-qm", "fixture");
  if (sucio) writeFileSync(join(dir, "sin-commitear.txt"), "cambio real sin commitear\n", "utf8");
  return dir;
}

const commitear = (dir, mensaje) => {
  git(dir, "add", "-A");
  git(dir, "-c", "commit.gpgsign=false", "commit", "-qm", mensaje);
};

/** La ruta del talón de un script, con la convención que usa `arbol()`. */
const rutaTalon = (dir, nombre) => join(dir, "talon", `${nombre.replace(/[^\w]/g, "_")}.mjs`);

/**
 * Escribe a mano el bloque de evidencia en los dos destinos y lo commitea. Es
 * el ataque que el auditor reprodujo: **el bloque vive dentro de los destinos**,
 * así que fabricarlo y commitear solo los destinos dejaba el árbol limpio y
 * `git diff` vacío. La procedencia jamás iba a cazar esto.
 */
function fabricarBloque(dir, { sello, filas }) {
  const bloque = [
    "<!-- EVIDENCIA:INICIO -->",
    "",
    `**Commit:** \`${sello}\` · árbol limpio · **corrido:** 1970-01-01 · **grupos:** estatico, base`,
    "",
    "| Comando | Resultado | Veredicto | Nota |",
    "|---|---|---|---|",
    ...filas,
    "",
    "<!-- EVIDENCIA:FIN -->",
  ].join("\n");
  for (const destino of ["STATE.md", MATRIZ]) {
    writeFileSync(join(dir, destino), `# fixture\n\n${bloque}\n\nProsa que va después del bloque.\n`, "utf8");
  }
  commitear(dir, "bloque fabricado a mano");
}

try {
  comprobar("el catálogo del generador se pudo enumerar", NOMBRES.length > 0, `${NOMBRES.length} comando(s)`);

  // --- Control positivo: repo limpio, todo verde -----------------------------
  {
    const dir = arbol();
    const { codigo, salida } = correr(dir, ["--actualizar"]);
    const state = readFileSync(join(dir, "STATE.md"), "utf8");
    comprobar(
      "un repo limpio con todo en verde pasa y estampa el commit real",
      codigo === 0 &&
        /EVIDENCIA: PASS/.test(salida) &&
        state.includes(`\`${cabeza(dir)}\``) &&
        state.includes("árbol limpio"),
      `exit=${codigo}`,
    );
  }

  // --- H1 · deriva del catálogo ----------------------------------------------
  // Un verificador nuevo en package.json que el catálogo no enumera desaparecía
  // del bloque, y el pie seguía publicando "Cobertura: N de 19".
  {
    const dir = arbol({ scriptsExtra: { "verificar:critico": TALON_OK } });
    const { codigo, salida } = correr(dir, ["--actualizar"]);
    comprobar(
      "H1 · un verificar:* fuera del catálogo hace fallar al generador",
      codigo === 1 && /el catálogo no enumera/.test(salida) && /verificar:critico/.test(salida),
      `exit=${codigo}`,
    );
  }

  // --- M3 · la detección no puede depender del prefijo `verificar:` ----------
  // Un script llamado `e2e:humo`, `chequear:tarifa` o `verificar-nuevo` (con
  // guion) desaparecía del bloque y el generador quedaba verde: la cobertura
  // bajaba sin que nadie lo viera, que es la misma familia de defecto que
  // NO CORRIDO vino a matar. Cada nombre se planta por separado para que el
  // detalle diga cuál de los tres se escapa, si alguno se escapa.
  for (const nombre of ["e2e:humo", "chequear:tarifa", "verificar-nuevo"]) {
    const dir = arbol({ scriptsExtra: { [nombre]: TALON_OK } });
    const { codigo, salida } = correr(dir, ["--actualizar"]);
    comprobar(
      `M3 · \`${nombre}\` fuera del catálogo hace fallar al generador`,
      codigo === 1 && /el catálogo no enumera/.test(salida) && salida.includes(nombre),
      `exit=${codigo}`,
    );
  }

  // --- M2 · la forma de fallo REAL del repo rinde FAIL, no SIN VEREDICTO -----
  // Ninguno de los 16 verificadores imprime `ETIQUETA: FAIL`: todos cierran con
  // el recuento, `FALLARON: …` y exit 1. Con la forma real, el generador decía
  // `SIN VEREDICTO` — o sea que la columna Veredicto nunca podía decir FAIL para
  // 15 de los 16, y el cruce con el exit code era código muerto para ellos.
  // Estaba pasando en el repo: `verificar:verificadores | exit=1 · 38/39 | SIN
  // VEREDICTO`.
  {
    const dir = arbol({ guiones: { "verificar:citas": talonFalla({ recuento: "38/39" }) } });
    const { codigo, salida } = correr(dir);
    const f = fila(salida, "verificar:citas");
    comprobar(
      "M2 · la forma de fallo real (recuento + FALLARON + exit 1, sin veredicto) se publica FAIL",
      codigo === 1 && /\| `exit=1` · 38\/39 \| FAIL \|/.test(f) && !/SIN VEREDICTO/.test(f) && !/EVIDENCIA: PASS/.test(salida),
      f,
    );
  }

  // --- H2a · el veredicto se lee de stdout, no de la concatenación -----------
  // `stdout + "\n" + stderr` ponía stderr siempre al final: una línea de stderr
  // le ganaba al veredicto real por orden de concatenación, no cronológico. Se
  // planta en la dirección que discrimina de verdad: el veredicto legítimo vive
  // en stdout (forma de ÉXITO real: `Ciclo ingreso/salida: PASS`, exit 0) y el
  // ruido de stderr dice FAIL. Concatenando, el ruido gana y el generador marca
  // un CONTRADICTORIO que no existe.
  {
    const dir = arbol({
      guiones: {
        "verificar:citas": talon("17/17 comprobaciones PASS\nCiclo ingreso/salida: PASS\n", {
          stderr: "aviso del driver: FAIL\n",
        }),
      },
    });
    const { codigo, salida } = correr(dir, ["--actualizar"]);
    comprobar(
      "H2a · una línea de stderr no le roba el veredicto al stdout legítimo",
      codigo === 0 && /· 17\/17 \| PASS \|/.test(fila(salida, "verificar:citas")) && !/CONTRADICTORIO/.test(salida),
      fila(salida, "verificar:citas"),
    );
  }

  // --- H2b · una línea de DETALLE indentada no es un veredicto ---------------
  // Sobre la forma real de fallo: si el detalle indentado ganara, la fila diría
  // PASS con exit=1 → CONTRADICTORIO en vez de FAIL. Exigir `| FAIL |` exacto
  // discrimina las dos versiones rotas: la que lee el detalle indentado y la que
  // ignora `FALLARON:`.
  {
    const dir = arbol({
      guiones: {
        "verificar:citas": talonFalla({ recuento: "1/2", extra: "    tarifa nocturna calculada: PASS" }),
      },
    });
    const { codigo, salida } = correr(dir);
    const f = fila(salida, "verificar:citas");
    comprobar(
      'H2b · una línea indentada terminada en ": PASS" no se toma como veredicto',
      codigo === 1 && /\| FAIL \|/.test(f) && !/CONTRADICTORIO/.test(f) && !/EVIDENCIA: PASS/.test(salida),
      f,
    );
  }

  // --- H2c · exit≠0 no puede rendir PASS -------------------------------------
  {
    const dir = arbol({
      guiones: { "verificar:citas": talon("VERIFICADOR REAL: PASS\n", { exit: 1 }) },
    });
    const { codigo, salida } = correr(dir);
    comprobar(
      "H2c · un PASS impreso con exit=1 se marca CONTRADICTORIO y hace fallar",
      codigo === 1 && /CONTRADICTORIO/.test(salida) && !/EVIDENCIA: PASS/.test(salida),
      fila(salida, "verificar:citas"),
    );
  }

  // --- H3 · desbordar maxBuffer no rinde veredicto ---------------------------
  // 33 MB de ruido y después el FAIL real: la salida llega truncada, y antes se
  // leía el veredicto del pedazo que sí entró.
  {
    const dir = arbol({
      guiones: {
        // El ruido lleva adentro líneas que PARECEN veredicto, que es lo que
        // hace peligrosa la truncadura: el lector se queda con la última que
        // alcanzó a entrar, y esa dice PASS.
        "verificar:citas": [
          'const linea = "paso intermedio: PASS\\n";',
          "process.stdout.write(linea.repeat(Math.ceil((33 * 1024 * 1024) / linea.length)));",
          // La forma real de cierre: recuento + FALLARON, sin línea de veredicto.
          'process.stdout.write("\\n1/2 comprobaciones PASS\\nFALLARON: la comprobación real\\n");',
          "process.exitCode = 1;",
          "",
        ].join("\n"),
      },
    });
    const { codigo, salida } = correr(dir);
    // La forma exacta del desborde varía —ENOBUFS, señal, o stdout vacío—, así
    // que se exige la propiedad y no el mensaje: de una salida truncada NO sale
    // un PASS. Antes salía: veredicto PASS, `EVIDENCIA: PASS`, exit 0.
    comprobar(
      "H3 · una salida que desborda la captura nunca rinde PASS",
      codigo === 1 && !/EVIDENCIA: PASS/.test(salida) && !/\| PASS \|/.test(fila(salida, "verificar:citas")),
      fila(salida, "verificar:citas"),
    );
  }

  // --- H7 · un verificador colgado se corta y se reporta ---------------------
  {
    const dir = arbol({
      guiones: { "verificar:citas": "setTimeout(() => process.exit(0), 3000);\n" },
    });
    const inicio = Date.now();
    const { codigo, salida } = correr(dir, ["--timeout=700"]);
    const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
    comprobar(
      "H7 · un verificador colgado se corta por timeout y no queda en silencio",
      codigo === 1 && /tiempo agotado/.test(salida) && !/EVIDENCIA: PASS/.test(salida),
      `exit=${codigo} · ${segundos}s`,
    );
  }

  // --- H4 · procedencia desconocida no es procedencia limpia -----------------
  // git fuera del PATH y el repo REALMENTE sucio: antes estampaba "árbol limpio".
  {
    const dir = arbol({ sucio: true });
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
      if (/^path$/i.test(k)) env[k] = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
    }
    const { codigo, salida } = correr(dir, [], env);
    comprobar(
      'H4 · sin git, el bloque NO dice "árbol limpio" y el generador falla',
      codigo === 1 && /procedencia desconocida/.test(salida) && !/· árbol limpio/.test(salida),
      `exit=${codigo}`,
    );
  }

  // --- H5 · marcadores ambiguos: no se escribe -------------------------------
  // El marcador citado en prosa antes del bloque hacía que --actualizar
  // inyectara el bloque DENTRO de la frase y se declarara PASS.
  {
    const state = [
      "# STATE fixture",
      "",
      "El mecanismo busca <!-- EVIDENCIA:INICIO --> y <!-- EVIDENCIA:FIN --> para saber qué reescribir.",
      "",
      BLOQUE_FIXTURE,
      "",
    ].join("\n");
    const dir = arbol({ state });
    const antes = readFileSync(join(dir, "STATE.md"), "utf8");
    const { codigo, salida } = correr(dir, ["--actualizar"]);
    const despues = readFileSync(join(dir, "STATE.md"), "utf8");
    comprobar(
      "H5 · con el marcador duplicado no se escribe el destino y se falla",
      codigo === 1 && /exactamente un par de marcadores/.test(salida) && antes === despues,
      antes === despues ? `exit=${codigo}` : "EL DESTINO FUE MODIFICADO",
    );
  }

  // --- H6 · una corrida de cero comandos no es evidencia ---------------------
  {
    const dir = arbol();
    const antes = readFileSync(join(dir, "STATE.md"), "utf8");
    const { codigo, salida } = correr(dir, ["--grupo=", "--actualizar"]);
    const despues = readFileSync(join(dir, "STATE.md"), "utf8");
    comprobar(
      "H6 · --grupo= vacío falla y no sobrescribe los destinos",
      codigo === 1 && !/EVIDENCIA: PASS/.test(salida) && antes === despues,
      antes === despues ? `exit=${codigo}` : "EL DESTINO FUE SOBRESCRITO CON UN BLOQUE VACÍO",
    );
  }

  // --- H9 · lo publicado tiene que ser lo medido -----------------------------
  //
  // El diseño anterior comparaba PROCEDENCIA (`git diff <sello> HEAD`) y por eso
  // no ataba el contenido a ninguna corrida. Los tres bloqueantes reproducidos
  // por el auditor, y las propiedades que los reemplazan, van acá abajo.

  // B-1 · el bloque tecleado con la cadena literal `HEAD`: `git diff HEAD HEAD`
  // es vacío para siempre, así que publicaba lo que quisiera y daba verde.
  {
    const dir = arbol();
    fabricarBloque(dir, {
      sello: "HEAD",
      filas: [
        "| `npm run verificar:endurecimiento` | `exit=0` · 30/30 | PASS |  |",
        "| `npm run verificar:citas` | `exit=0` · 17/17 | PASS |  |",
      ],
    });
    const { codigo, salida } = correr(dir);
    comprobar(
      "H9/B-1 · un sello con la cadena literal `HEAD` no pasa la procedencia",
      codigo === 1 && /no es un SHA/.test(salida) && !/EVIDENCIA: PASS/.test(salida),
      `exit=${codigo}`,
    );
  }

  // B-2 · el bloque VIVE dentro de los destinos, y los destinos estaban exentos
  // de la comparación: fabricarlo con un sello real y commitear solo los
  // destinos daba `git diff` vacío y árbol limpio. Acá el sello es el HEAD de
  // verdad —la procedencia está impecable— y aun así tiene que fallar, porque
  // publica PASS de comandos que nadie corrió.
  {
    const dir = arbol();
    fabricarBloque(dir, {
      sello: cabeza(dir),
      filas: NOMBRES.map((n) => `| \`npm run ${n}\` | \`exit=0\` · 30/30 | PASS |  |`),
    });
    const { codigo, salida } = correr(dir);
    comprobar(
      "H9/B-2 · un bloque fabricado con sello válido que publica PASS no medido falla",
      codigo === 1 &&
        /lo publicado coincide con lo que esta corrida midió/.test(salida) &&
        /30\/30/.test(salida) &&
        !/EVIDENCIA: PASS/.test(salida),
      `exit=${codigo}`,
    );
  }

  // B-3 · un archivo suelto sin commitear fuera de los destinos tumbaba la
  // corrida entera: rojo permanente en desarrollo normal. La regla se eliminó;
  // lo que decide es el contenido, y el contenido acá está bien.
  {
    const dir = arbol();
    correr(dir, ["--actualizar"]);
    commitear(dir, "bloque regenerado");
    writeFileSync(join(dir, "trabajo-en-curso.mjs"), "// edición normal, sin commitear\n", "utf8");
    const { codigo, salida } = correr(dir);
    comprobar(
      "H9/B-3 · un archivo sin commitear fuera de los destinos ya no tumba la corrida",
      codigo === 0 && /EVIDENCIA: PASS/.test(salida),
      `exit=${codigo}`,
    );
  }

  // El criterio tiene que ser SATISFACIBLE: tras `--actualizar` y el commit, la
  // corrida siguiente con los mismos grupos sigue verde. Un criterio que no
  // puede estar verde en operación normal se termina apagando.
  {
    const dir = arbol();
    const primera = correr(dir, ["--actualizar"]);
    commitear(dir, "bloque regenerado");
    const { codigo, salida } = correr(dir);
    comprobar(
      "H9 · tras --actualizar y commitear, volver a correr los mismos grupos da verde",
      primera.codigo === 0 && codigo === 0 && /EVIDENCIA: PASS/.test(salida),
      `regeneración exit=${primera.codigo} · relectura exit=${codigo}`,
    );
  }

  // Un subconjunto distinto de grupos no puede inventar un FAIL por las filas
  // que esta corrida no midió: se saltan, y el detalle dice cuántas.
  {
    const dir = arbol();
    const completa = correr(dir, ["--actualizar", "--todos"]);
    commitear(dir, "bloque de todos los grupos");
    const { codigo, salida } = correr(dir, ["--grupo=estatico"]);
    comprobar(
      "H9 · correr un subconjunto de grupos no inventa FAIL por las filas no medidas",
      completa.codigo === 0 && codigo === 0 && /saltada\(s\)/.test(salida) && /EVIDENCIA: PASS/.test(salida),
      (salida.split("\n").find((l) => /fila\(s\) comparadas/.test(l)) ?? `exit=${codigo}`).trim(),
    );
  }

  // El desfase real que todo esto existe para cazar: el recuento de un
  // verificador cambió después de publicar el bloque. Es exactamente lo que pasó
  // con `verificar:esquema 4/4` cuando ya daba 8/8.
  {
    const dir = arbol({
      guiones: { "verificar:citas": talon("17/17 comprobaciones PASS\nCITAS: PASS\n") },
    });
    correr(dir, ["--actualizar"]);
    commitear(dir, "bloque con 17/17");
    writeFileSync(rutaTalon(dir, "verificar:citas"), talon("18/18 comprobaciones PASS\nCITAS: PASS\n"), "utf8");
    commitear(dir, "el verificador ahora comprueba una más");
    const { codigo, salida } = correr(dir);
    comprobar(
      "H9 · un recuento que cambió desde que se publicó el bloque se caza",
      codigo === 1 && /verificar:citas: publicado .*17\/17.* ≠ medido .*18\/18/.test(salida) && !/EVIDENCIA: PASS/.test(salida),
      (salida.split("\n").find((l) => /publicado/.test(l)) ?? `exit=${codigo}`).trim(),
    );
  }

  // --- H8 · el generador está bajo el guard de verificadores -----------------
  {
    const r = spawnSync(process.execPath, [GUARD], { cwd: RAIZ, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    comprobar(
      "H8 · verificar:verificadores alcanza a evidencia.mjs y a esta prueba",
      /evidencia\.mjs · imprime un veredicto final/.test(salida) &&
        /evidencia\.prueba\.mjs · imprime un veredicto final/.test(salida),
      `exit=${r.status}`,
    );
  }

  // --- Control negativo: lo que NO debe disparar -----------------------------
  // Un verificador legítimo imprime líneas de comprobación que terminan en
  // ": PASS", detalles indentados, y un veredicto con acentos y barra. Nada de
  // eso puede confundirse con una contradicción ni perderse.
  {
    const dir = arbol({
      guiones: {
        "verificar:citas": talon(
          [
            "PASS · la patente citada: PASS",
            "    detalle indentado: PASS",
            "",
            "17/17 comprobaciones PASS",
            "Ciclo ingreso/salida: PASS",
            "",
          ].join("\n"),
        ),
      },
    });
    const { codigo, salida } = correr(dir, ["--actualizar"]);
    comprobar(
      "control · una salida legítima con acentos, detalles y recuento da PASS",
      codigo === 0 && /· 17\/17 \| PASS \|/.test(fila(salida, "verificar:citas")),
      fila(salida, "verificar:citas"),
    );
  }
} finally {
  for (const d of temporales) {
    try {
      rmSync(d, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      /* la limpieza no decide el veredicto */
    }
  }
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("GENERADOR DE EVIDENCIA PROBADO CON EL FALLO PLANTADO: PASS");
