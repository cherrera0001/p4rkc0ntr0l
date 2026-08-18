/**
 * AC-ISO-1 y AC-ISO-2 — el aislamiento entre clientes, puesto a prueba.
 *
 * ## Por que este verificador es el que importa
 *
 * El producto afirma desde M-1/M-2 que cada consulta filtra por
 * `estacionamiento_id`. Es cierto: seis caminos, seis clausulas. Pero **hasta hoy
 * ningun verificador sembraba un segundo estacionamiento**, asi que la separacion
 * se cumplia por construccion *y por haber un solo cliente* — y esa segunda mitad
 * no es una garantia, es una coincidencia.
 *
 * `src/lib/contexto.ts:6-8` ya describe esa forma de casualidad para el defecto
 * que M-2 corrigio: con un solo estacionamiento sembrado el resultado coincidia
 * por casualidad, y esa casualidad era toda la separacion que habia.
 *
 * **Con un cliente esto es una observacion. Con dos, es un incumplimiento.**
 * Es REQ-ISO-2 de ADR-005, que su §6 llama la unica precondicion que no depende
 * de ninguna decision humana pendiente.
 *
 * ## Que hace, en orden
 *
 * 1. Da de alta al cliente B **por la ruta real**, no por SQL, asi el alta queda
 *    ejercitada de paso (AC-ADM-1).
 * 2. Siembra una sesion en A y otra en B.
 * 3. Con la sesion del operador de A, intenta llegar a lo de B por los caminos
 *    que existen: el listado y el cierre de salida.
 * 4. Con la sesion de plataforma, comprueba que no obtiene ninguna patente.
 *
 * ## Es existencial: sin dos clientes no prueba nada
 *
 * Si el alta falla, esto **falla**. Comparar el aislamiento entre un cliente y
 * ninguno da verde siempre, que es el defecto que este repo persigue desde
 * AC-MEAS-1.
 *
 * Uso:  npm run verificar:aislamiento [url]
 */

import postgres from "postgres";

import { EMAIL_OPERADOR } from "./lib/fixtures.mjs";
import { leerJson } from "./lib/respuesta.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const CLAVE = process.env.CLAVE_ACCESO ?? "";

const EMAIL_PLATAFORMA = "plataforma@fixture.invalid";
const NOMBRE_B = "FIXTURE Cliente B";
const EMAIL_DUENO_B = "dueno-b@fixture.invalid";
const EMAIL_OPERADOR_B = "operador-b@fixture.invalid";
const PATENTE_A = "FIXT70";
const PATENTE_B = "FIXT71";

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

async function entrar(email) {
  const r = await fetch(`${URL_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, clave: CLAVE }),
  });
  if (!r.ok) throw new Error(`login de ${email}: HTTP ${r.status}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { "Content-Type": "application/json", Cookie: cookie };
}

async function limpiar() {
  await sql`DELETE FROM sesion_vehiculo WHERE patente IN (${PATENTE_A}, ${PATENTE_B})`;
  // **El usuario de plataforma se borra tambien, y esto no es prolijidad.**
  // La clave de acceso es compartida (piloto), asi que dejar vivo un usuario de
  // plataforma con email predecible en una base que sirve a una URL publica es
  // dejar abierta la ruta de alta de clientes: el privilegio mas alto del
  // sistema. Un fixture que sobrevive a su verificador deja de ser un fixture.
  await sql`DELETE FROM usuario WHERE email IN (${EMAIL_DUENO_B}, ${EMAIL_OPERADOR_B}, ${EMAIL_PLATAFORMA})`;
  await sql`DELETE FROM tarifa WHERE estacionamiento_id IN (SELECT id FROM estacionamiento WHERE nombre = ${NOMBRE_B})`;
  await sql`DELETE FROM estacionamiento WHERE nombre = ${NOMBRE_B}`;
}

/** Siembra una sesion activa directamente, para no depender del flujo de ingreso. */
async function sembrarSesion(estId, patente) {
  const [op] = await sql`
    SELECT id FROM usuario WHERE estacionamiento_id = ${estId} AND rol = 'operador' LIMIT 1`;
  const [s] = await sql`
    INSERT INTO sesion_vehiculo
      (estacionamiento_id, operador_id, patente, entrada_at, tecleo_inicio_at, tecleo_fin_at, estado, sync_estado)
    VALUES (${estId}, ${op.id}, ${patente}, now() - interval '1 hour',
            now() - interval '1 hour', now() - interval '1 hour', 'activa', 'sincronizada')
    RETURNING id`;
  return s.id;
}

try {
  await limpiar();

  // El usuario de plataforma es fixture y no tiene estacionamiento: la
  // invariante `pertenencia_por_rol` de la base lo exige.
  await sql`
    INSERT INTO usuario (email, rol, estacionamiento_id)
    VALUES (${EMAIL_PLATAFORMA}, 'plataforma', NULL)
    ON CONFLICT (email) DO NOTHING`;

  // --- AC-ADM-1 · el alta deja el cliente operativo ---------------------------
  const cabPlataforma = await entrar(EMAIL_PLATAFORMA);
  const rAlta = await fetch(`${URL_BASE}/api/plataforma/clientes`, {
    method: "POST",
    headers: cabPlataforma,
    body: JSON.stringify({
      nombre: NOMBRE_B,
      capacidadTotal: 10,
      zonaHoraria: "America/Santiago",
      valorHora: 1000,
      fraccionMinutos: 15,
      montoMinimo: 500,
      emailDueno: EMAIL_DUENO_B,
      emailOperador: EMAIL_OPERADOR_B,
    }),
  });
  const cuerpoAlta = await leerJson(rAlta);
  comprobar(
    "AC-ADM-1 · el alta crea un cliente nuevo por la ruta real",
    rAlta.status === 201 && Boolean(cuerpoAlta?.cliente?.id),
    `HTTP ${rAlta.status}${cuerpoAlta?.error ? ` · ${cuerpoAlta.error}` : ""}`,
  );
  if (rAlta.status !== 201) throw new Error("sin segundo cliente no hay aislamiento que probar");

  const idB = cuerpoAlta.cliente.id;

  const [{ n: nTarifas }] = await sql`
    SELECT count(*)::int AS n FROM tarifa WHERE estacionamiento_id = ${idB}`;
  const [{ n: nUsuarios }] = await sql`
    SELECT count(*)::int AS n FROM usuario WHERE estacionamiento_id = ${idB}`;
  comprobar(
    "AC-ADM-1 · el cliente nuevo queda operativo: una tarifa vigente, un dueno y un operador",
    nTarifas === 1 && nUsuarios === 2,
    `${nTarifas} tarifa(s) · ${nUsuarios} usuario(s)`,
  );

  // --- Piso existencial: dos clientes, no uno ---------------------------------
  const [{ n: nEst }] = await sql`SELECT count(*)::int AS n FROM estacionamiento`;
  comprobar(
    "hay al menos DOS estacionamientos (piso: con uno solo esto pasa por casualidad)",
    nEst >= 2,
    `${nEst} estacionamiento(s)`,
  );

  const [opA] = await sql`SELECT estacionamiento_id FROM usuario WHERE email = ${EMAIL_OPERADOR}`;
  const idA = opA.estacionamiento_id;
  await sembrarSesion(idA, PATENTE_A);
  const sesionB = await sembrarSesion(idB, PATENTE_B);

  // --- AC-ISO-1 · A no obtiene nada de B --------------------------------------
  const cabA = await entrar(EMAIL_OPERADOR);

  const rLista = await fetch(`${URL_BASE}/api/sesiones`, { headers: cabA });
  const lista = await leerJson(rLista);
  const patentes = (lista?.sesiones ?? []).map((s) => s.patente);
  comprobar(
    "AC-ISO-1 · el listado del operador de A no incluye ninguna patente de B",
    !patentes.includes(PATENTE_B),
    `${patentes.length} activa(s)${patentes.includes(PATENTE_B) ? ` · FUGA: ve ${PATENTE_B}` : ""}`,
  );

  // Piso del criterio anterior: si A no viera NADA, "no ve lo de B" seria cierto
  // por vacio. Se exige que vea lo suyo.
  comprobar(
    "AC-ISO-1 · y si ve lo suyo (piso: no ver nada haria vacuo el criterio)",
    patentes.includes(PATENTE_A),
    patentes.includes(PATENTE_A) ? PATENTE_A : "el operador de A no ve su propia sesion",
  );

  const rSalidaAjena = await fetch(`${URL_BASE}/api/sesiones/${sesionB}/salida`, {
    method: "POST",
    headers: cabA,
  });
  comprobar(
    "AC-ISO-1 · el operador de A no puede cerrar una sesion de B, ni sabiendo su id",
    rSalidaAjena.status === 404,
    `HTTP ${rSalidaAjena.status}`,
  );

  const [{ estado: estadoB }] = await sql`
    SELECT estado FROM sesion_vehiculo WHERE id = ${sesionB}`;
  comprobar(
    "AC-ISO-1 · y la sesion de B sigue intacta despues del intento",
    estadoB === "activa",
    `estado: ${estadoB}`,
  );

  // --- AC-ISO-2 · plataforma no obtiene patentes ------------------------------
  const rListaPlataforma = await fetch(`${URL_BASE}/api/sesiones`, { headers: cabPlataforma });
  const textoPlataforma = JSON.stringify((await leerJson(rListaPlataforma)) ?? {});
  comprobar(
    "AC-ISO-2 · el rol plataforma no obtiene patentes por el listado",
    rListaPlataforma.status !== 200 &&
      !textoPlataforma.includes(PATENTE_A) &&
      !textoPlataforma.includes(PATENTE_B),
    `HTTP ${rListaPlataforma.status}`,
  );

  const rSalidaPlataforma = await fetch(`${URL_BASE}/api/sesiones/${sesionB}/salida`, {
    method: "POST",
    headers: cabPlataforma,
  });
  const cuerpoSalidaP = JSON.stringify((await leerJson(rSalidaPlataforma)) ?? {});
  comprobar(
    "AC-ISO-2 · el rol plataforma tampoco llega a una patente por la ruta de salida",
    rSalidaPlataforma.status !== 200 && !cuerpoSalidaP.includes(PATENTE_B),
    `HTTP ${rSalidaPlataforma.status}`,
  );

  await limpiar();
} catch (e) {
  comprobar("la corrida llego al final", false, e.message);
  await limpiar().catch(() => {});
} finally {
  await sql.end();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);

if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  console.log("\nUn cliente vio datos de otro. La patente es dato personal (Ley 21.719):");
  console.log("esto no es un defecto de interfaz, es una comunicacion de datos a un tercero.");
  process.exit(1);
}

console.log("AISLAMIENTO: PASS");
