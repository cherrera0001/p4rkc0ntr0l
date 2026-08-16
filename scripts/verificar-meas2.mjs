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
import {
  EMAIL_DUENO,
  EMAIL_OPERADOR,
  limpiarFixtures,
  PREFIJO_BANCO,
} from "./lib/fixtures.mjs";

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
  // El banco de medición de H1 se excluye: ver `PREFIJO_BANCO`. Este borrado no
  // pasa por `limpiarFixtures()`, así que necesita su propia guardia.
  await sql`
    DELETE FROM sesion_vehiculo
    WHERE patente LIKE 'FIXT%'
      AND NOT (patente LIKE ${PREFIJO_BANCO + "%"} AND estado = 'cerrada')
  `;

  browser = await puppeteer.launch({
    executablePath: navegador,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // ---- El operador registra N sesiones -----------------------------------
  const operador = await browser.newPage();
  await entrar(operador, EMAIL_OPERADOR);
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
  // **Acotado a las patentes de ESTA corrida.** Antes contaba `estado='cerrada'`
  // sobre la tabla entera, y eso no era una cuenta: era una barrera de
  // sincronización disfrazada de cuenta. Medido el 2026-08-16: con dos filas de
  // banco ya cerradas, la condición `>= objetivo` se cumplía **antes de tocar un
  // solo botón**, el bucle seguía de largo y el verificador reportaba
  // `0 cerradas · 4 activas` contra un panel que mostraba 1 salida.
  //
  // Un FAIL así es peor que un FAIL limpio: parece un defecto del panel y es del
  // reloj de la prueba. Funcionaba sólo porque la tabla se vaciaba antes de cada
  // corrida. Acotar por `PATENTES` no depende del banco ni de ninguna otra
  // convención: depende de lo que esta corrida creó, que es lo que quiere contar.
  const contarCerradas = async () => {
    const [{ n }] = await sql`
      SELECT count(*)::int AS n FROM sesion_vehiculo
      WHERE estado = 'cerrada' AND patente IN ${sql(PATENTES)}
    `;
    return n;
  };

  for (let i = 0; i < A_CERRAR; i++) {
    const objetivo = i + 1;
    let confirmado = false;

    // El botón se vuelve a buscar en cada intento: la lista se repinta sola
    // (llega la respuesta del servidor, se actualiza el espejo local) y un
    // handle capturado un instante antes puede haberse desprendido del DOM.
    // Antes se capturaba una vez y se clickeaba: cuando el repintado caía justo
    // en medio, el script abortaba sin resultado en vez de fallar una aserción.
    for (let intento = 0; intento < 12 && !confirmado; intento++) {
      const botones = await operador.$$('[data-testid="lista-activas"] li button');
      if (botones.length === 0) {
        await esperar(300);
        continue;
      }
      try {
        await botones[0].click();
      } catch {
        await esperar(300);
        continue;
      }
      for (let espera = 0; espera < 12 && !confirmado; espera++) {
        await esperar(250);
        confirmado = (await contarCerradas()) >= objetivo;
      }
    }
    if (!confirmado) break;
  }

  // **Por qué hay dos consultas y no una.**
  //
  // Hasta el 2026-08-16 había una sola, que barría la tabla entera: sin filtro de
  // fecha y sin filtro de estacionamiento, mientras el panel filtra por los dos
  // (`src/app/dueno/page.tsx:47`, `:55`, `:69`). Las dos mitades coincidían
  // **porque la tabla se vaciaba antes de cada corrida**, no porque midieran lo
  // mismo — la misma coincidencia que M-2 corrigió en otro lugar.
  //
  // El banco de medición de H1 lo destapó: son sesiones cerradas que sobreviven a
  // la limpieza, así que la tabla dejó de vaciarse. Medido con dos filas de banco
  // cerradas hoy: 8/10.
  //
  // Ahora son dos preguntas distintas, que antes estaban confundidas en una:
  // **qué cerró esta corrida** (abajo, acotado a `PATENTES`) y **qué muestra el
  // panel** (más abajo, con los filtros del panel).

  // Lo que ESTA corrida cerró, acotado a sus propias patentes.
  const [propias] = await sql`
    SELECT count(*)::int AS cerradas FROM sesion_vehiculo
    WHERE estado = 'cerrada' AND patente IN ${sql(PATENTES)}
  `;

  // Lo que el panel MUESTRA, con los mismos filtros que el panel usa: por el
  // estacionamiento **de la dueña autenticada** (`src/app/dueno/page.tsx:55`) y,
  // para las cerradas y los ingresos, desde el inicio del día en la zona de ese
  // estacionamiento (`src/app/dueno/page.tsx:47`, `:69`). Las activas no llevan
  // filtro de fecha, igual que en el panel (`src/app/dueno/page.tsx:49`).
  //
  // El `WHERE e.id` no es decorativo: sin él el `JOIN` no filtra nada —
  // `estacionamiento_id` es NOT NULL con FK, así que toda fila tiene su par— y
  // la consulta agregaría sobre TODOS los estacionamientos, coincidiendo con el
  // panel solo por haber uno sembrado. Es la coincidencia de M-2, exactamente.
  //
  // **Riesgo declarado, no resuelto acá:** el corte del día está implementado dos
  // veces con semánticas distintas. El panel usa `getTimezoneOffset()` del
  // servidor (`src/app/dueno/page.tsx:33`), no la zona del estacionamiento; esta
  // consulta usa `date_trunc(... AT TIME ZONE e.zona_horaria)`. Coinciden cuando
  // el servidor corre en la zona del estacionamiento. Contra la URL viva —Vercel
  // en UTC— difieren, y con banco acumulado una fila cerrada de noche en Chile
  // haría discrepar panel y base. Es un defecto del panel, no de esta consulta.
  const [esperado] = await sql`
    SELECT
      count(*) FILTER (WHERE s.estado = 'activa')::int AS activas,
      count(*) FILTER (
        WHERE s.estado = 'cerrada'
          AND s.salida_at >= date_trunc('day', now() AT TIME ZONE e.zona_horaria)
                             AT TIME ZONE e.zona_horaria
      )::int AS cerradas,
      COALESCE(sum(s.monto_calculado) FILTER (
        WHERE s.estado = 'cerrada'
          AND s.salida_at >= date_trunc('day', now() AT TIME ZONE e.zona_horaria)
                             AT TIME ZONE e.zona_horaria
      ), 0)::int AS ingresos
    FROM sesion_vehiculo s
    JOIN estacionamiento e ON e.id = s.estacionamiento_id
    WHERE e.id = (SELECT estacionamiento_id FROM usuario WHERE email = ${EMAIL_DUENO})
  `;

  comprobar(
    `quedaron ${A_CERRAR} sesiones cerradas`,
    propias.cerradas === A_CERRAR,
    `${propias.cerradas} cerradas de esta corrida · panel espera ${esperado.cerradas} cerradas · ${esperado.activas} activas · $${esperado.ingresos}`,
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
  await entrar(duena, EMAIL_DUENO);
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
  // Ídem: el banco no se barre. Ver `PREFIJO_BANCO`.
  await sql`
    DELETE FROM sesion_vehiculo
    WHERE patente LIKE 'FIXT%'
      AND NOT (patente LIKE ${PREFIJO_BANCO + "%"} AND estado = 'cerrada')
  `;
  await sql.end();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("AC-MEAS-2: PASS");
