/**
 * Verificación de la maqueta `1l` — ingreso a pantalla completa.
 *
 * `docs/diseno-2026-08-12-traduccion.md:52` la deja DENTRO del gate ADR-001 y la
 * llama *«la mejor expresión de H1 del set»*. Este script comprueba que lo que
 * se construyó tenga las propiedades por las que se dijo eso, y no solamente que
 * exista una pantalla más.
 *
 * **Qué mide, y por qué cada cosa.**
 *
 *   1. El modo se queda con la pantalla: mientras se teclea, la ocupación y la
 *      lista de vehículos **no están en el DOM**. Es la propiedad que distingue a
 *      `1l` del formulario en línea que había antes, y se verifica por ausencia,
 *      no por la presencia de un contenedor con el nombre correcto.
 *   2. El campo llega con el foco puesto. Es un toque menos por vehículo, y H1 se
 *      mide en segundos.
 *   3. Objetivos táctiles grandes de verdad, medidos con `getBoundingClientRect`
 *      en el navegador: no alcanza con que la clase esté escrita.
 *   4. AC-UX-1 **dentro del modo**: si la señal se cae mientras se teclea, el
 *      estado de red se ve sin salir. La pantalla anterior ya lo mostraba; lo que
 *      acá se verifica es que el modo no lo haya dejado atrás.
 *   5. AC-UX-4: la normalización se dice en pantalla.
 *   6. Registro sin señal desde el modo, y el conteo de pendientes al reabrirlo.
 *   7. La instrumentación de H1 sigue viva: `tecleo_inicio_at` se marca al abrir
 *      y `tecleo_fin_at` al confirmar. Si el modo hubiera roto esa ventana, H1
 *      quedaría sin numerador y nadie se enteraría.
 *
 * **Lo que este verificador NO afirma.** No mide el tiempo de tecleo de una
 * persona: lo escribe un programa con `delay` fijo. Eso es interacción con la
 * interfaz, no operación real, y confundirlos sería el `6,2 s` inventado otra
 * vez. La métrica de H1 la publica `npm run verificar:h1`.
 *
 * Uso:  node scripts/verificar-ingreso.mjs [url]
 * Requiere el servidor levantado (`npm run build && npm start`) y DATABASE_URL.
 */

import { existsSync } from "node:fs";
import postgres from "postgres";
import puppeteer from "puppeteer-core";
import { EMAIL_OPERADOR, limpiarFixtures } from "./lib/fixtures.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";

/** `FIXT` + dos dígitos: el espacio de los verificadores, disjunto del banco de H1. */
const PATENTE = "FIXT70";
const PATENTE_OFFLINE = "FIXT71";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const NAVEGADORES = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const navegador = NAVEGADORES.find((p) => existsSync(p));
if (!navegador) {
  console.error("FAIL · no se encontró un navegador Chromium. Define CHROME_PATH.");
  process.exit(1);
}

// Precondición mecanizada: las activas de una corrida anterior se copian al
// dispositivo y falsean los conteos (ver scripts/lib/fixtures.mjs).
await limpiarFixtures();

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = postgres(url, { max: 1 });

let browser;
try {
  await sql`DELETE FROM sesion_vehiculo WHERE patente IN (${PATENTE}, ${PATENTE_OFFLINE})`;

  browser = await puppeteer.launch({
    executablePath: navegador,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  // Un teléfono, que es donde el operador registra de pie (spec.md §5). El alto
  // importa: la propiedad «entra sin scroll» no significa nada en un escritorio.
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await page.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('[data-testid="email"]', EMAIL_OPERADOR);
  await page.type('[data-testid="clave"]', process.env.CLAVE_ACCESO ?? "");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('[data-testid="entrar"]'),
  ]);
  comprobar(
    "el operador entra y llega a su pantalla",
    (await page.$('[data-testid="nuevo-ingreso"]')) !== null,
    new URL(page.url()).pathname,
  );

  // Dispositivo limpio: sin esto una corrida anterior contamina los conteos.
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase("estacionamiento");
      req.onsuccess = req.onerror = req.onblocked = () => resolve(undefined);
    });
  });
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');

  comprobar(
    "en reposo la pantalla es la lista, no la captura",
    (await page.$('[data-testid="ingreso-pantalla-completa"]')) === null &&
      (await page.$('[data-testid="ocupacion"]')) !== null,
  );

  // --- El modo a pantalla completa ------------------------------------------

  const antesDelToque = Date.now();
  await page.click('[data-testid="nuevo-ingreso"]');
  await page.waitForSelector('[data-testid="ingreso-pantalla-completa"]');

  const modo = await page.evaluate(() => {
    const raiz = document.querySelector('[data-testid="ingreso-pantalla-completa"]');
    const campo = document.querySelector('[data-testid="campo-patente"]');
    const confirmar = document.querySelector('[data-testid="confirmar-ingreso"]');
    const estilo = campo ? getComputedStyle(campo) : null;
    return {
      alto: raiz ? raiz.getBoundingClientRect().height : 0,
      viewport: window.innerHeight,
      scrollDelDocumento: document.documentElement.scrollHeight,
      campoEnfocado: campo !== null && document.activeElement === campo,
      altoCampo: campo ? campo.getBoundingClientRect().height : 0,
      altoConfirmar: confirmar ? confirmar.getBoundingClientRect().height : 0,
      tipografiaCampo: estilo ? parseFloat(estilo.fontSize) : 0,
      // Lo que NO tiene que estar: la captura no compite con la lista.
      hayLista: document.querySelector('[data-testid="lista-activas"]') !== null,
      hayOcupacion: document.querySelector('[data-testid="ocupacion"]') !== null,
      hayCabecera: document.querySelector("header") !== null,
      ayuda: document.getElementById("ayuda-patente")?.textContent?.trim() ?? "",
      estadoRed: document.querySelector('[data-testid="estado-conexion"]')?.textContent?.trim() ?? "",
    };
  });

  comprobar(
    "la captura ocupa el alto del viewport",
    modo.alto >= modo.viewport - 1,
    `${Math.round(modo.alto)}px de ${modo.viewport}px`,
  );

  comprobar(
    "y entra sin scroll: no hay nada debajo del pliegue",
    modo.scrollDelDocumento <= modo.viewport + 1,
    `documento ${modo.scrollDelDocumento}px · viewport ${modo.viewport}px`,
  );

  comprobar(
    "mientras se teclea no hay lista, ni ocupación, ni cabecera compitiendo",
    !modo.hayLista && !modo.hayOcupacion && !modo.hayCabecera,
    `lista=${modo.hayLista} ocupación=${modo.hayOcupacion} cabecera=${modo.hayCabecera}`,
  );

  comprobar(
    "el campo llega con el foco puesto: un toque menos por vehículo",
    modo.campoEnfocado,
  );

  // 44px es el mínimo de objetivo táctil de las guías de accesibilidad; acá se
  // exige más, porque el operador registra de pie y con una mano.
  comprobar(
    "el campo de patente es un objetivo táctil grande",
    modo.altoCampo >= 64,
    `${Math.round(modo.altoCampo)}px`,
  );
  comprobar(
    "el botón Confirmar es un objetivo táctil grande",
    modo.altoConfirmar >= 56,
    `${Math.round(modo.altoConfirmar)}px`,
  );
  comprobar(
    "la patente se lee de lejos",
    modo.tipografiaCampo >= 30,
    `${modo.tipografiaCampo}px`,
  );

  comprobar(
    "AC-UX-4 · la normalización se dice en pantalla",
    /normaliza sola/i.test(modo.ayuda) && /guiones/i.test(modo.ayuda),
    modo.ayuda,
  );

  comprobar(
    "AC-UX-1 · el estado de red viaja adentro del modo",
    modo.estadoRed === "en línea",
    modo.estadoRed,
  );

  // --- Sin señal, que es el caso que sostiene H1 ----------------------------

  await page.setOfflineMode(true);
  await esperar(400);

  const estadoOffline = await page.$eval('[data-testid="estado-conexion"]', (el) =>
    el.textContent.trim(),
  );
  comprobar(
    "AC-UX-1 · la caída de señal se ve sin salir de la captura",
    estadoOffline === "sin conexión",
    estadoOffline,
  );

  await page.type('[data-testid="campo-patente"]', PATENTE_OFFLINE, { delay: 20 });
  await page.click('[data-testid="confirmar-ingreso"]');
  await page.waitForSelector('[data-testid="lista-activas"] li', { timeout: 5000 });

  comprobar(
    "confirmar sin señal registra y devuelve a la lista",
    (await page.$('[data-testid="ingreso-pantalla-completa"]')) === null,
  );

  const filas = await page.$$eval('[data-testid="lista-activas"] li', (els) =>
    els.map((el) => el.getAttribute("data-patente")),
  );
  comprobar(
    "el vehículo quedó adentro aunque no hubiera red",
    filas.includes(PATENTE_OFFLINE),
    filas.join(", "),
  );

  // El conteo de pendientes, visto DESDE el modo: es la mitad de AC-UX-1 que la
  // traducción de diseño pedía y que hasta hoy solo existía en la lista.
  await page.click('[data-testid="nuevo-ingreso"]');
  await page.waitForSelector('[data-testid="ingreso-pantalla-completa"]');
  const pendientes = await page.$eval('[data-testid="pendientes"]', (el) =>
    el.textContent.trim(),
  ).catch(() => "");
  comprobar(
    "AC-UX-1 · el modo dice cuántos registros esperan red",
    /^1 esperando red$/.test(pendientes),
    pendientes,
  );

  // Cancelar no registra nada: la salida del modo tiene que ser gratis.
  await page.click('[data-testid="ingreso-pantalla-completa"] button[type="button"]');
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');
  const trasCancelar = await page.$$eval('[data-testid="lista-activas"] li', (els) => els.length);
  comprobar(
    "cancelar sale del modo sin registrar nada",
    trasCancelar === 1,
    `${trasCancelar} vehículo(s) adentro`,
  );

  // --- La instrumentación de H1 sobrevivió al modo ---------------------------

  const marcas = await page.evaluate(
    (patente) =>
      new Promise((resolve) => {
        const req = indexedDB.open("estacionamiento");
        req.onsuccess = () => {
          const bd = req.result;
          const tx = bd.transaction("sesiones", "readonly");
          const todo = tx.objectStore("sesiones").getAll();
          todo.onsuccess = () => {
            bd.close();
            resolve(todo.result.find((s) => s.patente === patente) ?? null);
          };
        };
        req.onerror = () => resolve(null);
      }),
    PATENTE_OFFLINE,
  );

  comprobar(
    "el ingreso guardado trae las dos marcas de tecleo",
    marcas !== null &&
      typeof marcas.tecleoInicioAt === "string" &&
      typeof marcas.tecleoFinAt === "string",
    marcas ? `${marcas.tecleoInicioAt} → ${marcas.tecleoFinAt}` : "no está en el dispositivo",
  );

  if (marcas) {
    const inicio = Date.parse(marcas.tecleoInicioAt);
    const fin = Date.parse(marcas.tecleoFinAt);
    comprobar(
      "la ventana de tecleo empieza al abrir la captura, no al arrancar la app",
      inicio >= antesDelToque,
      `apertura ${new Date(antesDelToque).toISOString()} · inicio ${marcas.tecleoInicioAt}`,
    );
    comprobar(
      "y termina al confirmar, con duración positiva",
      fin > inicio,
      `${fin - inicio} ms de tecleo mecánico (no es evidencia de H1)`,
    );
  }

  // --- Reconexión: lo que se registró sin señal sube solo -------------------

  await page.setOfflineMode(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await esperar(2500);

  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM sesion_vehiculo WHERE patente = ${PATENTE_OFFLINE}
  `;
  comprobar(
    "al volver la señal, el ingreso de la captura llega al servidor",
    n === 1,
    `${n} fila(s) en sesion_vehiculo`,
  );
} catch (e) {
  comprobar("la corrida completó sin excepción", false, String(e?.message ?? e).split("\n")[0]);
} finally {
  if (browser) await browser.close();
  await sql.end({ timeout: 5 });
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("Maqueta 1l (ingreso a pantalla completa): PASS");
