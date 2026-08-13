/**
 * Verificación de INT-12 contra la app corriendo: la versión del build llega
 * hasta el nombre de los cachés del service worker.
 *
 * **Por qué existe aparte.** El check de INT-12 dentro de
 * `verificar-endurecimiento.mjs` dio PASS sobre producción con el caché llamado
 * `estacionamiento-shell-sin-version`: exigía que el nombre no fuera el literal
 * `v1` y que empezara con el prefijo, y las dos cosas eran ciertas con la
 * versión vacía. El defecto original —un nombre estable entre deploys, así que
 * `activate` no purga nada— estaba de vuelta y el verificador no lo veía.
 * Aquel check se corrigió; este mira además lo que aquel no podía mirar:
 *
 *   1. la versión con la que se registra el worker no es vacía ni degenerada;
 *   2. TODOS los cachés terminan en esa misma versión (cliente y worker de
 *      acuerdo: si el nombre no deriva de la query, la purga no se dispara);
 *   3. el propio worker rechaza que le pasen una versión vacía. Se prueba de
 *      verdad, registrando `/sw.js?v=` en un contexto de navegador limpio, no
 *      leyendo el fuente;
 *   4. **si el artefacto cambió, la versión cambió.** Es la propiedad de la que
 *      depende la purga y la que faltaba.
 *
 * **Por qué (4) no puede ser un flag opcional.** En la primera versión de este
 * script la comparación con el deploy anterior dependía de `--anterior=`: sin el
 * flag imprimía una NOTA y salía 0. Un verificador que pasa cuando no mira no es
 * una red, y de hecho no atrapó que la versión salía del SHA del commit —dos
 * deploys del mismo commit, misma versión, `activate` sin nada que purgar—.
 *
 * **Segunda corrección, tras el segundo veto del auditor.** La versión anterior
 * de este script calculaba la huella del artefacto sobre la **lista de nombres**
 * de los assets, y guardaba un booleano `transicionVerificada`. Las dos cosas
 * estaban mal, y de la misma manera:
 *
 *   - Los chunks de Turbopack son direccionables por contenido y la versión
 *     viaja inlineada en uno de ellos: **la lista de nombres cambiaba porque
 *     cambiaba la versión.** El check era circular — no podía distinguir "el
 *     mismo deploy mirado dos veces" de "dos deploys con la versión constante",
 *     que es INT-12 exacto.
 *   - El veredicto se leía de un booleano guardado en un JSON gitignoreado.
 *     Editarlo a mano —sin deploy, sin rebuild, sin un cambio de código— daba
 *     PASS. Un gate que se falsifica con una palabra no es un gate.
 *
 * El acoplamiento entre huella y versión resultó **imposible de eliminar**: el
 * minificador de Turbopack no es determinista, así que ni siquiera el contenido
 * de los chunks es estable entre dos builds del mismo fuente (ver
 * `huellaDelArtefacto`). Lo que se corrigió, entonces, no es el insumo sino el
 * **veredicto**, que ahora se deriva en cada corrida del historial de
 * observaciones `{artefacto, version}` y no depende de ninguna bandera:
 *
 *   misma versión, artefactos distintos  → FAIL. **El bypass**: código nuevo con
 *       nombre de caché viejo. Esta dirección es válida con acoplamiento o sin
 *       él, porque acá la versión NO cambió y el artefacto sí.
 *   versiones distintas en dos deploys   → PASS. Dos deploys, dos cachés.
 *   una sola observación                 → FAIL. No se pudo concluir, que no es
 *       lo mismo que esté bien.
 *
 * Mirar el mismo deploy dos veces no aporta nada y no puede otorgar un PASS:
 * agrega una observación repetida y el veredicto sigue siendo "no concluí".
 *
 * Las observaciones se acumulan y **nunca se borran**: la evidencia de una
 * violación no puede evaporarse con un reintento. Un historial ilegible no se
 * pisa, se reporta — pisarlo destruía la evidencia ganada, y ya pasó una vez
 * por un BOM.
 *
 * Sin base y sin sesión: el worker se registra desde el layout raíz, así que
 * alcanza con cargar la URL aunque redirija al login. Sirve igual contra local
 * y contra producción.
 *
 * Uso:  node scripts/verificar-int12.mjs [url] [--anterior=<versión>]
 *       npm run verificar:int12 -- [url]
 * Requiere el servidor levantado (`npm run build && npm start`) o una URL viva.
 * Sale con código 0 si todo PASA, 1 si algo FALLA.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

// El mismo saneo y el mismo hash que usa el build. Importarlos, y no
// reescribirlos, es lo que hace que el verificador no pueda "estar de acuerdo"
// con un bug del módulo.
import { huellaCorta, sanearVersion, VERSION_DEGRADADA } from "../src/lib/version-app.ts";

const argumentos = process.argv.slice(2);
const URL_BASE = argumentos.find((a) => !a.startsWith("--")) ?? "http://localhost:3000";
const ANTERIOR = argumentos.find((a) => a.startsWith("--anterior="))?.split("=").slice(1).join("=");

const DIR_ESTADO = join(dirname(fileURLToPath(import.meta.url)), "estado");
const ARCHIVO_ESTADO = join(DIR_ESTADO, "int12-artefactos.json");

/**
 * Historial por origen. Devuelve `{ estado }` o `{ error }`.
 *
 * **Ausente y corrupto no son lo mismo, y confundirlos ya costó caro.** La
 * versión anterior se tragaba cualquier error de parseo y devolvía `{}`, que
 * aguas abajo era indistinguible de "primera corrida": el archivo entero se
 * reescribía y las líneas base de los otros orígenes desaparecían. Se reprodujo
 * con un BOM que metió PowerShell 5.1 — en un proyecto cuya historia entera de
 * INT-12 son BOMs y vacío-vs-ausente.
 *
 * Un archivo ilegible es un FAIL ruidoso, nunca un borrón silencioso.
 */
function leerEstado() {
  if (!existsSync(ARCHIVO_ESTADO)) return { estado: {} };
  try {
    // El BOM se saca a mano: `JSON.parse` no lo tolera y es exactamente la
    // forma en que este archivo se corrompió.
    const crudo = readFileSync(ARCHIVO_ESTADO, "utf8").replace(/^﻿/, "");
    const estado = JSON.parse(crudo);
    if (estado === null || typeof estado !== "object" || Array.isArray(estado)) {
      return { error: "el estado no es un objeto" };
    }
    return { estado };
  } catch (e) {
    return { error: String(e?.message ?? e) };
  }
}

/** Escribe SOLO el origen medido, sin tocar los demás. */
function guardarEstado(estado) {
  mkdirSync(DIR_ESTADO, { recursive: true });
  writeFileSync(ARCHIVO_ESTADO, `${JSON.stringify(estado, null, 2)}\n`, "utf8");
}

/**
 * Huella del ARTEFACTO servido: los nombres de los assets más el texto visible
 * del documento.
 *
 * **Lo que se intentó primero y no se pudo, porque importa para entender el
 * diseño.** El auditor señaló —con razón— que una huella basada en los nombres
 * está acoplada a la versión: los chunks de Turbopack son direccionables por
 * contenido y la versión viaja inlineada en uno de ellos, así que los nombres
 * cambian *porque* cambia la versión.
 *
 * Se intentó una huella independiente de la versión, hasheando el CONTENIDO de
 * los assets con la versión enmascarada. **No es posible: el minificador de
 * Turbopack no es determinista.** Dos builds del mismo fuente, medidos acá,
 * difieren en el renombrado de variables:
 *
 *     B: ...D=j[1][e],w=C.slots;(void 0===D||null===w)...let H=D[0],k=w[e]...
 *     C: ...D=j[1][e],k=C.slots;(void 0===D||null===k)...let w=D[0],H=k[e]...
 *
 * Así que el acoplamiento no se elimina; lo que se hace es **que no importe**,
 * cambiando el veredicto en vez del insumo (ver más abajo). La dirección que
 * detecta el bypass —misma versión con artefactos distintos— es válida con o sin
 * acoplamiento, porque ahí la versión NO cambió y el artefacto sí.
 *
 * Se agrega el texto visible del documento porque `/login` y `/` son
 * componentes de SERVIDOR: comprobado, cambiar su texto no movía ningún chunk
 * estático, y el verificador no habría visto ese deploy. Se toma solo el texto
 * —sin scripts ni etiquetas— porque el HTML crudo trae el nonce de la CSP, que
 * cambia en cada petición, y tokens por build como `turbopack-1m14ias-r6ul9`.
 */
async function huellaDelArtefacto(base, rutas) {
  if (rutas.length === 0) return { error: "el documento no referencia assets del build" };

  const soloTexto = (html) =>
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const primera = await fetch(new URL("/login", base));
  if (!primera.ok) return { error: `/login respondió HTTP ${primera.status}` };
  const uno = soloTexto(await primera.text());

  // Determinismo comprobado, no supuesto: dos peticiones al MISMO deploy tienen
  // que dar lo mismo, o la huella sería ruido entre corridas.
  const dos = soloTexto(await (await fetch(new URL("/login", base))).text());
  if (uno !== dos) {
    return { error: "el texto del documento no es determinista entre peticiones" };
  }

  return { huella: huellaCorta([...rutas].sort().join("|") + "|" + uno) };
}

const NAVEGADORES = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const navegador = NAVEGADORES.find((p) => existsSync(p));
if (!navegador) {
  console.error("FAIL · no se encontró un navegador Chromium. Definí CHROME_PATH.");
  process.exit(1);
}

const resultados = [];
function comprobar(nombre, ok, detalle) {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
}

// --- 0. Las dos copias de `sanearVersion` deciden lo mismo -------------------
// Fase estática, sin navegador ni red. El worker se sirve tal cual está en el
// repo y no puede importar del bundle, así que repite la función. Hasta ahora
// los comentarios de los dos archivos afirmaban que "el verificador comprueba
// que las dos copias coincidan" y NINGÚN verificador lo hacía: una red
// prometida y ausente, que es peor que no prometer nada. Esto la hace existir.
//
// Se compara comportamiento, no texto: se extrae la función del worker y se la
// corre contra la del módulo sobre un corpus. Dos implementaciones distintas que
// deciden igual están bien; dos textos iguales que deciden distinto -por una
// bandera de regex, por ejemplo- no se detectarían mirando el fuente.
{
  const rutaSw = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sw.js");
  let sanearDelWorker = null;
  let motivo = "";

  try {
    const fuente = readFileSync(rutaSw, "utf8");
    const bloque = fuente.match(/function sanearVersion\(valor\)\s*\{[\s\S]*?\n\}/);
    if (!bloque) {
      motivo = "no se encontró `function sanearVersion(valor)` en public/sw.js";
    } else {
      // Se evalúa código del propio repo, en un script de verificación que no
      // corre en producción ni toca la app.
      sanearDelWorker = new Function(`${bloque[0]}; return sanearVersion;`)();
    }
  } catch (e) {
    motivo = String(e?.message ?? e);
  }

  comprobar("se pudo extraer sanearVersion de public/sw.js", sanearDelWorker !== null, motivo);

  if (sanearDelWorker) {
    // Corpus: los casos que ya fallaron, los bordes del saneo, y ruido
    // pseudoaleatorio con semilla fija para que la corrida sea reproducible.
    const corpus = [
      "", " ", "\t\n", "v1", "V1", "sin-version", "degradado", "undefined", "null", "NULL",
      "a1b2c3d4e5f6", "dpl_9xKq2", "ad63b7e-9xKq2mZ", "proyecto-abc.vercel.app",
      "rama/feature 1", "---", "...", "..a..", "-a-", "@@@", "x".repeat(41), "x".repeat(40),
      `${String.fromCharCode(0xfeff)}a1b2c3`, `a1b2c3${String.fromCharCode(0x200b)}`,
      "ÁÉÍÓÚ", "версия", "🚗", "a".repeat(39) + "-b", "0", "00", "-",
    ];
    let semilla = 20260813;
    const alfabeto = " -_.aZ09/@\t​﻿áx";
    for (let i = 0; i < 4000; i++) {
      let s = "";
      const largo = semilla % 45;
      for (let j = 0; j <= largo; j++) {
        semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
        s += alfabeto[semilla % alfabeto.length];
      }
      corpus.push(s);
    }

    const divergencias = [];
    for (const entrada of corpus) {
      const aqui = sanearVersion(entrada);
      const alla = sanearDelWorker(entrada);
      if (aqui !== alla) {
        divergencias.push(`${JSON.stringify(entrada)}: módulo=${JSON.stringify(aqui)} worker=${JSON.stringify(alla)}`);
      }
    }

    comprobar(
      "las dos copias de sanearVersion deciden lo mismo",
      divergencias.length === 0,
      divergencias.length
        ? `${divergencias.length}/${corpus.length} divergen · ${divergencias.slice(0, 3).join(" | ")}`
        : `${corpus.length} entradas, 0 divergencias`,
    );

    // Y que el worker caiga en la MISMA marca degradada que usa el cliente: si
    // cada extremo inventa la suya, el nombre del caché deja de ser predecible.
    const fuente = readFileSync(rutaSw, "utf8");
    comprobar(
      "el worker usa la misma marca degradada que el módulo",
      new RegExp(`\\?\\?\\s*"${VERSION_DEGRADADA}"`).test(fuente),
      VERSION_DEGRADADA,
    );
  }
}

/** Espera a que aparezca algún caché del proyecto, sin colgarse si no aparece. */
async function esperarCaches(page, limiteMs = 20_000) {
  const hasta = Date.now() + limiteMs;
  let nombres = [];
  while (Date.now() < hasta) {
    nombres = await page.evaluate(() => caches.keys());
    if (nombres.some((n) => n.startsWith("estacionamiento-"))) return nombres;
    await new Promise((r) => setTimeout(r, 500));
  }
  return nombres;
}

const browser = await puppeteer.launch({
  executablePath: navegador,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  // --- 1. El camino normal ---------------------------------------------------
  const page = await browser.newPage();
  await page.goto(URL_BASE, { waitUntil: "networkidle2" });

  // `serviceWorker.ready` no rechaza nunca: si la app no hidrata, el registro no
  // ocurre y la promesa queda colgada para siempre. Sin esta cota, el verificador
  // muere por timeout de protocolo a mitad de corrida en vez de reportar el FAIL
  // -que es la forma exacta de mentir hacia el lado optimista que documenta
  // `verificar-verificadores.mjs`.
  const registro = await page.evaluate(async () => {
    const reg = await Promise.race([
      navigator.serviceWorker.ready.catch(() => null),
      new Promise((r) => setTimeout(() => r(null), 15_000)),
    ]);
    return { script: reg?.active?.scriptURL ?? null };
  });

  const enUrl = registro.script
    ? new URL(registro.script).searchParams.get("v")
    : null;
  const version = sanearVersion(enUrl);

  comprobar(
    "el worker se registra con una versión utilizable en la URL",
    version !== null,
    `script=${registro.script ?? "sin worker"} · v=${JSON.stringify(enUrl)}`,
  );

  const nombres = await esperarCaches(page);
  const mios = nombres.filter((n) => n.startsWith("estacionamiento-"));

  comprobar("hay cachés del proyecto que revisar", mios.length > 0, nombres.join(", ") || "ninguno");

  // El corazón del hallazgo: el nombre tiene que DERIVAR de la versión. Si no
  // deriva, un deploy nuevo reusa el caché del anterior y `activate` no purga.
  comprobar(
    "todos los cachés terminan exactamente en esa versión",
    version !== null && mios.length > 0 && mios.every((n) => n.endsWith(`-${version}`)),
    mios.join(", ") || "sin cachés",
  );

  // Lo que dejó pasar la regresión, dicho como lo que es.
  const sospechosos = mios.filter((n) => {
    const sufijo = n.replace(/^estacionamiento-(shell|estaticos)-?/, "");
    return sanearVersion(sufijo) === null;
  });
  comprobar(
    "ningún caché nombrado con una versión vacía o degenerada",
    sospechosos.length === 0,
    sospechosos.join(", ") || mios.join(", "),
  );

  // --- 2. Si el artefacto cambió, la versión cambió --------------------------
  // La huella sale de los assets que referencia el documento: son los que el
  // navegador ejecuta, y los que quedan clavados en el caché cuando `activate`
  // no purga. Se leen del DOM y del payload de flight, que es donde viajan los
  // chunks que el HTML todavía no pidió.
  const assets = await page.evaluate(() => {
    const urls = new Set();
    for (const el of document.querySelectorAll("script[src], link[href]")) {
      const u = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
      if (u.includes("/_next/static/")) urls.add(u);
    }
    for (const u of document.documentElement.innerHTML.match(/\/_next\/static\/[\w./-]+/g) ?? []) {
      urls.add(u);
    }
    return [...urls].sort();
  });

  const { huella, error: errorHuella } = await huellaDelArtefacto(URL_BASE, assets);
  comprobar(
    "se pudo identificar el artefacto servido",
    Boolean(huella),
    huella ? `${assets.length} assets · artefacto=${huella}` : (errorHuella ?? "no se pudo identificar"),
  );

  const { estado, error: errorEstado } = leerEstado();

  // Un estado ilegible no se pisa: se reporta. Pisarlo destruía la evidencia
  // ganada, que es justo lo contrario de para lo que existe el archivo.
  comprobar(
    "el historial de este verificador es legible",
    !errorEstado,
    errorEstado ? `${ARCHIVO_ESTADO}: ${errorEstado} · no se sobrescribe: revisalo o borralo a mano` : "",
  );

  /**
   * El veredicto se DERIVA del historial, no se lee de una bandera.
   *
   * La versión anterior guardaba `transicionVerificada: true/false`, y ese
   * booleano era toda la red: editarlo a mano en un JSON —gitignoreado, sin
   * deploy, sin rebuild, sin un cambio de código— daba 12/12 PASS. Un gate que
   * se falsifica con una palabra no es un gate.
   *
   * Ahora se guardan OBSERVACIONES `{artefacto, version}` y cada corrida
   * recalcula el veredicto sobre el conjunto:
   *
   *   - **VIOLACIÓN**: dos observaciones con artefacto distinto y la MISMA
   *     versión. Es INT-12 textual: el navegador no ve un script distinto, no
   *     instala worker nuevo, `activate` no corre, el shell viejo sobrevive.
   *     Esta dirección es válida aunque la huella esté acoplada a la versión,
   *     porque acá la versión es justamente la que NO cambió.
   *   - **PRUEBA**: dos deploys distintos con versiones distintas.
   *   - Sin ninguna de las dos: no se puede concluir, y eso es FAIL.
   *
   * Mirar el mismo deploy dos veces produce una observación repetida, que no
   * agrega artefactos ni versiones: no puede otorgar un PASS.
   */
  const previas = Array.isArray(estado[URL_BASE]?.observaciones)
    ? estado[URL_BASE].observaciones.filter(
        (o) => o && typeof o.artefacto === "string" && typeof o.version === "string",
      )
    : [];

  const actual = { artefacto: huella, version, visto: new Date().toISOString() };
  const todas = huella && version ? [...previas, actual] : previas;

  const violacion = todas.find((a) =>
    todas.some((b) => a.artefacto !== b.artefacto && a.version === b.version),
  );

  const versiones = new Set(todas.map((o) => o.version));
  const artefactos = new Set(todas.map((o) => o.artefacto));

  let ok;
  let detalle;

  if (violacion) {
    ok = false;
    const otra = todas.find((b) => b.artefacto !== violacion.artefacto && b.version === violacion.version);
    detalle =
      `MISMA VERSIÓN CON OTRO ARTEFACTO: ${violacion.version} sirvió ${violacion.artefacto} ` +
      `y también ${otra.artefacto}. El worker no se reinstala y activate no purga.`;
  } else if (versiones.size >= 2 && artefactos.size >= 2) {
    ok = true;
    const lista = [...versiones];
    detalle =
      `${artefactos.size} artefactos distintos con ${versiones.size} versiones distintas, ninguna repetida: ` +
      `${lista[lista.length - 2]} → ${lista[lista.length - 1]}. Cada deploy renombra el caché.`;
  } else {
    ok = false;
    detalle =
      `${todas.length} observación/es para ${URL_BASE} (${artefactos.size} artefacto/s, ${versiones.size} versión/es): ` +
      "hace falta ver este origen en dos deploys distintos. Volvé a correrlo después del próximo deploy; " +
      "no pude comprobarlo, que no es lo mismo que esté bien.";
  }

  comprobar("dos deploys nunca comparten versión (INT-12)", ok, detalle);

  // Se acumulan observaciones. **Nunca se borra una que ya está**: la evidencia
  // de una violación no puede evaporarse con un reintento. Solo se toca el
  // origen medido, y solo si el historial se pudo leer.
  if (huella && version && !errorEstado) {
    const yaEsta = previas.some((o) => o.artefacto === huella && o.version === version);
    estado[URL_BASE] = {
      assets: assets.length,
      observaciones: yaEsta ? previas : [...previas, actual].slice(-20),
    };
    guardarEstado(estado);
  }

  // Comprobación extra y explícita, para cuando quien corre esto ya sabe qué
  // versión servía el deploy anterior. Nunca reemplaza a la de arriba.
  if (ANTERIOR !== undefined) {
    comprobar(
      "la versión cambió respecto de la indicada en --anterior",
      version !== null && version !== ANTERIOR,
      `anterior=${ANTERIOR} · ahora=${version ?? "(inválida)"}`,
    );
  }

  // --- 3. El worker no acepta una versión vacía ------------------------------
  // Contexto de navegador aparte: registro propio de workers y de cachés, así
  // que registrar el worker degradado no ensucia lo medido arriba.
  const contexto = await browser.createBrowserContext();
  try {
    const limpia = await contexto.newPage();

    // **No se carga la app acá.** Cargar `/` hidrata `RegistrarServiceWorker`,
    // que registra `/sw.js?v=<real>` y arranca un `install` que abre
    // `estacionamiento-shell-<real>` y baja el shell. Aunque se desregistre y se
    // borren los cachés a continuación, ese `install` en vuelo puede recrear el
    // caché de la versión real DESPUÉS del borrado, y la comprobación falla por
    // una carrera y no por un defecto. El manifiesto es del mismo origen -así
    // que puede registrar un worker con scope "/"- y no ejecuta la app.
    await limpia.goto(new URL("/manifest.webmanifest", URL_BASE).href, {
      waitUntil: "domcontentloaded",
    });

    const degradado = await limpia.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { registro: false, motivo: "API ausente" };

      const previos = await navigator.serviceWorker.getRegistrations();
      await Promise.all(previos.map((r) => r.unregister()));
      const claves = await caches.keys();
      await Promise.all(claves.map((k) => caches.delete(k)));

      try {
        await navigator.serviceWorker.register("/sw.js?v=", { scope: "/" });
        return { registro: true, previos: previos.length };
      } catch (e) {
        return { registro: false, motivo: String(e?.message ?? e) };
      }
    });

    // Si esto no es 0, la página eligió registrar algo por su cuenta y la
    // comprobación de abajo no estaría midiendo lo que dice medir.
    comprobar(
      "la página usada para la prueba degradada no registra workers por su cuenta",
      degradado.registro === false || degradado.previos === 0,
      `registros preexistentes: ${degradado.previos ?? "n/d"}`,
    );

    const trasDegradado = degradado.registro ? await esperarCaches(limpia) : [];
    const suyos = trasDegradado.filter((n) => n.startsWith("estacionamiento-"));

    comprobar(
      "con la versión vacía el worker no nombra un caché a medio nombre",
      degradado.registro &&
        suyos.length > 0 &&
        suyos.every((n) => n.endsWith(`-${VERSION_DEGRADADA}`)),
      degradado.registro ? suyos.join(", ") || "no creó cachés" : degradado.motivo,
    );

    // Que se degrade no puede costar el offline: el shell se sigue precargando.
    comprobar(
      "y aun degradado sigue precargando el shell (offline no es opcional)",
      suyos.some((n) => n.startsWith("estacionamiento-shell-")),
      suyos.join(", ") || "sin caché de shell",
    );
  } finally {
    await contexto.close();
  }
} catch (e) {
  // Un verificador que se muere miente hacia el lado optimista: lo que se rompe
  // es un FAIL con evidencia, no una corrida que termina sin decir nada.
  comprobar("la corrida completó sin excepción", false, String(e?.message ?? e).split("\n")[0]);
} finally {
  await browser.close();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("INT-12: PASS");
