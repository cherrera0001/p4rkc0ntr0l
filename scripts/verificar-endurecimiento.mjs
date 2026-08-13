/**
 * Verificación del hito de endurecimiento sobre `docs/revision-integral-2026-08-09.md`.
 *
 * Cubre los hallazgos que se comprueban contra la app corriendo. Los que son
 * decisiones puras —saneo de errores (INT-1), vencimiento de sesión (A-1),
 * freno de intentos (C-1), reloj del cliente (INT-14)— tienen pruebas unitarias
 * propias en `src/lib/*.test.ts`, que es donde se prueban enteros y sin esperar.
 *
 * Qué comprueba acá:
 *
 *   INT-2   · CSP con nonce y Permissions-Policy en las rutas HTML, y que la app
 *             HIDRATE bajo esa CSP (una CSP que rompe la app no es una mejora).
 *   INT-11  · el service worker no guarda como shell una respuesta no-ok ni una
 *             redirección al login.
 *   INT-12  · el nombre del caché lleva la versión del build.
 *   INT-4   · `GET /api/sesiones` devuelve solo tres columnas y se lo niega al dueño.
 *   C-1     · el login responde 429 ante una ráfaga.
 *   A-1     · una cookie manipulada o vencida no abre sesión.
 *   INT-8   · las dos pantallas tienen cierre de sesión.
 *   B-2     · una mutación con `Origin` ajeno se rechaza.
 *
 * Escribe en la base solo mediante fixtures (`FIXT*`). Limpiar después con
 * `npm run limpiar:fixtures`.
 *
 * Uso:  node --env-file=.env scripts/verificar-endurecimiento.mjs [url]
 * Requiere el servidor levantado (`npm run build && npm start`).
 */

import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { leerJson } from "./lib/respuesta.mjs";
import { EMAIL_DUENO, EMAIL_OPERADOR, limpiarFixtures } from "./lib/fixtures.mjs";
import { sanearVersion } from "../src/lib/version-app.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const CLAVE = process.env.CLAVE_ACCESO;
// Las identidades salen de `lib/fixtures.mjs`, una sola vez para todos los
// verificadores. Antes cada uno tenía la suya y la extracción quedó a medias.

if (!CLAVE) {
  console.error("FAIL · falta CLAVE_ACCESO. Probá: node --env-file=.env " + import.meta.filename);
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
  console.error("FAIL · no se encontró un navegador Chromium. Definí CHROME_PATH.");
  process.exit(1);
}

// Precondición mecanizada, no confiada al humano: las activas de una corrida
// anterior falsean el conteo de INT-15 y el listado de INT-4.
await limpiarFixtures();

const resultados = [];
function comprobar(nombre, ok, detalle = "") {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
}


/** Login por HTTP puro; devuelve la cookie de sesión. */
async function entrar(email) {
  const r = await fetch(`${URL_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, clave: CLAVE }),
  });
  if (!r.ok) throw new Error(`login de ${email} falló con HTTP ${r.status}`);
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith("sesion="));
  return cookie.split(";")[0];
}

// --- INT-2 · cabeceras -------------------------------------------------------

const respLogin = await fetch(`${URL_BASE}/login`, { redirect: "manual" });
const csp = respLogin.headers.get("content-security-policy") ?? "";

comprobar("INT-2 · /login trae CSP", csp.length > 0);
comprobar("INT-2 · la CSP usa nonce y no 'unsafe-inline' en script-src", /script-src[^;]*'nonce-/.test(csp) && !/script-src[^;]*'unsafe-inline'/.test(csp), csp.match(/script-src[^;]*/)?.[0] ?? "");
comprobar("INT-2 · connect-src 'self' corta la exfiltración de IndexedDB", /connect-src 'self'/.test(csp));
comprobar("INT-2 · frame-ancestors 'none'", /frame-ancestors 'none'/.test(csp));
comprobar("INT-2 · Permissions-Policy cierra camera y geolocation", /camera=\(\)/.test(respLogin.headers.get("permissions-policy") ?? "") && /geolocation=\(\)/.test(respLogin.headers.get("permissions-policy") ?? ""));

// --- C-1 · freno de fuerza bruta --------------------------------------------

const codigos = [];
for (let i = 0; i < 12; i++) {
  const r = await fetch(`${URL_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL_OPERADOR, clave: "clave-incorrecta-de-prueba" }),
  });
  codigos.push(r.status);
  if (r.status === 429) {
    comprobar("C-1 · Retry-After acompaña al 429", Number(r.headers.get("retry-after")) > 0, `Retry-After: ${r.headers.get("retry-after")}`);
    break;
  }
}
comprobar("C-1 · una ráfaga de intentos termina en 429", codigos.includes(429), `códigos: ${codigos.join(",")}`);
comprobar("C-1 · antes del 429 responde 401, no filtra si el email existe", codigos.filter((c) => c === 401).length >= 5, `401 × ${codigos.filter((c) => c === 401).length}`);

// El limitador cuenta también por email: se espera a que se libere antes de
// seguir, si no los logins de las comprobaciones siguientes chocarían con él.
console.log("      (esperando a que se libere el limitador…)");
await new Promise((r) => setTimeout(r, 16_000));

// --- A-1 · sesión sin vencimiento ni revocación ------------------------------

const cookieOperador = await entrar(EMAIL_OPERADOR);
const cookieDueno = await entrar(EMAIL_DUENO);

const conCookie = (cookie) => fetch(`${URL_BASE}/api/sesiones`, { headers: { cookie } });

comprobar("A-1 · la cookie recién emitida sirve", (await conCookie(cookieOperador)).status === 200);

const [nombre, valor] = cookieOperador.split("=");
const [carga, firma] = valor.split(".");
const cargaAlterada = Buffer.from(
  JSON.stringify({ ...JSON.parse(Buffer.from(carga, "base64url").toString()), rol: "dueño" }),
).toString("base64url");

comprobar("A-1 · una carga manipulada con firma buena se rechaza", (await conCookie(`${nombre}=${cargaAlterada}.${firma}`)).status === 401);

const vencida = Buffer.from(
  JSON.stringify({ ...JSON.parse(Buffer.from(carga, "base64url").toString()), exp: 1 }),
).toString("base64url");
comprobar("A-1 · una carga con exp vencido se rechaza", (await conCookie(`${nombre}=${vencida}.${firma}`)).status === 401);
comprobar("A-1 · la cookie lleva exp firmado", typeof JSON.parse(Buffer.from(carga, "base64url").toString()).exp === "number");

// --- INT-4 · minimización y permisos del GET ---------------------------------

const rLista = await conCookie(cookieOperador);
const { sesiones } = await leerJson(rLista);
const columnas = Array.isArray(sesiones) && sesiones.length > 0 ? Object.keys(sesiones[0]).sort() : null;

comprobar("INT-4 · al dueño se le niega la lista de patentes", (await conCookie(cookieDueno)).status === 401);
comprobar(
  "INT-4 · la respuesta trae solo id, patente y entradaAt",
  columnas === null || columnas.join(",") === "entradaAt,id,patente",
  columnas ? columnas.join(",") : "(sin sesiones activas: no concluyente)",
);

// --- B-2 · origen de las mutaciones ------------------------------------------

const rOrigenAjeno = await fetch(`${URL_BASE}/api/sesiones`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    cookie: cookieOperador,
    origin: "https://sitio-atacante.invalid",
  },
  body: JSON.stringify({}),
});
comprobar("B-2 · un POST con Origin ajeno se rechaza con 403", rOrigenAjeno.status === 403, `HTTP ${rOrigenAjeno.status}`);

const rOrigenPropio = await fetch(`${URL_BASE}/api/sesiones`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    cookie: cookieOperador,
    origin: URL_BASE,
    host: new URL(URL_BASE).host,
  },
  body: JSON.stringify({}),
});
comprobar("B-2 · un POST con Origin propio pasa la comprobación", rOrigenPropio.status === 400, `HTTP ${rOrigenPropio.status} (400 = llegó a validar el cuerpo)`);

// --- INT-14 · una entrada en el futuro no deja la sesión incerrable ----------

const cabecerasOperador = {
  "Content-Type": "application/json",
  cookie: cookieOperador,
  origin: URL_BASE,
};

/** Registra un ingreso por API. `clienteAhora` opcional a propósito. */
async function ingresar(patente, entradaAt, clienteAhora) {
  const id = crypto.randomUUID();
  const r = await fetch(`${URL_BASE}/api/sesiones`, {
    method: "POST",
    headers: cabecerasOperador,
    body: JSON.stringify({
      id,
      patente,
      entradaAt,
      tecleoInicioAt: entradaAt,
      tecleoFinAt: entradaAt,
      ...(clienteAhora ? { clienteAhora } : {}),
    }),
  });
  return { id, status: r.status, cuerpo: await leerJson(r) };
}

// Reloj un día adelantado, y SIN mandar `clienteAhora`: es el peor caso, el de
// un cliente viejo que no conoce el campo. Antes esto producía una sesión que
// respondía 500 en cada intento de cierre y no se podía cerrar nunca.
const futuro = new Date(Date.now() + 24 * 3600_000).toISOString();
const conRelojAdelantado = await ingresar("FIXT91", futuro);
comprobar("INT-14 · el servidor acepta un ingreso con el reloj adelantado", conRelojAdelantado.status === 201, `HTTP ${conRelojAdelantado.status}`);
comprobar(
  "INT-14 · y guarda la entrada acotada al presente, no en el futuro",
  Boolean(conRelojAdelantado.cuerpo.sesion?.entradaAt) &&
    new Date(conRelojAdelantado.cuerpo.sesion.entradaAt) <= new Date(Date.now() + 5000),
  conRelojAdelantado.cuerpo.sesion?.entradaAt ?? "(sin sesión en la respuesta)",
);

const cierre = await fetch(`${URL_BASE}/api/sesiones/${conRelojAdelantado.id}/salida`, {
  method: "POST",
  headers: { cookie: cookieOperador, origin: URL_BASE },
});
const cerrada = await leerJson(cierre);
comprobar("INT-14 · la sesión se puede cerrar (antes: 500 permanente)", cierre.status === 200, `HTTP ${cierre.status}`);
comprobar("INT-14 · con un monto cobrable, no absurdo", cierre.status === 200 && cerrada.sesion?.montoCalculado >= 0 && cerrada.sesion?.montoCalculado < 1_000_000, `$ ${cerrada.sesion?.montoCalculado}`);

// Reloj atrasado tres semanas, mandando `clienteAhora`: el desfase se corrige y
// la permanencia real —minutos— no se convierte en un monto de tres semanas.
const atraso = 21 * 24 * 3600_000;
const conRelojAtrasado = await ingresar(
  "FIXT92",
  new Date(Date.now() - atraso).toISOString(),
  new Date(Date.now() - atraso).toISOString(),
);
const cierreAtrasado = await fetch(`${URL_BASE}/api/sesiones/${conRelojAtrasado.id}/salida`, {
  method: "POST",
  headers: { cookie: cookieOperador, origin: URL_BASE },
});
const cerradaAtrasada = await leerJson(cierreAtrasado);
comprobar(
  "INT-14 · un reloj atrasado no infla el monto: se corrige por el desfase",
  cierreAtrasado.status === 200 && cerradaAtrasada.sesion?.montoCalculado <= 2000,
  `$ ${cerradaAtrasada.sesion?.montoCalculado} (tarifa mínima esperada)`,
);

// --- INT-15 · un vehículo no puede estar dos veces adentro -------------------

const ahora = new Date().toISOString();
const primera = await ingresar("FIXT93", ahora, ahora);
const segunda = await ingresar("FIXT93", ahora, ahora);

comprobar("INT-15 · el primer ingreso entra", primera.status === 201, `HTTP ${primera.status}`);
comprobar(
  "INT-15 · el doble toque no crea una segunda sesión activa, y no rompe",
  segunda.status === 200 && segunda.cuerpo.duplicada === true,
  `HTTP ${segunda.status} · motivo: ${segunda.cuerpo.motivo ?? "—"}`,
);

const listaTrasDuplicado = await leerJson(await conCookie(cookieOperador));
const vecesFixt93 = (listaTrasDuplicado.sesiones ?? []).filter((s) => s.patente === "FIXT93").length;
comprobar(
  "INT-15 · en la lista de activas FIXT93 aparece una sola vez",
  vecesFixt93 === 1,
  `${vecesFixt93} vez/veces`,
);

// --- Navegador: hidratación bajo CSP, service worker, cierre de sesión -------

const browser = await puppeteer.launch({
  executablePath: navegador,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  const violaciones = [];
  page.on("console", (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(t)) violaciones.push(t);
  });

  await page.setCookie({
    name: "sesion",
    value: cookieOperador.split("=").slice(1).join("="),
    url: URL_BASE,
  });

  await page.goto(URL_BASE, { waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]', { timeout: 10_000 });

  // Si la app hidrató, este clic abre el formulario. Es la prueba de que la CSP
  // no rompió nada: sin hidratación el botón no hace nada.
  await page.click('[data-testid="nuevo-ingreso"]');
  const hidrato = await page
    .waitForSelector('[data-testid="campo-patente"]', { timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  comprobar("INT-2 · la app hidrata bajo la CSP con nonce", hidrato);
  comprobar("INT-2 · sin violaciones de CSP en consola", violaciones.length === 0, violaciones.slice(0, 3).join(" | "));

  comprobar(
    "INT-8 · la pantalla del operador tiene cierre de sesión",
    (await page.$('[data-testid="cerrar-sesion"]')) !== null,
  );

  // --- INT-12 · el caché lleva la versión del build --------------------------
  // La espera va acotada: `serviceWorker.ready` no rechaza, así que si la app no
  // hidrata esta promesa no vuelve nunca y la corrida se muere acá, con las
  // comprobaciones que siguen sin ejecutar ni reportar.
  const registro = await page.evaluate(async () => {
    const reg = await Promise.race([
      navigator.serviceWorker.ready.catch(() => null),
      new Promise((r) => setTimeout(() => r(null), 15_000)),
    ]);
    return {
      script: reg?.active?.scriptURL ?? null,
      caches: await caches.keys(),
    };
  });

  // Este par dio PASS sobre producción con el caché llamado
  // `estacionamiento-shell-sin-version`: pedía un prefijo y la ausencia del
  // literal `v1`, y con la versión vacía las dos cosas eran ciertas. Ahora se
  // exige la propiedad de la que depende la purga —que el nombre derive de una
  // versión utilizable— con el mismo saneo que usa el build. El detalle está en
  // `scripts/verificar-int12.mjs`.
  const versionSw = sanearVersion(
    registro.script ? new URL(registro.script).searchParams.get("v") : null,
  );
  const cachesMios = registro.caches.filter((c) => c.startsWith("estacionamiento-"));

  comprobar(
    "INT-12 · el worker se registra con una versión utilizable en la URL",
    versionSw !== null,
    registro.script ?? "sin worker",
  );
  comprobar(
    "INT-12 · los cachés llevan exactamente esa versión, no una marca fija",
    versionSw !== null && cachesMios.length > 0 && cachesMios.every((c) => c.endsWith(`-${versionSw}`)),
    registro.caches.join(", "),
  );

  // --- INT-11 · el shell no se envenena con la redirección al login ----------
  await page.evaluate(() => caches.keys());
  await page.deleteCookie({ name: "sesion", url: URL_BASE });
  // Con la cookie borrada, `GET /` redirige a /login. Antes esa respuesta
  // quedaba guardada bajo la clave "/" y el operador sin red se encontraba con
  // un formulario que no puede validar nada.
  await page.goto(URL_BASE, { waitUntil: "networkidle2" });

  const shellTrasRedireccion = await page.evaluate(async () => {
    const nombre = (await caches.keys()).find((c) => c.startsWith("estacionamiento-shell-"));
    if (!nombre) return { hay: false };
    const cache = await caches.open(nombre);
    const guardada = await cache.match("/");
    if (!guardada) return { hay: false };
    return { hay: true, redirigida: guardada.redirected, texto: (await guardada.text()).slice(0, 4000) };
  });

  comprobar(
    "INT-11 · la redirección al login no queda guardada como shell",
    !shellTrasRedireccion.hay ||
      (!shellTrasRedireccion.redirigida && !/data-testid="entrar"/.test(shellTrasRedireccion.texto)),
    shellTrasRedireccion.hay ? "hay copia de / y no es el login" : "no hay copia de / (tampoco se envenenó)",
  );
} catch (e) {
  // Mismo criterio que `leerJson`: lo que se rompe en la fase de navegador es un
  // FAIL de esa fase, no una excusa para no reportar nada.
  comprobar("fase de navegador · completó sin excepción", false, String(e?.message ?? e).split("\n")[0]);
} finally {
  await browser.close();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("ENDURECIMIENTO: PASS");
