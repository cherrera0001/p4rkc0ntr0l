/**
 * Carga de tarifas por el dueño — maqueta `1e`, veredicto DENTRO
 * (`docs/diseno-2026-08-12-traduccion.md:45`).
 *
 * ## Qué propiedad hace exigible
 *
 * La promesa de AC-UX-6: *«Cambiar una tarifa crea una versión nueva con su
 * `vigente_desde`. Las sesiones ya cerradas conservan el valor con que se
 * calcularon.»* Eso solo es cierto si la ruta **inserta y no pisa**, y sin un
 * comando que lo mire, un `UPDATE` —que es más corto de escribir— convertiría la
 * promesa en mentira sin que nada fallara.
 *
 * ## Es existencial: sin una versión creada no prueba nada
 *
 * Crea una versión de verdad por la ruta real y comprueba que el histórico
 * **creció**. Comparar contra cero versiones daría verde siempre, que es el
 * defecto que este repo persigue desde AC-MEAS-1.
 *
 * ## Un contexto de navegador por rol
 *
 * Las pestañas del mismo navegador comparten el frasco de cookies: entrar como
 * operador pisaba la sesión del dueño, y el POST daba 401 sobre un permiso que
 * sí existe. Medido durante la construcción de este verificador — es el error que
 * habría hecho leer un defecto de la prueba como un defecto del producto.
 *
 * ## No contamina la tarifa del piloto
 *
 * La versión que crea se borra en el `finally`. Una tarifa de prueba que
 * sobreviva cambia el monto que el operador cobra en efectivo.
 *
 * Uso:  npm run verificar:tarifas
 */
import postgres from "postgres";
import puppeteer from "puppeteer-core";

const URL_BASE = "http://localhost:3000";
const EMAIL_DUENO = process.env.EMAIL_DUENO ?? "duena@fixture.invalid";
const EMAIL_OPERADOR = process.env.EMAIL_OPERADOR ?? "operador@fixture.invalid";
const CLAVE = process.env.CLAVE_ACCESO ?? "";
const NAVEGADOR =
  process.env.CHROME_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const r = [];
const comprobar = (n, ok, d = "") => {
  r.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${n}${d ? ` · ${d}` : ""}`);
};

/**
 * POST desde dentro de la pagina: manda la cookie de sesion y el Origin propio,
 * que es exactamente como lo hace el formulario real.
 *
 * Se lee el cuerpo como TEXTO y se parsea aparte, nunca `.json()` directo: una
 * respuesta que no sea JSON —un 502 del proxy, un HTML de error— haria estallar
 * el parseo y el verificador reportaria "no llego al final" en vez del codigo
 * real. Es la misma razon por la que `scripts/lib/respuesta.mjs` existe; aca no
 * se puede importar porque este bloque corre dentro del navegador.
 */
const postear = (page, cuerpo) =>
  page.evaluate(async (body) => {
    const resp = await fetch("/api/tarifas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const crudo = await resp.text();
    let parseado = {};
    try {
      parseado = JSON.parse(crudo);
    } catch {
      parseado = {};
    }
    return { status: resp.status, cuerpo: parseado };
  }, cuerpo);

/**
 * **Un contexto de navegador por rol.** Las pestañas del mismo navegador
 * comparten el frasco de cookies: entrar como operador pisaba la sesión del
 * dueño y todo lo que venía después daba 401 sobre un permiso que sí existe.
 */
async function entrar(browser, email) {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('[data-testid="email"]', email);
  await page.type('[data-testid="clave"]', CLAVE);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('[data-testid="entrar"]'),
  ]);
  return page;
}

let creadaId = null;
let browser;
try {
  const [{ id: estId }] =
    await sql`SELECT estacionamiento_id AS id FROM usuario WHERE email = ${EMAIL_DUENO}`;
  const [{ n: antes }] =
    await sql`SELECT count(*)::int AS n FROM tarifa WHERE estacionamiento_id = ${estId}`;

  browser = await puppeteer.launch({
    executablePath: NAVEGADOR,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await entrar(browser, EMAIL_DUENO);
  await page.goto(`${URL_BASE}/dueno/tarifas`, { waitUntil: "networkidle2" });
  comprobar(
    "el dueno llega a /dueno/tarifas",
    new URL(page.url()).pathname === "/dueno/tarifas",
    new URL(page.url()).pathname,
  );

  const [vig] = await sql`
    SELECT * FROM tarifa WHERE estacionamiento_id = ${estId} AND vigente_desde <= now()
    ORDER BY vigente_desde DESC LIMIT 1`;
  const leer = (t) => page.$eval(`[data-testid="${t}"]`, (e) => e.textContent.trim());
  const vh = await leer("valor-hora");
  const fr = await leer("fraccion");
  const mm = await leer("monto-minimo");
  comprobar(
    "la pantalla muestra la tarifa vigente REAL de la base",
    vh.includes(vig.valor_hora.toLocaleString("es-CL")) &&
      fr === String(vig.fraccion_minutos) &&
      mm.includes(vig.monto_minimo.toLocaleString("es-CL")),
    `pantalla ${vh} / ${fr} / ${mm} · base ${vig.valor_hora} / ${vig.fraccion_minutos} / ${vig.monto_minimo}`,
  );

  const sim = await page.$$eval('[data-testid="simulador"] li', (ns) =>
    ns.map((n) => n.textContent.replace(/\s+/g, " ").trim()),
  );
  const esperado12 = Math.max(
    Math.round(((Math.ceil(12 / vig.fraccion_minutos) * vig.fraccion_minutos) / 60) * vig.valor_hora),
    vig.monto_minimo,
  );
  comprobar(
    "el simulador deriva del calculo real, no de la maqueta",
    sim.length === 5 && sim[0].includes(esperado12.toLocaleString("es-CL")),
    `${sim.length} casos · primero: ${sim[0]}`,
  );

  const fuga = (await page.content()).match(/FIXT\d+/);
  comprobar(
    "la pantalla de tarifas no muestra ninguna patente",
    fuga === null,
    fuga ? `FUGA: ${fuga[0]}` : "ninguna",
  );

  const pageOp = await entrar(browser, EMAIL_OPERADOR);
  await pageOp.goto(`${URL_BASE}/dueno/tarifas`, { waitUntil: "networkidle2" });
  comprobar(
    "un operador NO llega a la pantalla de tarifas del dueno",
    new URL(pageOp.url()).pathname !== "/dueno/tarifas",
    new URL(pageOp.url()).pathname,
  );

  const nuevo = {
    valorHora: vig.valor_hora + 111,
    fraccionMinutos: vig.fraccion_minutos,
    montoMinimo: vig.monto_minimo,
  };
  const res1 = await postear(page, nuevo);
  creadaId = res1.cuerpo?.tarifa?.id ?? null;
  comprobar(
    "POST /api/tarifas crea una version nueva",
    res1.status === 201 && Boolean(creadaId),
    `HTTP ${res1.status}`,
  );

  const [{ n: despues }] =
    await sql`SELECT count(*)::int AS n FROM tarifa WHERE estacionamiento_id = ${estId}`;
  comprobar(
    "INSERTA, no pisa: el historico crecio en 1 (AC-UX-6)",
    despues === antes + 1,
    `${antes} -> ${despues}`,
  );

  await page.reload({ waitUntil: "networkidle2" });
  const vh2 = await leer("valor-hora");
  comprobar(
    "la pantalla refleja la version nueva",
    vh2.includes((vig.valor_hora + 111).toLocaleString("es-CL")),
    vh2,
  );
  const hist = await page
    .$$eval('[data-testid="historico"] li', (ns) => ns.length)
    .catch(() => 0);
  comprobar("la version anterior queda en el historico", hist >= 1, `${hist} anterior(es)`);

  const resOp = await postear(pageOp, nuevo);
  comprobar(
    "un operador NO puede cargar tarifas",
    resOp.status === 401,
    `HTTP ${resOp.status}`,
  );

  const resMal = await postear(page, { valorHora: -1, fraccionMinutos: 0, montoMinimo: "x" });
  comprobar(
    "la frontera rechaza los tres campos invalidos y los nombra",
    resMal.status === 400 && (resMal.cuerpo?.campos ?? []).length === 3,
    `HTTP ${resMal.status} · campos: ${(resMal.cuerpo?.campos ?? []).join(",")}`,
  );
} catch (e) {
  comprobar("la corrida llego al final", false, e.message);
} finally {
  if (creadaId) {
    await sql`DELETE FROM tarifa WHERE id = ${creadaId}`;
    console.log(`\n(limpieza: version de prueba ${creadaId} borrada)`);
  }
  if (browser) await browser.close();
  await sql.end();
}

const mal = r.filter((x) => !x.ok);
console.log(`\n${r.length - mal.length}/${r.length} comprobaciones PASS`);
if (mal.length) {
  console.log("FALLARON: " + mal.map((x) => x.n).join(", "));
  process.exit(1);
}
console.log("MAQUETA 1e (tarifas): PASS");
