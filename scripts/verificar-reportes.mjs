/**
 * Reportes del dueño — maqueta `1g`, veredicto DENTRO
 * (`docs/diseno-2026-08-12-traduccion.md:47`).
 *
 * ## Qué propiedad hace exigible
 *
 * **Que las cifras se deriven de la base y no estén escritas a mano.** Es el
 * riesgo específico de esta pantalla: la maqueta trae `842 sesiones`,
 * `$ 2,4 M` y `1 h 45` dibujados, y una traducción perezosa los copia. Acá se
 * siembran salidas con montos y duraciones **conocidos** y se comprueba que la
 * pantalla muestre exactamente eso.
 *
 * ## Es existencial: sin salidas sembradas no prueba nada
 *
 * Un reporte sobre cero filas muestra ceros, y «los ceros coinciden» es
 * vacuamente verdadero. Por eso siembra, mide, y limpia.
 *
 * ## Lo que además vigila, y no es decorativo
 *
 * - **Ninguna patente en la pantalla.** El dueño ve agregados; la lista de
 *   patentes nunca fue suya (`GET /api/sesiones` le responde 401).
 * - **El «tecleo mediano» sigue vacío.** Si algún día alguien publica ahí un
 *   número, este verificador falla: la métrica de H1 tiene un solo dueño
 *   —`verificar:h1`— y `AC-H1-2` está registrado NO VERIFICADO. Un segundo
 *   cálculo de la misma métrica es una divergencia esperando ocurrir.
 * - **El operador no llega.** Aislamiento por rol.
 *
 * Uso:  npm run verificar:reportes
 */

import postgres from "postgres";
import puppeteer from "puppeteer-core";

import { EMAIL_DUENO, EMAIL_OPERADOR } from "./lib/fixtures.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const CLAVE = process.env.CLAVE_ACCESO ?? "";
const NAVEGADOR =
  process.env.CHROME_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

/** Patentes propias, `FIXT` + dos dígitos (espacio disjunto del banco de H1). */
const PATENTES = ["FIXT41", "FIXT42"];
/** Montos y permanencias conocidos: la pantalla tiene que mostrar exactamente esto. */
const SEMBRADAS = [
  { patente: "FIXT41", monto: 3000, minutos: 120 },
  { patente: "FIXT42", monto: 1000, minutos: 30 },
];
const MONTO_ESPERADO = SEMBRADAS.reduce((a, s) => a + s.monto, 0);
const PERMANENCIA_ESPERADA = SEMBRADAS.reduce((a, s) => a + s.minutos, 0) / SEMBRADAS.length;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const r = [];
const comprobar = (n, ok, d = "") => {
  r.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${n}${d ? ` · ${d}` : ""}`);
};

async function entrar(browser, email) {
  // Un contexto por rol: las pestañas del mismo navegador comparten cookies, y
  // entrar como operador pisaría la sesión del dueño.
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

const limpiar = () => sql`DELETE FROM sesion_vehiculo WHERE patente IN ${sql(PATENTES)}`;

let browser;
try {
  await limpiar();

  const [dueno] = await sql`
    SELECT estacionamiento_id AS est FROM usuario WHERE email = ${EMAIL_DUENO}`;
  const [op] = await sql`
    SELECT id FROM usuario WHERE estacionamiento_id = ${dueno.est} AND rol = 'operador' LIMIT 1`;

  // Salidas de HOY con monto y permanencia conocidos. `salida_at = now()` las
  // deja dentro del período de siete días sin depender de la zona horaria.
  for (const s of SEMBRADAS) {
    await sql`
      INSERT INTO sesion_vehiculo
        (estacionamiento_id, operador_id, patente, entrada_at, salida_at, monto_calculado,
         tecleo_inicio_at, tecleo_fin_at, estado, sync_estado)
      VALUES (${dueno.est}, ${op.id}, ${s.patente},
              now() - (${s.minutos} || ' minutes')::interval, now(), ${s.monto},
              now() - (${s.minutos} || ' minutes')::interval,
              now() - (${s.minutos} || ' minutes')::interval + interval '3 seconds',
              'cerrada', 'sincronizada')`;
  }

  const [{ n: sembradas }] = await sql`
    SELECT count(*)::int AS n FROM sesion_vehiculo WHERE patente IN ${sql(PATENTES)}`;
  comprobar(
    "piso existencial: hay salidas sembradas que reportar (sobre cero, los ceros coinciden solos)",
    sembradas === SEMBRADAS.length,
    `${sembradas} salida(s)`,
  );

  browser = await puppeteer.launch({
    executablePath: NAVEGADOR,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await entrar(browser, EMAIL_DUENO);
  await page.goto(`${URL_BASE}/dueno/reportes`, { waitUntil: "networkidle2" });
  comprobar(
    "el dueno llega a /dueno/reportes",
    new URL(page.url()).pathname === "/dueno/reportes",
    new URL(page.url()).pathname,
  );

  const leer = (t) => page.$eval(`[data-testid="${t}"]`, (e) => e.textContent.trim());

  // La cifra de la pantalla contra la de la base, no contra un número escrito acá.
  const [enBase] = await sql`
    SELECT count(*)::int AS n, coalesce(sum(monto_calculado), 0)::int AS monto
    FROM sesion_vehiculo
    WHERE estacionamiento_id = ${dueno.est} AND estado = 'cerrada'
      AND salida_at >= now() - interval '6 days'`;

  const sesionesEnPantalla = Number((await leer("sesiones")).replace(/\D/g, ""));
  comprobar(
    "las sesiones del periodo salen de la base, no de la maqueta",
    sesionesEnPantalla === enBase.n,
    `pantalla ${sesionesEnPantalla} · base ${enBase.n}`,
  );

  const ingresosEnPantalla = Number((await leer("ingresos-periodo")).replace(/\D/g, ""));
  comprobar(
    "los ingresos observados coinciden con la suma real",
    ingresosEnPantalla === enBase.monto,
    `pantalla ${ingresosEnPantalla} · base ${enBase.monto} · sembrado ${MONTO_ESPERADO}`,
  );

  // La permanencia media es la que implican los datos sembrados, con tolerancia
  // de un minuto: `now()` corre entre el INSERT y la lectura.
  const permanencia = await leer("permanencia");
  // El formato es el de la maqueta: «1 h 45» (los minutos van SIN sufijo cuando
  // hay horas) o «45 min» cuando no las hay. La primera version de este parser
  // buscaba `min` siempre y leia «1 h 15» como 60 minutos: reportaba un defecto
  // del producto que era suyo. Se deja anotado porque el error es facil de
  // repetir — un verificador que no sabe leer lo que mide inventa hallazgos.
  const minutosEnPantalla = (() => {
    const conHoras = permanencia.match(/(\d+)\s*h(?:\s+(\d+))?/);
    if (conHoras) return Number(conHoras[1]) * 60 + Number(conHoras[2] ?? 0);
    const soloMin = permanencia.match(/(\d+)\s*min/);
    return soloMin ? Number(soloMin[1]) : 0;
  })();
  // **Contra la base, no contra una constante.** La primera version esperaba el
  // promedio de LO SEMBRADO y falló con un dato correcto en pantalla: en el
  // período también hay salidas cerradas que dejaron otros verificadores, y la
  // pantalla —bien— las incluye. Comparar contra un número escrito en el script
  // es la misma clase de error que este verificador existe para cazar, cometida
  // por el verificador. La tolerancia de un minuto cubre el `now()` que corre
  // entre el INSERT y la lectura.
  const [{ media }] = await sql`
    SELECT avg(extract(epoch from (salida_at - entrada_at)) / 60) AS media
    FROM sesion_vehiculo
    WHERE estacionamiento_id = ${dueno.est} AND estado = 'cerrada'
      AND salida_at >= now() - interval '6 days'`;
  const esperado = Number(media);
  comprobar(
    "la permanencia media es la que implican las salidas reales del periodo",
    Math.abs(minutosEnPantalla - esperado) <= 1,
    `pantalla "${permanencia}" = ${minutosEnPantalla} min · base ${esperado.toFixed(1)} min`,
  );

  // Las barras tienen que sumar lo mismo que la cifra: un grafico que no cuadra
  // con su propio total es peor que no tener grafico.
  const sumaBarras = await page.$$eval('[data-dia]', (ns) =>
    ns.reduce((a, n) => a + Number(n.getAttribute("data-n")), 0),
  );
  comprobar(
    "las barras por dia suman exactamente la cifra de sesiones",
    sumaBarras === sesionesEnPantalla,
    `barras ${sumaBarras} · cifra ${sesionesEnPantalla}`,
  );

  const html = await page.content();
  const fuga = PATENTES.find((p) => html.includes(p));
  comprobar(
    "la pantalla de reportes no muestra ninguna patente",
    fuga === undefined,
    fuga ? `FUGA: ${fuga}` : "ninguna",
  );

  // Si alguien publica un numero aca, esto falla — y tiene que fallar.
  const tecleo = await leer("tecleo");
  comprobar(
    "el tecleo mediano sigue sin publicar un numero (la metrica de H1 tiene un solo dueno)",
    tecleo === "—" && !/\d/.test(tecleo),
    `"${tecleo}"`,
  );

  const h1 = await page.$('[data-testid="h1-vacio"]');
  comprobar("el panel de evidencia de H1 declara que no publica mediciones", h1 !== null);

  const pageOp = await entrar(browser, EMAIL_OPERADOR);
  await pageOp.goto(`${URL_BASE}/dueno/reportes`, { waitUntil: "networkidle2" });
  comprobar(
    "un operador NO llega a los reportes del dueno",
    new URL(pageOp.url()).pathname !== "/dueno/reportes",
    new URL(pageOp.url()).pathname,
  );
} catch (e) {
  comprobar("la corrida llego al final", false, e.message);
} finally {
  await limpiar().catch(() => {});
  if (browser) await browser.close();
  await sql.end();
}

const mal = r.filter((x) => !x.ok);
console.log(`\n${r.length - mal.length}/${r.length} comprobaciones PASS`);
if (mal.length) {
  console.log("FALLARON: " + mal.map((x) => x.n).join(", "));
  process.exit(1);
}
console.log("MAQUETA 1g (reportes): PASS");
