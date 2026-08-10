/**
 * Verificación de AC-MEAS-2 (spec.md §6, §9).
 *
 * "El panel refleja exactamente las sesiones registradas por el operador en el
 *  hito anterior. Verificación: registrar N sesiones y confirmar que los
 *  agregados del panel corresponden."
 *
 * Prueba end-to-end real: el operador registra N ingresos desde su pantalla,
 * cierra algunos, y después el dueño entra a su panel y se comparan los
 * agregados que muestra contra lo que hay en la base.
 *
 * También comprueba la separación de roles: el operador no entra al panel y el
 * dueño no entra a la pantalla del operador.
 *
 * Fixtures con prefijo FIXT, borrados al terminar.
 *
 * Uso:  node scripts/verificar-meas2.mjs [url]
 */

import { existsSync } from "node:fs";
import postgres from "postgres";
import puppeteer from "puppeteer-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const CLAVE = process.env.CLAVE_ACCESO ?? "";

/** N ingresos; los dos primeros se cierran para generar ingresos observados. */
const PATENTES = ["FIXT10", "FIXT11", "FIXT12", "FIXT13"];
const A_CERRAR = 2;

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

async function entrar(page, email) {
  await page.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('[data-testid="email"]', email);
  await page.type('[data-testid="clave"]', CLAVE);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('[data-testid="entrar"]'),
  ]);
}

let browser;
try {
  await sql`DELETE FROM sesion_vehiculo WHERE patente LIKE 'FIXT%'`;

  browser = await puppeteer.launch({
    executablePath: navegador,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // ---- El operador registra N sesiones -----------------------------------
  const operador = await browser.newPage();
  await entrar(operador, "operador@fixture.invalid");
  comprobar(
    "el operador entra a su pantalla",
    (await operador.$('[data-testid="nuevo-ingreso"]')) !== null,
    new URL(operador.url()).pathname,
  );

  await operador.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("estacionamiento");
        req.onsuccess = req.onerror = req.onblocked = () => resolve(undefined);
      }),
  );
  await operador.reload({ waitUntil: "networkidle2" });

  for (const patente of PATENTES) {
    await operador.waitForSelector('[data-testid="nuevo-ingreso"]');
    await operador.click('[data-testid="nuevo-ingreso"]');
    await operador.waitForSelector('[data-testid="campo-patente"]');
    await operador.type('[data-testid="campo-patente"]', patente, { delay: 10 });
    await operador.click('[data-testid="confirmar-ingreso"]');
    await esperar(400);
  }
  // Igual que con los cierres: se espera confirmación de la base, no un rato fijo.
  const contarRegistradas = async () => {
    const [{ n }] = await sql`
      SELECT count(*)::int AS n FROM sesion_vehiculo WHERE patente LIKE 'FIXT1%'
    `;
    return n;
  };

  let registradas = 0;
  for (let intento = 0; intento < 40 && registradas < PATENTES.length; intento++) {
    await esperar(250);
    registradas = await contarRegistradas();
  }
  comprobar(
    `las ${PATENTES.length} sesiones llegaron a la base`,
    registradas === PATENTES.length,
    `${registradas}/${PATENTES.length}`,
  );

  // ---- El operador cierra algunas ----------------------------------------
  // Se espera a que la base confirme cada cierre en vez de dormir un rato fijo:
  // con sleeps la prueba mide la latencia de la red, no el comportamiento.
  const contarCerradas = async () => {
    const [{ n }] = await sql`
      SELECT count(*)::int AS n FROM sesion_vehiculo WHERE estado = 'cerrada'
    `;
    return n;
  };

  for (let i = 0; i < A_CERRAR; i++) {
    const objetivo = i + 1;
    const botones = await operador.$$('[data-testid="lista-activas"] li button');
    if (botones.length === 0) break;
    await botones[0].click();

    let confirmado = false;
    for (let intento = 0; intento < 40 && !confirmado; intento++) {
      await esperar(250);
      confirmado = (await contarCerradas()) >= objetivo;
    }
    if (!confirmado) break;
  }

  const [esperado] = await sql`
    SELECT
      count(*) FILTER (WHERE estado = 'activa')::int  AS activas,
      count(*) FILTER (WHERE estado = 'cerrada')::int AS cerradas,
      COALESCE(sum(monto_calculado) FILTER (WHERE estado = 'cerrada'), 0)::int AS ingresos
    FROM sesion_vehiculo
  `;
  comprobar(
    `quedaron ${A_CERRAR} sesiones cerradas`,
    esperado.cerradas === A_CERRAR,
    `${esperado.cerradas} cerradas · ${esperado.activas} activas · $${esperado.ingresos}`,
  );

  // ---- Separación de roles ------------------------------------------------
  await operador.goto(`${URL_BASE}/dueno`, { waitUntil: "networkidle2" });
  comprobar(
    "el operador NO entra al panel del dueño",
    new URL(operador.url()).pathname !== "/dueno",
    `terminó en ${new URL(operador.url()).pathname}`,
  );

  // ---- El dueño mira su panel --------------------------------------------
  const duena = await browser.newPage();
  await entrar(duena, "duena@fixture.invalid");
  comprobar(
    "la dueña entra a su panel",
    new URL(duena.url()).pathname === "/dueno",
    new URL(duena.url()).pathname,
  );

  const leerNumero = async (testid) => {
    const txt = await duena.$eval(`[data-testid="${testid}"]`, (el) => el.textContent);
    return Number(txt.replace(/[^0-9]/g, ""));
  };

  const ocupacionPanel = await leerNumero("ocupacion");
  comprobar(
    "la ocupación del panel coincide con las sesiones activas",
    ocupacionPanel === esperado.activas,
    `panel ${ocupacionPanel} · base ${esperado.activas}`,
  );

  const ingresosPanel = await leerNumero("ingresos");
  comprobar(
    "los ingresos observados coinciden con la suma de las cerradas",
    ingresosPanel === esperado.ingresos,
    `panel $${ingresosPanel} · base $${esperado.ingresos}`,
  );

  const cerradasPanel = await leerNumero("cerradas");
  comprobar(
    "el conteo de salidas coincide",
    cerradasPanel === esperado.cerradas,
    `panel ${cerradasPanel} · base ${esperado.cerradas}`,
  );

  // ---- Descuadre ----------------------------------------------------------
  const observadas = esperado.activas + 1;
  await duena.type('[data-testid="ocupacion-observada"]', String(observadas));
  await esperar(200);
  const descuadre = await duena.$eval('[data-testid="descuadre"]', (el) =>
    Number(el.getAttribute("data-valor")),
  );
  comprobar(
    "el descuadre expone la diferencia entre lo contado y lo registrado",
    descuadre === observadas - esperado.activas,
    `${descuadre}`,
  );

  await duena.goto(`${URL_BASE}/`, { waitUntil: "networkidle2" });
  comprobar(
    "la dueña NO entra a la pantalla del operador",
    (await duena.$('[data-testid="nuevo-ingreso"]')) === null,
    `terminó en ${new URL(duena.url()).pathname}`,
  );
} finally {
  if (browser) await browser.close();
  await sql`DELETE FROM sesion_vehiculo WHERE patente LIKE 'FIXT%'`;
  await sql.end();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("AC-MEAS-2: PASS");
