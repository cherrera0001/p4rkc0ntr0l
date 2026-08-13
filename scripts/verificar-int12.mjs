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
 *   4. opcional pero es la propiedad que importa: la versión CAMBIÓ respecto
 *      del deploy anterior. Como un verificador no puede recordar deploys, el
 *      valor anterior se pasa por argumento y se compara.
 *
 * Sin base y sin sesión: el worker se registra desde el layout raíz, así que
 * alcanza con cargar la URL aunque redirija al login. Sirve igual contra local
 * y contra producción.
 *
 * Uso:  node scripts/verificar-int12.mjs [url] [--anterior=<versión>]
 * Requiere el servidor levantado (`npm run build && npm start`) o una URL viva.
 * Sale con código 0 si todo PASA, 1 si algo FALLA.
 */

import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

// El mismo saneo que usa el build. Importarlo, y no reescribirlo, es lo que
// hace que el verificador no pueda "estar de acuerdo" con un bug del módulo.
import { sanearVersion, VERSION_DEGRADADA } from "../src/lib/version-app.ts";

const argumentos = process.argv.slice(2);
const URL_BASE = argumentos.find((a) => !a.startsWith("--")) ?? "http://localhost:3000";
const ANTERIOR = argumentos.find((a) => a.startsWith("--anterior="))?.split("=").slice(1).join("=");

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

  // --- 2. La versión cambia entre deploys (si hay con qué comparar) ----------
  if (ANTERIOR !== undefined) {
    comprobar(
      "la versión cambió respecto del deploy anterior",
      version !== null && version !== ANTERIOR,
      `anterior=${ANTERIOR} · ahora=${version ?? "(inválida)"}`,
    );
  } else {
    console.log(
      `NOTA · sin --anterior=<versión> no se comprueba el cambio entre deploys. Versión de este deploy: ${version ?? "(inválida)"}`,
    );
  }

  // --- 3. El worker no acepta una versión vacía ------------------------------
  // Contexto de navegador aparte: registro propio de workers y de cachés, así
  // que registrar el worker degradado no ensucia lo medido arriba.
  const contexto = await browser.createBrowserContext();
  try {
    const limpia = await contexto.newPage();
    await limpia.goto(URL_BASE, { waitUntil: "networkidle2" });

    const degradado = await limpia.evaluate(async () => {
      const previos = await navigator.serviceWorker.getRegistrations();
      await Promise.all(previos.map((r) => r.unregister()));
      const claves = await caches.keys();
      await Promise.all(claves.map((k) => caches.delete(k)));

      try {
        await navigator.serviceWorker.register("/sw.js?v=", { scope: "/" });
        return { registro: true };
      } catch (e) {
        return { registro: false, motivo: String(e?.message ?? e) };
      }
    });

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
