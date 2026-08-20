/**
 * Verificación de AC-OP-1 (spec.md §5, §9).
 *
 * "Con el navegador en modo sin conexión, un ingreso se registra y persiste en
 * IndexedDB; al reconectar, sync_estado pasa a sincronizada."
 *
 * Se maneja el navegador por CDP sobre Edge con puppeteer-core, el mismo
 * mecanismo de scripts/verificar-pwa.mjs. No usa Lighthouse.
 *
 * La patente es un FIXTURE evidente (spec.md §11). Se borra de la base antes y
 * después de la prueba: no queda dato de prueba conviviendo con los reales.
 *
 * Uso:  node scripts/verificar-op1.mjs [url]
 * Requiere el servidor levantado y DATABASE_URL en el entorno.
 */

import { existsSync } from "node:fs";
import postgres from "postgres";
import puppeteer from "puppeteer-core";
import { EMAIL_OPERADOR, limpiarFixtures } from "./lib/fixtures.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const PATENTE_FIXTURE = "FIXT00";
/**
 * Patente propia para la comprobación del doble toque (FE-1), al final del
 * archivo. `FIXT` + dos dígitos, que es lo que mantiene el espacio de los
 * verificadores disjunto del banco de H1 (`FIXTB…`, ver `scripts/lib/fixtures.mjs`).
 */
const PATENTE_DOBLE = "FIXT40";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const NAVEGADORES = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const navegador = NAVEGADORES.find((p) => existsSync(p));
if (!navegador) {
  console.error("FAIL · no se encontró Edge. Definí CHROME_PATH.");
  process.exit(1);
}

// Precondición mecanizada, no confiada al humano: las activas de una corrida
// anterior se copian al dispositivo y falsean las cuentas de registros.
await limpiarFixtures();

const resultados = [];
function comprobar(nombre, ok, detalle) {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
}

const sql = postgres(url, { max: 1 });
const contarEnServidor = async () => {
  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM sesion_vehiculo WHERE patente = ${PATENTE_FIXTURE}
  `;
  return n;
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let browser;
try {
  await sql`DELETE FROM sesion_vehiculo WHERE patente = ${PATENTE_FIXTURE}`;

  browser = await puppeteer.launch({
    executablePath: navegador,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();

  // Auth mínima de dos roles (M3): la pantalla del operador exige sesión.
  await page.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('[data-testid="email"]', EMAIL_OPERADOR);
  await page.type('[data-testid="clave"]', process.env.CLAVE_ACCESO ?? "");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('[data-testid="entrar"]'),
  ]);
  comprobar(
    "el operador inicia sesión y llega a su pantalla",
    await page.$('[data-testid="nuevo-ingreso"]') !== null,
    new URL(page.url()).pathname,
  );

  // Estado limpio: sin esto, una corrida anterior contaminaría el conteo.
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase("estacionamiento");
      req.onsuccess = req.onerror = req.onblocked = () => resolve(undefined);
    });
  });
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');

  // --- Sin conexión --------------------------------------------------------
  await page.setOfflineMode(true);
  await esperar(300);

  const estadoOffline = await page.$eval('[data-testid="estado-conexion"]', (el) =>
    el.textContent.trim(),
  );
  comprobar("la app detecta que está sin conexión", estadoOffline === "sin conexión", estadoOffline);

  await page.click('[data-testid="nuevo-ingreso"]');
  await page.waitForSelector('[data-testid="campo-patente"]');
  await page.type('[data-testid="campo-patente"]', PATENTE_FIXTURE, { delay: 20 });
  await page.click('[data-testid="confirmar-ingreso"]');
  await page.waitForSelector('[data-testid="lista-activas"] li', { timeout: 5000 });

  const leerIndexedDB = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open("estacionamiento", 1);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const bd = req.result;
            const tx = bd.transaction("sesiones", "readonly");
            const todo = tx.objectStore("sesiones").getAll();
            todo.onsuccess = () => {
              bd.close();
              resolve(todo.result);
            };
            todo.onerror = () => reject(todo.error);
          };
        }),
    );

  const enIdbOffline = await leerIndexedDB();
  comprobar(
    "el ingreso persiste en IndexedDB sin red",
    enIdbOffline.length === 1 && enIdbOffline[0].patente === PATENTE_FIXTURE,
    `${enIdbOffline.length} registro(s)`,
  );

  comprobar(
    "queda marcado como local (no sincronizado)",
    enIdbOffline[0]?.syncEstado === "local",
    enIdbOffline[0]?.syncEstado,
  );

  comprobar(
    "los timestamps de tecleo se registraron",
    Boolean(enIdbOffline[0]?.tecleoInicioAt) && Boolean(enIdbOffline[0]?.tecleoFinAt),
    `tecleo = ${
      new Date(enIdbOffline[0]?.tecleoFinAt).getTime() -
      new Date(enIdbOffline[0]?.tecleoInicioAt).getTime()
    } ms`,
  );

  // Antes esto era `comprobar(..., true)`: una constante sin antecedente,
  // que no lee el DOM y no puede fallar nunca. El waitForSelector de arriba
  // solo prueba que existe ALGÚN <li> —un residuo de una corrida anterior lo
  // satisface igual—, así que la aserción real tiene que mirar la patente
  // del fixture puntualmente, no la mera presencia de un ítem en la lista.
  const patentesEnListaOffline = await page.$$eval(
    '[data-testid="lista-activas"] li',
    (nodos) => nodos.map((n) => n.getAttribute("data-patente")),
  );
  comprobar(
    "la UI muestra el vehículo aunque no haya red",
    patentesEnListaOffline.includes(PATENTE_FIXTURE),
    `patentes en lista: ${patentesEnListaOffline.join(", ") || "(ninguna)"}`,
  );

  // AC-UX-1 (docs/diseno-2026-08-12-traduccion.md:135): con un ingreso local
  // pendiente y sin red, el contador de pendientes es contenido de primer
  // nivel, no un ícono — el operador tiene que poder leer cuántos registros
  // le quedan esperando sin adivinar.
  const pendientesEl = await page.$('[data-testid="pendientes"]');
  const textoPendientes = pendientesEl
    ? await page.$eval('[data-testid="pendientes"]', (el) => el.textContent.trim())
    : null;
  comprobar(
    "el contador de pendientes (AC-UX-1) muestra 1 esperando red",
    textoPendientes === "1 esperando red",
    textoPendientes ?? "(no existe el elemento)",
  );

  const enServidorOffline = await contarEnServidor();
  comprobar(
    "todavía no llegó al servidor",
    enServidorOffline === 0,
    `${enServidorOffline} fila(s)`,
  );

  // --- Vuelve la red -------------------------------------------------------
  await page.setOfflineMode(false);

  let sincronizada = false;
  for (let intento = 0; intento < 20 && !sincronizada; intento++) {
    await esperar(500);
    const actual = await leerIndexedDB();
    sincronizada = actual[0]?.syncEstado === "sincronizada";
  }
  comprobar("al reconectar, sync_estado pasa a sincronizada", sincronizada);

  const enServidorFinal = await contarEnServidor();
  comprobar(
    "la sesión llegó a la base",
    enServidorFinal === 1,
    `${enServidorFinal} fila(s)`,
  );

  const [fila] = await sql`
    SELECT patente, estado, sync_estado, tecleo_inicio_at, tecleo_fin_at
    FROM sesion_vehiculo WHERE patente = ${PATENTE_FIXTURE}
  `;
  comprobar(
    "en la base queda activa, sincronizada y con tecleo completo",
    fila?.estado === "activa" &&
      fila?.sync_estado === "sincronizada" &&
      fila?.tecleo_inicio_at !== null &&
      fila?.tecleo_fin_at !== null,
    `${fila?.estado}/${fila?.sync_estado}`,
  );

  // Reintento idempotente: al recargar, la app vuelve a intentar sincronizar la
  // cola. Como el id lo generó el cliente, el servidor debe descartar el
  // duplicado en vez de crear una sesión nueva.
  await page.reload({ waitUntil: "networkidle2" });
  await esperar(1500);
  const trasRecarga = await contarEnServidor();
  comprobar(
    "sincronizar de nuevo no duplica la sesión",
    trasRecarga === 1,
    `${trasRecarga} fila(s)`,
  );

  // --- FE-1 · el doble toque no duplica el ingreso ---------------------------
  //
  // **Va al final y con patente propia** para no mover los conteos de arriba,
  // que esperan exactamente una fila de PATENTE_FIXTURE.
  //
  // Se prueba SIN RED a propósito. Con red el servidor tapa el defecto: el
  // índice único INT-15 rechaza el segundo y responde `duplicada: true`, así que
  // la duplicación se vuelve invisible desde la base. Sin red no hay servidor
  // que la tape ni GET que reconcilie, y el registro sobrante queda en el
  // dispositivo —y en la ocupación que ve el operador— todo lo que dure el
  // corte. La ocupación es la cifra contra la que el panel del dueño mide el
  // descuadre (`spec.md` §6): inflarla es corromper la señal, no la interfaz.
  //
  // Los dos clicks van SIN await entre medio: esperar entre uno y otro probaría
  // dos ingresos consecutivos, que es otra cosa y siempre pasa.
  await page.setOfflineMode(true);
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase("estacionamiento");
      req.onsuccess = req.onerror = req.onblocked = () => resolve(undefined);
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');
  await page.click('[data-testid="nuevo-ingreso"]');
  await page.waitForSelector('[data-testid="campo-patente"]');
  await page.type('[data-testid="campo-patente"]', PATENTE_DOBLE, { delay: 10 });

  await page.evaluate(() => {
    const boton = document.querySelector('[data-testid="confirmar-ingreso"]');
    boton.click();
    boton.click();
  });
  await esperar(1200);

  const trasDobleToque = (await leerIndexedDB()).filter((s) => s.patente === PATENTE_DOBLE);
  comprobar(
    "FE-1 · el doble toque en Confirmar no duplica el ingreso",
    trasDobleToque.length === 1,
    `${trasDobleToque.length} registro(s) para ${PATENTE_DOBLE}`,
  );

  const filasEnPantalla = await page.$$eval(
    '[data-testid="lista-activas"] li',
    (nodos, patente) =>
      nodos.filter((n) => n.getAttribute("data-patente") === patente).length,
    PATENTE_DOBLE,
  );
  comprobar(
    "FE-1 · y la ocupación que ve el operador no queda inflada",
    filasEnPantalla === 1,
    `${filasEnPantalla} fila(s) en pantalla`,
  );
} finally {
  if (browser) await browser.close();
  await sql`DELETE FROM sesion_vehiculo WHERE patente IN (${PATENTE_FIXTURE}, ${PATENTE_DOBLE})`;
  await sql.end();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("AC-OP-1: PASS");
