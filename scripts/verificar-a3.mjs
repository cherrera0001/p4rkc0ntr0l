/**
 * Verificación del hallazgo A-3 (docs/revision-seguridad-2026-08-09.md).
 *
 * "Con OPERACION_REAL_HABILITADA=false, una patente que no es fixture NO se
 *  guarda localmente, NO entra a la cola, NO se reintenta."
 *
 * Lo que se prueba es una ausencia, que es más difícil que probar una presencia:
 * hay que confirmar que el dato NUNCA tocó IndexedDB, no que se borró después.
 * Por eso se inspecciona la cola inmediatamente tras el intento, y también se
 * comprueba que la app no haya quedado con nada pendiente que reintentar.
 *
 * Uso:  node scripts/verificar-a3.mjs [url]
 */

import { existsSync } from "node:fs";
import postgres from "postgres";
import puppeteer from "puppeteer-core";
import { EMAIL_OPERADOR, limpiarFixtures, PREFIJO_BANCO } from "./lib/fixtures.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const CLAVE = process.env.CLAVE_ACCESO ?? "";

const PATENTE_REAL = "BCDF34"; // formato válido, NO fixture
const PATENTE_FIXTURE = "FIXT20";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const navegador = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
]
  .filter(Boolean)
  .find((p) => existsSync(p));

if (!navegador) {
  console.error("FAIL · no se encontró Edge. Definí CHROME_PATH.");
  process.exit(1);
}

// Precondición mecanizada, no confiada al humano: las activas de una corrida
// anterior se copian al dispositivo y falsean las cuentas de registros.
await limpiarFixtures();

const resultados = [];
const comprobar = (nombre, ok, detalle) => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

const sql = postgres(url, { max: 1 });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let browser;
try {
  await sql`DELETE FROM sesion_vehiculo WHERE patente IN (${PATENTE_REAL}, ${PATENTE_FIXTURE})`;

  browser = await puppeteer.launch({
    executablePath: navegador,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('[data-testid="email"]', EMAIL_OPERADOR);
  await page.type('[data-testid="clave"]', CLAVE);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('[data-testid="entrar"]'),
  ]);

  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("estacionamiento");
        req.onsuccess = req.onerror = req.onblocked = () => resolve(undefined);
      }),
  );
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');

  const leerCola = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open("estacionamiento", 1);
          req.onerror = () => resolve([]);
          req.onsuccess = () => {
            const bd = req.result;
            if (!bd.objectStoreNames.contains("sesiones")) {
              bd.close();
              resolve([]);
              return;
            }
            const tx = bd.transaction("sesiones", "readonly");
            const todo = tx.objectStore("sesiones").getAll();
            todo.onsuccess = () => {
              bd.close();
              resolve(todo.result);
            };
            todo.onerror = () => {
              bd.close();
              resolve([]);
            };
          };
        }),
    );

  /** Escribe un registro directo en IndexedDB, saltándose la pantalla. */
  const inyectar = (patente, syncEstado) =>
    page.evaluate(
      (p, s) =>
        new Promise((resolve) => {
          const req = indexedDB.open("estacionamiento", 1);
          req.onsuccess = () => {
            const bd = req.result;
            const tx = bd.transaction("sesiones", "readwrite");
            const ahora = new Date().toISOString();
            tx.objectStore("sesiones").put({
              id: crypto.randomUUID(),
              patente: p,
              entradaAt: ahora,
              tecleoInicioAt: ahora,
              tecleoFinAt: ahora,
              estado: "activa",
              syncEstado: s,
              montoCalculado: null,
              salidaAt: null,
            });
            tx.oncomplete = () => {
              bd.close();
              resolve(undefined);
            };
          };
        }),
      patente,
      syncEstado,
    );

  const registrar = async (patente) => {
    // Tras un rechazo el formulario queda abierto, así que "Nuevo ingreso" puede
    // no estar en pantalla. Se abre solo si hace falta.
    const boton = await page.$('[data-testid="nuevo-ingreso"]');
    if (boton) await boton.click();

    await page.waitForSelector('[data-testid="campo-patente"]');
    await page.$eval('[data-testid="campo-patente"]', (el) => {
      el.value = "";
    });
    await page.focus('[data-testid="campo-patente"]');
    await page.type('[data-testid="campo-patente"]', patente, { delay: 10 });
    await page.click('[data-testid="confirmar-ingreso"]');
    await esperar(800);
  };

  comprobar(
    "el aviso de piloto está visible",
    (await page.$('[data-testid="aviso-piloto"]')) !== null,
  );

  // ---- Patente NO fixture: no debe tocar el dispositivo -------------------
  await registrar(PATENTE_REAL);

  const colaTrasReal = await leerCola();
  comprobar(
    "una patente real NO se guarda en IndexedDB",
    colaTrasReal.every((s) => s.patente !== PATENTE_REAL),
    `${colaTrasReal.length} registro(s) en la cola`,
  );
  comprobar(
    "no queda nada pendiente de reintentar",
    colaTrasReal.filter((s) => s.syncEstado === "local").length === 0,
  );

  const error = await page
    .$eval('[data-testid="error"]', (el) => el.textContent.trim())
    .catch(() => null);
  comprobar(
    "la app explica por qué la rechazó",
    Boolean(error && /prueba/i.test(error)),
    error ?? "(sin mensaje)",
  );

  const [{ n: enBaseReal }] = await sql`
    SELECT count(*)::int AS n FROM sesion_vehiculo WHERE patente = ${PATENTE_REAL}
  `;
  comprobar("tampoco llegó a la base", enBaseReal === 0, `${enBaseReal} fila(s)`);

  // ---- Patente fixture: el flujo normal sigue funcionando -----------------
  // Se registra SIN RED a propósito, y se queda sin red hasta el final de la
  // sección siguiente. Un pendiente que nunca subió existe en un solo lugar del
  // mundo —este dispositivo—, y esa es justamente la condición en la que una
  // purga demasiado ancha destruye datos. Es el caso que hay que mirar.
  await page.setOfflineMode(true);
  await esperar(300);
  await registrar(PATENTE_FIXTURE);

  const colaTrasFixture = await leerCola();
  comprobar(
    "una patente de prueba SÍ se guarda",
    colaTrasFixture.some((s) => s.patente === PATENTE_FIXTURE),
    `${colaTrasFixture.length} registro(s)`,
  );

  // ---- Las purgas de apertura son DIRIGIDAS ------------------------------
  // Al abrir la app corren dos purgas: `purgarNoFixtures()` (esta corrección) y
  // `purgarNoActivas()` (M-4). Se contamina el dispositivo con una patente real
  // y se vuelve a abrir la app SIN RED. Tienen que pasar las dos cosas a la vez:
  // que la real desaparezca, y que el pendiente de prueba siga entero. Se mira
  // IndexedDB, que es lo único que estas dos funciones tocan: comprobarlo
  // contando filas en Postgres sería tautológico —una purga que borrara el
  // almacén completo seguiría dando PASS—.
  await inyectar(PATENTE_REAL, "local");

  const colaContaminada = await leerCola();
  comprobar(
    "se simuló un dispositivo con una patente real atascada",
    colaContaminada.some((s) => s.patente === PATENTE_REAL),
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');
  await esperar(1200);

  const colaPurgada = await leerCola();
  comprobar(
    "al abrir la app se purga la patente real del dispositivo",
    colaPurgada.every((s) => s.patente !== PATENTE_REAL),
    `${colaPurgada.length} registro(s) restantes`,
  );

  const pendienteFixture = colaPurgada.find((s) => s.patente === PATENTE_FIXTURE);
  comprobar(
    "la purga no se lleva por delante el pendiente de prueba (sigue en IndexedDB)",
    Boolean(pendienteFixture),
    `en el dispositivo: [${colaPurgada.map((s) => s.patente).join(", ") || "nada"}]`,
  );
  comprobar(
    "y sigue marcado como pendiente de sincronizar",
    pendienteFixture?.syncEstado === "local",
    pendienteFixture?.syncEstado ?? "(no está)",
  );

  // El pendiente sobrevivió a la purga; ahora se comprueba que además sirve.
  // Sin esto, "sobrevivir" podría significar "quedó como un huérfano inerte".
  // Se vuelve a abrir la app con red, que es lo que hace el operador cuando
  // recupera señal: la cola se reintenta en cada apertura.
  await page.setOfflineMode(false);
  await esperar(500);
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');

  let enBaseFixture = 0;
  for (let i = 0; i < 30 && enBaseFixture === 0; i++) {
    await esperar(400);
    [{ n: enBaseFixture }] = await sql`
      SELECT count(*)::int AS n FROM sesion_vehiculo WHERE patente = ${PATENTE_FIXTURE}
    `;
  }
  comprobar(
    "el pendiente que sobrevivió a la purga sí llega a la base al reconectar",
    enBaseFixture === 1,
    `${enBaseFixture} fila(s)`,
  );
} finally {
  if (browser) await browser.close();
  // El banco de medición de H1 se excluye: ver `PREFIJO_BANCO`. Sin esto, este
  // borrado inline —que no pasa por `limpiarFixtures()`— vacía la muestra de H1
  // en cada corrida, que es precisamente lo que FASE D vino a arreglar.
  await sql`
    DELETE FROM sesion_vehiculo
    WHERE (patente LIKE 'FIXT%'
           AND NOT (patente LIKE ${PREFIJO_BANCO + "%"} AND estado = 'cerrada'))
       OR patente = ${PATENTE_REAL}
  `;
  await sql.end();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("A-3: PASS");
