/**
 * Verificación del hallazgo M-4 (docs/revision-seguridad-2026-08-09.md).
 *
 * El hallazgo dice: "las sesiones sincronizadas y cerradas permanecen en
 * IndexedDB indefinidamente; no hay borrado al cerrar, ni caducidad". Lo que se
 * corrige, entonces, es la retención INDEFINIDA. La invariante que se prueba:
 *
 *   en IndexedDB solo hay lo que el operador necesita para operar AHORA:
 *   los pendientes de sincronizar y las sesiones activas en el estacionamiento.
 *
 * O sea que se prueban dos cosas que tiran en direcciones opuestas, y las dos
 * tienen que valer a la vez:
 *
 *  - la patente SALE del dispositivo en cuanto deja de hacer falta: al
 *    registrarse la salida, cuando el servidor deja de listarla como activa,
 *    cuando el servidor la rechaza definitivamente, y al abrir la app si quedó
 *    algo de una versión anterior;
 *  - la patente SE QUEDA mientras el vehículo está adentro, porque el operador
 *    tiene que poder trabajar sin señal. Se comprueba con la combinación que de
 *    verdad le ocurre: recargar la app sin cobertura (spec.md §8 y §11).
 *
 * Sin la segunda mitad, "purgar" sería indistinguible de "romper la pantalla".
 *
 * También se comprueba que el buffer offline sigue vivo (AC-OP-1 depende de él):
 * sin red el ingreso persiste y se ve; al reconectar sube.
 *
 * Fixtures con prefijo FIXT, borrados al terminar.
 *
 * Uso:  node scripts/verificar-m4.mjs [url]
 */

import { existsSync } from "node:fs";
import postgres from "postgres";
import puppeteer from "puppeteer-core";
import { EMAIL_OPERADOR, limpiarFixtures } from "./lib/fixtures.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const CLAVE = process.env.CLAVE_ACCESO ?? "";

const EN_LINEA = "FIXT30"; // ingreso normal, con red
const RECHAZADA = "FIXT31"; // la inyectamos con tecleo invertido: el servidor la rechaza
const SIN_RED = "FIXT32"; // ingreso offline
const LEGADO = "FIXT33"; // simula un dispositivo de la versión anterior
const CIERRE_EXTERNO = "FIXT34"; // se cierra por fuera, como si fuera otro turno
const SIN_SESION = "FIXT35"; // sincroniza contra un 401: no puede perderse

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

  const entrar = async () => {
    await page.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2" });
    await page.type('[data-testid="email"]', EMAIL_OPERADOR);
    await page.type('[data-testid="clave"]', CLAVE);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click('[data-testid="entrar"]'),
    ]);
  };

  await entrar();

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

  /** El registro del dispositivo para esa patente, si existe. */
  const registroDe = async (patente) =>
    (await leerCola()).find((s) => s.patente === patente) ?? null;

  /** Espera hasta que el registro cumpla la condición, o devuelve lo último visto. */
  const esperarRegistro = async (patente, cumple, intentos = 30) => {
    let ultimo = null;
    for (let i = 0; i < intentos; i++) {
      ultimo = await registroDe(patente);
      if (ultimo && cumple(ultimo)) return ultimo;
      await esperar(400);
    }
    return ultimo;
  };

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

  /**
   * Registra la salida desde la pantalla y espera confirmación de la base.
   *
   * Se busca la fila POR PATENTE, no por posición: con varias filas en la lista,
   * clickear "la primera" hace que la prueba dependa del orden de repintado.
   */
  const cerrarDesdePantalla = async (patente) => {
    for (let intento = 0; intento < 12; intento++) {
      const fila = await enPantalla(patente);
      if (!fila) return true;
      const boton = await fila.$("button");
      if (boton) await boton.click();
      for (let i = 0; i < 8; i++) {
        await esperar(300);
        const [f] = await sql`
          SELECT estado FROM sesion_vehiculo WHERE patente = ${patente}
        `;
        if (!f || f.estado === "cerrada") return true;
      }
    }
    return false;
  };

  await borrarBase();
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');

  // ---- 1 · Ingreso con red: sube y deja de estar pendiente ------------------
  await registrar(EN_LINEA);

  comprobar(
    "el ingreso de prueba llega a la base",
    await esperarEnBase(EN_LINEA),
    `${await contarEnBase(EN_LINEA)} fila(s)`,
  );

  const traSincronizar = await esperarRegistro(
    EN_LINEA,
    (s) => s.syncEstado === "sincronizada",
  );
  comprobar(
    "tras sincronizar, el registro local deja de estar pendiente",
    traSincronizar?.syncEstado === "sincronizada",
    traSincronizar?.syncEstado ?? "(no está en el dispositivo)",
  );
  comprobar(
    "mientras el vehículo está adentro, el dispositivo conserva su patente",
    traSincronizar?.patente === EN_LINEA && traSincronizar?.estado === "activa",
    "es lo que le permite al operador trabajar sin señal (spec.md §8)",
  );
  comprobar(
    "el operador ve el vehículo",
    await esperarEnPantalla(EN_LINEA),
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

  // ---- 2b · Recargar SIN red (el caso que dejaba la pantalla en cero) ------
  // El paso anterior recarga CON red y el paso 5 prueba sin red pero SIN
  // recargar. La combinación que de verdad le pasa al operador —se le va la
  // señal y la app se reinicia— es esta, y era la única que no se probaba.
  await esperar(1000); // que el espejo local termine de escribirse
  await page.setOfflineMode(true);
  await esperar(300);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');
  await esperar(1500);

  comprobar(
    "tras recargar SIN red, el operador sigue viendo el vehículo",
    (await enPantalla(EN_LINEA)) !== null,
    "sin esto, una recarga sin cobertura deja el estacionamiento invisible",
  );
  const ocupacionSinRed = Number(
    await page.$eval('[data-testid="ocupacion"]', (el) => el.textContent.trim()),
  );
  comprobar(
    "y la ocupación no queda en cero habiendo vehículos adentro",
    ocupacionSinRed > 0,
    `ocupación ${ocupacionSinRed}`,
  );

  await page.setOfflineMode(false);
  await esperar(800);

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
  const traReconectar = await esperarRegistro(
    SIN_RED,
    (s) => s.syncEstado === "sincronizada",
  );
  comprobar(
    "y deja de estar pendiente sin que el operador pierda la fila",
    traReconectar?.syncEstado === "sincronizada" && traReconectar?.patente === SIN_RED,
    `${traReconectar?.syncEstado} · ${traReconectar?.patente ?? "(sin patente)"}`,
  );

  // ---- 5b · Un 4xx transitorio NO puede destruir el ingreso offline --------
  // Se registra sin red y, antes de que la red vuelva, se le borra la cookie de
  // sesión al dispositivo. Al reconectar, `POST /api/sesiones` responde 401. Ese
  // 401 no dice "este dato no puede existir", dice "ahora no puedo": el ingreso
  // tiene que quedarse en la cola. Tratar el rango 4xx entero como rechazo
  // definitivo borraba el único ejemplar que existía del registro — y la cookie
  // caduca sola (A-1), y el límite de intentos previsto para C-1 responde 429.
  await page.setOfflineMode(true);
  await esperar(400);
  await registrar(SIN_SESION);
  comprobar(
    "se registró sin red un ingreso que todavía no subió",
    (await patentesEnDispositivo()).includes(SIN_SESION),
    `en el dispositivo: [${(await patentesEnDispositivo()).join(", ") || "ninguna"}]`,
  );

  await page.deleteCookie({ name: "sesion", url: URL_BASE });
  await page.setOfflineMode(false);
  await esperar(4000);

  comprobar(
    "un 401 al sincronizar NO borra el ingreso del dispositivo",
    (await patentesEnDispositivo()).includes(SIN_SESION),
    `en el dispositivo: [${(await patentesEnDispositivo()).join(", ") || "ninguna"}]`,
  );
  comprobar(
    "y el ingreso todavía no llegó a la base (el 401 fue real)",
    (await contarEnBase(SIN_SESION)) === 0,
    `${await contarEnBase(SIN_SESION)} fila(s)`,
  );

  await entrar();
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');
  comprobar(
    "recuperada la sesión, el ingreso que sobrevivió sí llega a la base",
    await esperarEnBase(SIN_SESION),
    `${await contarEnBase(SIN_SESION)} fila(s)`,
  );

  // ---- 6 · El servidor deja de listarla: el dispositivo la suelta ----------
  // La caducidad que M-4 echaba de menos no puede depender de que el cierre
  // ocurra en ESTE dispositivo. Se cierra la sesión por fuera —como si la
  // hubiera cerrado otro turno— y la patente tiene que irse igual.
  await registrar(CIERRE_EXTERNO);
  comprobar(
    "el ingreso a cerrar por fuera llega a la base",
    await esperarEnBase(CIERRE_EXTERNO),
    `${await contarEnBase(CIERRE_EXTERNO)} fila(s)`,
  );
  const antesDelCierreExterno = await esperarRegistro(
    CIERRE_EXTERNO,
    (s) => s.syncEstado === "sincronizada",
  );
  comprobar(
    "y mientras está activa vive en el dispositivo",
    antesDelCierreExterno?.patente === CIERRE_EXTERNO,
    `en el dispositivo: [${(await patentesEnDispositivo()).join(", ") || "ninguna"}]`,
  );

  // `greatest(now(), entrada_at)` y no `now()` a secas: `entrada_at` la pone el
  // reloj del servidor de la app y `now()` el de Postgres, que corren en
  // máquinas distintas. Con decenas de milisegundos de desfase —medido: 33 ms—
  // el cierre quedaba antes de la entrada y el CHECK `salida_posterior_a_entrada`
  // (INT-16) lo rechazaba, con razón. La app nunca mezcla los dos relojes: pone
  // entrada y salida con el suyo. Este script sí, y es el script el que tiene
  // que respetar la invariante.
  await sql`
    UPDATE sesion_vehiculo
    SET estado = 'cerrada',
        salida_at = greatest(now(), entrada_at),
        monto_calculado = 500
    WHERE patente = ${CIERRE_EXTERNO}
  `;
  // La siguiente lectura del servidor es la que manda. Se fuerza recargando en
  // vez de esperar al refresco periódico: lo que se prueba es la regla, no el
  // intervalo del temporizador.
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');
  comprobar(
    "cuando el servidor deja de listarla como activa, la patente sale del dispositivo",
    await esperarQueDesaparezca(CIERRE_EXTERNO, 60),
    `en el dispositivo: [${(await patentesEnDispositivo()).join(", ") || "ninguna"}]`,
  );

  // ---- 7 · Cierre desde la pantalla: la sesión cerrada tampoco se queda ----
  await esperar(800);
  comprobar("la salida se registra en el servidor", await cerrarDesdePantalla(EN_LINEA));

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

  // ---- 8 · Estado final: vaciado el estacionamiento, vaciado el dispositivo -
  // Se cierran las que queden, una por una y esperando confirmación de la base
  // en cada caso. La invariante dice que el dispositivo conserva lo que está
  // adentro: si no queda nada adentro, no puede quedar nada guardado.
  for (const patente of [SIN_RED, SIN_SESION]) await cerrarDesdePantalla(patente);
  await esperar(1200);

  const [{ n: activasEnBase }] = await sql`
    SELECT count(*)::int AS n
    FROM sesion_vehiculo
    WHERE patente LIKE 'FIXT3%' AND estado = 'activa'
  `;
  comprobar(
    "el estacionamiento queda vacío de fixtures",
    activasEnBase === 0,
    `${activasEnBase} activa(s) en la base`,
  );

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
