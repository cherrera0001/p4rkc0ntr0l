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
 * Para no depender de que alguien recuerde el valor anterior, el script calcula
 * una **huella del artefacto servido**: la lista ordenada de assets
 * `/_next/static/**` que referencia el documento. Si esa huella cambia, el
 * cliente que se ejecuta es otro y la versión TIENE que haber cambiado. La
 * huella y la versión se guardan por origen en `scripts/estado/`, así que la
 * comparación se hace sola en la corrida siguiente.
 *
 * Las cuatro combinaciones, y por qué cada veredicto:
 *
 *   artefacto ≠ , versión ≠   → PASS. Deploy nuevo, caché nuevo, `activate` purga.
 *   artefacto ≠ , versión =   → FAIL. **El bypass**: código nuevo, nombre viejo.
 *   artefacto = , versión ≠   → PASS. Redeploy del mismo código; la invariante
 *                               es de una dirección sola.
 *   artefacto = , versión =   → PASS solo si alguna vez se observó la transición
 *                               para este origen. Si no, no se probó nada.
 *
 * La primera corrida contra un origen no tiene con qué comparar: registra la
 * línea base y **falla**, porque "no pude comprobarlo" no es "está bien".
 *
 * **La línea base no se reescribe cuando la comprobación falla.** Guardarla en
 * el FAIL dejaba al deploy roto como referencia, y la corrida siguiente —o un
 * reintento de CI— comparaba B contra B y daba PASS: el verificador borraba la
 * falla que existe para detectar.
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

/** Historial por origen: qué versión servía qué artefacto. */
function leerEstado() {
  try {
    return JSON.parse(readFileSync(ARCHIVO_ESTADO, "utf8"));
  } catch {
    return {};
  }
}

function guardarEstado(estado) {
  mkdirSync(DIR_ESTADO, { recursive: true });
  writeFileSync(ARCHIVO_ESTADO, `${JSON.stringify(estado, null, 2)}\n`, "utf8");
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

  const huella = assets.length > 0 ? huellaCorta(assets.join("|")) : null;
  comprobar(
    "se pudo identificar el artefacto servido",
    huella !== null,
    huella ? `${assets.length} assets · huella=${huella}` : "el documento no referencia assets del build",
  );

  const estado = leerEstado();
  const previo = estado[URL_BASE];

  // `transicionVerificada` recuerda si alguna vez se OBSERVÓ, para este origen,
  // que un artefacto nuevo trajo una versión nueva. Sin eso, "artefacto igual y
  // versión igual" no prueba nada: es el mismo deploy mirado dos veces, y podría
  // ser un deploy roto que nunca comparamos con otro.
  let ok;
  let detalle;

  if (!previo) {
    ok = false;
    detalle =
      `sin línea base para ${URL_BASE}: se registró esta observación (artefacto=${huella} versión=${version}). ` +
      "Volvé a correrlo después del próximo deploy; no pude comprobarlo, que no es lo mismo que esté bien.";
  } else if (previo.huella !== huella) {
    // El bypass: artefacto nuevo con la misma versión. Es INT-12 exacto -el
    // navegador no ve un script distinto, no instala worker nuevo, `activate`
    // no corre y el shell viejo sobrevive.
    ok = previo.version !== version;
    detalle =
      `artefacto ${previo.huella} → ${huella} · versión ${previo.version} → ${version}` +
      (ok ? "" : " · MISMA VERSIÓN CON OTRO CÓDIGO: activate no purga");
  } else if (previo.version !== version) {
    // Mismo artefacto y versión nueva: es un *Redeploy* del mismo código, o un
    // rebuild local. La invariante es de una sola dirección -si el artefacto
    // cambió, la versión cambió-, no de las dos: una versión nueva sobre código
    // idéntico solo hace que el worker se reinstale y vuelva a cachear, que es
    // inofensivo. Marcarlo FAIL sería el verificador gritando por un deploy
    // sano, y un verificador que grita de más se termina ignorando.
    ok = true;
    detalle = `mismo artefacto (${huella}) con versión nueva ${previo.version} → ${version}: redeploy del mismo código`;
  } else {
    ok = previo.transicionVerificada === true;
    detalle = ok
      ? `mismo artefacto (${huella}) y misma versión (${version}): es el mismo deploy, y su transición ya se verificó`
      : `mismo artefacto (${huella}) y misma versión (${version}), pero para este origen nunca se observó un ` +
        "cambio de artefacto con cambio de versión. Corré esto después del próximo deploy.";
  }

  comprobar("si el artefacto cambió, la versión cambió", ok, detalle);

  // **La línea base se persiste solo si la comprobación pasó.** Guardarla
  // también en el FAIL era un agujero: el deploy roto quedaba como referencia y
  // la corrida siguiente -o un reintento de CI- comparaba B contra B y daba
  // PASS. El verificador borraba la falla que existe para detectar.
  if (huella && version && (ok || !previo)) {
    estado[URL_BASE] = {
      huella,
      version,
      visto: new Date().toISOString(),
      assets: assets.length,
      // Se marca verificada si esta corrida observó la transición (artefacto
      // nuevo con versión nueva), o si ya venía verificada. Un redeploy del
      // mismo código no la otorga: no probó nada sobre la purga.
      transicionVerificada:
        ok && Boolean(previo) && (previo.huella !== huella || previo.transicionVerificada === true),
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
