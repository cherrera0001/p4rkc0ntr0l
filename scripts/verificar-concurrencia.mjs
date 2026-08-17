/**
 * AC-OP-5 — una sesión se cierra una sola vez.
 *
 * ## Por qué existe
 *
 * `src/app/api/sesiones/[id]/salida/route.ts` lee la sesión (`:59-69`), decide
 * sobre su `estado` (`:79`) y recién después escribe (`:112-123`). Entre la
 * lectura y la escritura hay dos `await` más —la tarifa vigente (`:84`) y el
 * cálculo—, así que la ventana no es de microsegundos: es un viaje de ida y
 * vuelta a la base. Dos toques en «Salida», o un reintento de la cola local con
 * el primero todavía en vuelo, la atraviesan sin esfuerzo.
 *
 * Reproducido contra la base antes de escribir este archivo, con dos conexiones:
 *
 *     SIN guardia (el código de entonces): escrituras efectivas = 2 · monto final = 7777
 *     CON guardia estado='activa':        escrituras efectivas = 1 · monto final = 1000
 *
 * El segundo cierre pisaba `salida_at` y `monto_calculado` del primero. **Es la
 * plata que el operador cobra en efectivo**, y además contamina el descuadre del
 * panel del dueño, que es justamente el indicador que existe para detectarlo.
 *
 * ## Qué comprueba, y qué NO
 *
 * El criterio de §9 se enuncia **sobre lo que se observa desde afuera**: un solo
 * cierre, un solo monto, una sola hora. No dice cómo se implementa. Este
 * verificador tampoco lo mira: no lee el fuente, dispara N salidas simultáneas
 * contra la API real y compara respuestas. Si mañana la corrección se reemplaza
 * por una transacción, el criterio sigue valiendo sin tocarse.
 *
 * ## Es existencial, y por eso el piso
 *
 * Si no se pudo crear la sesión, esto **falla**. Un verificador de concurrencia
 * que no logró abrir nada compara cero respuestas entre sí y las encuentra todas
 * iguales — que es la trampa que `AC-MEAS-1` sostuvo durante meses.
 *
 * ## La patente es efímera, NO de banco
 *
 * `FIXT60` es `FIXT` + dígitos: población **efímera**, que `verificar-h1.mjs`
 * cuenta aparte y marca como tecleo de robot. Una `FIXTB…` acá contaminaría el
 * banco de H1 con tecleo automático —y además haría fallar la comprobación de
 * espacio de nombres de `verificar-h1.mjs:362`—.
 *
 * Uso:  npm run verificar:concurrencia [url]
 */

import postgres from "postgres";

import { EMAIL_OPERADOR } from "./lib/fixtures.mjs";
import { leerJson } from "./lib/respuesta.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const PATENTE = "FIXT60";
/** Ocho, no dos: con dos, un ganador se puede explicar por suerte de temporizado. */
const RAFAGA = 8;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const resultados = [];
const comprobar = (nombre, ok, detalle) => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

async function entrarComoOperador() {
  const r = await fetch(`${URL_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL_OPERADOR, clave: process.env.CLAVE_ACCESO ?? "" }),
  });
  if (!r.ok) throw new Error(`No se pudo iniciar sesión: HTTP ${r.status}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { "Content-Type": "application/json", Cookie: cookie };
}

try {
  await sql`DELETE FROM sesion_vehiculo WHERE patente = ${PATENTE}`;

  const cabeceras = await entrarComoOperador();

  // --- Piso existencial: sin sesión abierta no hay nada que medir --------------
  const id = crypto.randomUUID();
  const entrada = new Date(Date.now() - 89 * 60_000);
  const rIngreso = await fetch(`${URL_BASE}/api/sesiones`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({
      id,
      patente: PATENTE,
      entradaAt: entrada.toISOString(),
      tecleoInicioAt: entrada.toISOString(),
      tecleoFinAt: entrada.toISOString(),
      clienteAhora: new Date().toISOString(),
    }),
  });
  comprobar(
    "hay una sesión activa que cerrar (piso: sin esto no se mide nada)",
    rIngreso.status === 201,
    `HTTP ${rIngreso.status}`,
  );
  if (rIngreso.status !== 201) throw new Error("no se pudo abrir la sesión de prueba");

  // --- La ráfaga ---------------------------------------------------------------
  const respuestas = await Promise.all(
    Array.from({ length: RAFAGA }, () =>
      // `leerJson` y no `.json()`: una respuesta ilegible tiene que ser un FAIL
      // con evidencia, no el fin de la corrida (`scripts/lib/respuesta.mjs`).
      fetch(`${URL_BASE}/api/sesiones/${id}/salida`, { method: "POST", headers: cabeceras })
        .then(async (r) => ({ status: r.status, cuerpo: await leerJson(r) })),
    ),
  );

  const conError = respuestas.filter((r) => r.status >= 500);
  comprobar(
    `ninguna de las ${RAFAGA} salidas simultáneas devuelve 5xx`,
    conError.length === 0,
    conError.length ? `${conError.length} con ${[...new Set(conError.map((r) => r.status))].join("/")}` : "todas 2xx/4xx",
  );

  // **El corazón del criterio.** Con la carrera viva, más de una respuesta dice
  // `yaCerrada:false`: cada una cree haber sido la que cerró, y cada una escribió.
  const cerradoras = respuestas.filter((r) => r.cuerpo?.yaCerrada === false);
  comprobar(
    "exactamente una respuesta declara haber cerrado la sesión",
    cerradoras.length === 1,
    `${cerradoras.length} de ${RAFAGA} con yaCerrada:false`,
  );

  const montos = new Set(respuestas.map((r) => r.cuerpo?.sesion?.montoCalculado ?? "sin-monto"));
  comprobar(
    "todas las respuestas publican el mismo monto",
    montos.size === 1,
    // El detalle decía «montos distintos: …» **también cuando pasaba**, que es
    // publicar lo contrario de lo que se midió. Un verificador que miente en el
    // detalle de un PASS entrena a no leer los detalles.
    montos.size === 1 ? `el mismo en las ${RAFAGA}: ${[...montos][0]}` : `${montos.size} distintos: ${[...montos].join(", ")}`,
  );

  const salidas = new Set(
    respuestas.map((r) => {
      const s = r.cuerpo?.sesion?.salidaAt;
      return s ? new Date(s).toISOString() : "sin-salida";
    }),
  );
  comprobar(
    "todas las respuestas publican la misma hora de salida",
    salidas.size === 1,
    salidas.size === 1
      ? `la misma en las ${RAFAGA}: ${[...salidas][0]}`
      : `${salidas.size} distintas: ${[...salidas].join(", ")}`,
  );

  // --- Y la base tiene que coincidir con lo que se devolvió --------------------
  //
  // Sin esto, un servidor que respondiera lo mismo N veces y escribiera N veces
  // pasaría: las respuestas coincidirían y la fila tendría la última escritura.
  const [fila] = await sql`
    SELECT salida_at, monto_calculado, estado FROM sesion_vehiculo WHERE id = ${id}`;
  const montoRespuesta = [...montos][0];
  const salidaRespuesta = [...salidas][0];

  comprobar(
    "la fila de la base coincide con lo que la API devolvió",
    Boolean(fila) &&
      fila.estado === "cerrada" &&
      fila.monto_calculado === montoRespuesta &&
      fila.salida_at instanceof Date &&
      fila.salida_at.toISOString() === salidaRespuesta,
    fila
      ? `base: ${fila.estado} · ${fila.monto_calculado} · ${fila.salida_at?.toISOString()} | api: ${montoRespuesta} · ${salidaRespuesta}`
      : "la sesión no está en la base",
  );

  await sql`DELETE FROM sesion_vehiculo WHERE patente = ${PATENTE}`;
} catch (e) {
  comprobar("la corrida llegó al final", false, e.message);
} finally {
  await sql.end();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);

if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  console.log("\nUna sesión se cerró más de una vez. El segundo cierre pisa la hora y el");
  console.log("monto del primero, y el operador cobra en efectivo contra un número que ya");
  console.log("no es el que la app le mostró.");
  process.exit(1);
}

console.log("AC-OP-5: PASS");
