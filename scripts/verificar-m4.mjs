/**
 * Verificación del hallazgo M-4 (docs/revision-seguridad-2026-08-09.md).
 *
 * "Tras sincronizar, o tras ser rechazada, IndexedDB no conserva la patente."
 *
 * IndexedDB deja de ser el espejo de la base y pasa a ser lo único que de verdad
 * necesita ser local: la cola de pendientes de sincronizar. La lista de
 * vehículos en el estacionamiento la sirve `GET /api/sesiones`.
 *
 * Lo que se prueba es una ausencia con una presencia al lado: que el dato
 * personal desaparece del dispositivo Y que el operador sigue viendo su
 * estacionamiento, incluso con IndexedDB completamente vacío. Sin la segunda
 * mitad, "purgar" sería indistinguible de "romper la pantalla".
 *
 * También se comprueba que el buffer offline sigue vivo (AC-OP-1 depende de él):
 * sin red el ingreso persiste y se ve; al reconectar sube y recién ahí se borra.
 *
 * Fixtures con prefijo FIXT, borrados al terminar.
 *
 * Uso:  node scripts/verificar-m4.mjs [url]
 */

import { existsSync } from "node:fs";
import postgres from "postgres";
import puppeteer from "puppeteer-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const CLAVE = process.env.CLAVE_ACCESO ?? "";

const EN_LINEA = "FIXT30"; // ingreso normal, con red
const RECHAZADA = "FIXT31"; // la inyectamos con tecleo invertido: el servidor la rechaza
const SIN_RED = "FIXT32"; // ingreso offline
const LEGADO = "FIXT33"; // simula un dispositivo de la versión anterior

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

const resultados = [];
const comprobar = (nombre, ok, detalle) => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

const sql = postgres(url, { max: 1 });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const contarEnBase = async (patente) => {
  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM sesion_vehiculo WHERE patente = ${patente}
  `;
  return n;
};

let browser;
try {
  await sql`DELETE FROM sesion_vehiculo WHERE patente LIKE 'FIXT3%'`;

  browser = await puppeteer.launch({
    executablePath: navegador,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('[data-testid="email"]', "operador@fixture.invalid");
  await page.type('[data-testid="clave"]', CLAVE);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('[data-testid="entrar"]'),
  ]);

  const borrarBase = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.deleteDatabase("estacionamiento");
          req.onsuccess = req.onerror = req.onblocked = () => resolve(undefined);
        }),
    );

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

  /** Patentes no vacías que hay ahora mismo en el dispositivo. */
  const patentesEnDispositivo = async () =>
    (await leerCola()).map((s) => s.patente).filter((p) => p);

  /** Espera hasta que la patente desaparezca del dispositivo, o se rinde. */
  const esperarQueDesaparezca = async (patente, intentos = 30) => {
    for (let i = 0; i < intentos; i++) {
      const patentes = await patentesEnDispositivo();
      if (!patentes.includes(patente)) return true;
      await esperar(400);
    }
    return false;
  };

  const esperarEnBase = async (patente, intentos = 30) => {
    for (let i = 0; i < intentos; i++) {
      if ((await contarEnBase(patente)) > 0) return true;
      await esperar(400);
    }
    return false;
  };

  const inyectar = (sesion) =>
    page.evaluate(
      (s) =>
        new Promise((resolve) => {
          const req = indexedDB.open("estacionamiento", 1);
          req.onsuccess = () => {
            const bd = req.result;
            const tx = bd.transaction("sesiones", "readwrite");
            tx.objectStore("sesiones").put(s);
            tx.oncomplete = () => {
              bd.close();
              resolve(undefined);
            };
          };
        }),
      sesion,
    );

  const registrar = async (patente) => {
    const boton = await page.$('[data-testid="nuevo-ingreso"]');
    if (boton) await boton.click();
    await page.waitForSelector('[data-testid="campo-patente"]');
    await page.focus('[data-testid="campo-patente"]');
    await page.type('[data-testid="campo-patente"]', patente, { delay: 10 });
    await page.click('[data-testid="confirmar-ingreso"]');
    await esperar(600);
  };

  const enPantalla = (patente) =>
    page.$(`[data-testid="lista-activas"] li[data-patente="${patente}"]`);

  /** La lista se repinta cuando vuelve `GET /api/sesiones`; se espera a eso. */
  const esperarEnPantalla = async (patente, intentos = 20) => {
    for (let i = 0; i < intentos; i++) {
      if (await enPantalla(patente)) return true;
      await esperar(400);
    }
    return false;
  };

  await borrarBase();
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');

  // ---- 1 · Ingreso con red: sube y el dispositivo se olvida ----------------
  await registrar(EN_LINEA);

  comprobar(
    "el ingreso de prueba llega a la base",
    await esperarEnBase(EN_LINEA),
    `${await contarEnBase(EN_LINEA)} fila(s)`,
  );
  comprobar(
    "tras sincronizar, la patente NO queda en IndexedDB",
    await esperarQueDesaparezca(EN_LINEA),
    `en el dispositivo: [${(await patentesEnDispositivo()).join(", ") || "ninguna"}]`,
  );
  comprobar(
    "no queda ninguna patente en el dispositivo",
    (await patentesEnDispositivo()).length === 0,
    `${(await leerCola()).length} registro(s), 0 con patente`,
  );
  comprobar(
    "y aun así el operador sigue viendo el vehículo",
    await esperarEnPantalla(EN_LINEA),
    "la fila la aporta el servidor, no el dispositivo",
  );

  // ---- 2 · La lista viene del servidor, no del dispositivo -----------------
  await borrarBase();
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');
  await esperar(1200);

  comprobar(
    "con IndexedDB borrado por completo, la lista sigue mostrando el vehículo",
    await esperarEnPantalla(EN_LINEA),
    "la lista de activos la sirve GET /api/sesiones",
  );

  // ---- 3 · Dispositivo que viene de la versión anterior --------------------
  const ahora = new Date().toISOString();
  await inyectar({
    id: crypto.randomUUID(),
    patente: LEGADO,
    entradaAt: ahora,
    tecleoInicioAt: ahora,
    tecleoFinAt: ahora,
    estado: "cerrada",
    syncEstado: "sincronizada",
    montoCalculado: 1000,
    salidaAt: ahora,
  });
  comprobar(
    "se simuló un dispositivo con una sesión ya sincronizada guardada",
    (await patentesEnDispositivo()).includes(LEGADO),
  );

  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');
  await esperar(1200);

  comprobar(
    "al abrir la app se purga lo que el servidor ya tiene",
    !(await patentesEnDispositivo()).includes(LEGADO),
    `en el dispositivo: [${(await patentesEnDispositivo()).join(", ") || "ninguna"}]`,
  );

  // ---- 4 · Rechazo definitivo del servidor ---------------------------------
  // Tecleo invertido: `POST /api/sesiones` responde 400. Es un rechazo que la
  // barrera del cliente no atrapa, así que ejercita el camino del 4xx sin tocar
  // la barrera de A-3 ni usar una patente que no sea fixture.
  const inicio = new Date().toISOString();
  await inyectar({
    id: crypto.randomUUID(),
    patente: RECHAZADA,
    entradaAt: inicio,
    tecleoInicioAt: inicio,
    tecleoFinAt: new Date(Date.parse(inicio) - 60_000).toISOString(),
    estado: "activa",
    syncEstado: "local",
    montoCalculado: null,
    salidaAt: null,
  });
  comprobar(
    "se simuló una sesión que el servidor va a rechazar",
    (await patentesEnDispositivo()).includes(RECHAZADA),
  );

  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');

  comprobar(
    "tras ser rechazada, la patente NO queda en IndexedDB",
    await esperarQueDesaparezca(RECHAZADA),
    `en el dispositivo: [${(await patentesEnDispositivo()).join(", ") || "ninguna"}]`,
  );
  comprobar(
    "la rechazada tampoco llegó a la base",
    (await contarEnBase(RECHAZADA)) === 0,
    `${await contarEnBase(RECHAZADA)} fila(s)`,
  );

  const aviso = await page
    .$eval('[data-testid="error"]', (el) => el.textContent.trim())
    .catch(() => null);
  comprobar(
    "el borrado no es silencioso: la app avisa del rechazo",
    Boolean(aviso && /rechaz/i.test(aviso)),
    aviso ?? "(sin mensaje)",
  );

  // ---- 5 · El buffer offline sigue siendo el buffer offline (AC-OP-1) ------
  await page.setOfflineMode(true);
  await esperar(400);
  await registrar(SIN_RED);

  const colaSinRed = await leerCola();
  const pendienteSinRed = colaSinRed.find((s) => s.patente === SIN_RED);
  comprobar(
    "sin red el ingreso SÍ persiste en IndexedDB",
    Boolean(pendienteSinRed) && pendienteSinRed.syncEstado === "local",
    `${colaSinRed.length} registro(s) · ${pendienteSinRed?.syncEstado}`,
  );
  comprobar(
    "sin red el operador sigue viendo lo que registró",
    (await enPantalla(SIN_RED)) !== null,
  );

  await page.setOfflineMode(false);
  comprobar(
    "al reconectar, la sesión llega a la base",
    await esperarEnBase(SIN_RED),
    `${await contarEnBase(SIN_RED)} fila(s)`,
  );
  comprobar(
    "y recién entonces la patente sale del dispositivo",
    await esperarQueDesaparezca(SIN_RED),
    `en el dispositivo: [${(await patentesEnDispositivo()).join(", ") || "ninguna"}]`,
  );

  // ---- 6 · Cierre: la sesión cerrada tampoco se queda ----------------------
  await esperar(800);
  const fila = await enPantalla(EN_LINEA);
  if (fila) {
    const boton = await fila.$("button");
    await boton.click();
  }

  let cerradaEnBase = false;
  for (let i = 0; i < 30 && !cerradaEnBase; i++) {
    await esperar(400);
    const [f] = await sql`
      SELECT estado FROM sesion_vehiculo WHERE patente = ${EN_LINEA}
    `;
    cerradaEnBase = f?.estado === "cerrada";
  }
  comprobar("la salida se registra en el servidor", cerradaEnBase);

  comprobar(
    "la sesión cerrada no deja la patente en el dispositivo",
    !(await patentesEnDispositivo()).includes(EN_LINEA),
    `en el dispositivo: [${(await patentesEnDispositivo()).join(", ") || "ninguna"}]`,
  );

  const monto = await page
    .$eval('[data-testid="lista-cerradas"] [data-testid="monto"]', (el) =>
      el.textContent.trim(),
    )
    .catch(() => null);
  comprobar(
    "el operador ve el monto a cobrar en efectivo (spec.md §5)",
    Boolean(monto && /\d/.test(monto)),
    monto ?? "(sin monto)",
  );

  // ---- 7 · Estado final del dispositivo -----------------------------------
  const finales = await patentesEnDispositivo();
  comprobar(
    "al terminar el ciclo completo, el dispositivo no conserva ninguna patente",
    finales.length === 0,
    `[${finales.join(", ") || "ninguna"}]`,
  );
} finally {
  if (browser) await browser.close();
  await sql`DELETE FROM sesion_vehiculo WHERE patente LIKE 'FIXT3%'`;
  await sql.end();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("M-4: PASS");
