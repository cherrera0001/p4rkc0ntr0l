/**
 * Cliente mínimo de la API de Railway, con freno propio.
 *
 * El freno no es decorativo: un despliegue anterior disparó el costo, y la
 * instrucción fue explícita. Este módulo hace dos cosas para que eso no dependa
 * de que quien lo use se acuerde:
 *
 *  1. **Tope duro de peticiones por corrida.** Al superarlo lanza. No hay
 *     reintento infinito ni bucle de sondeo posible.
 *  2. **Espaciado entre peticiones**, y respeto de `Retry-After` si llega un 429.
 *
 * Nunca imprime el token. Los errores se recortan para que un mensaje del
 * servidor no arrastre la credencial a un log.
 */

const ENDPOINT = "https://backboard.railway.com/graphql/v2";

const TOPE_POR_CORRIDA = 12;
const ESPACIADO_MS = 1200;

let usadas = 0;
let ultima = 0;

function dormir(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function peticionesUsadas() {
  return usadas;
}

export async function consultar(query, variables = {}) {
  if (usadas >= TOPE_POR_CORRIDA) {
    throw new Error(
      `tope de ${TOPE_POR_CORRIDA} peticiones alcanzado en esta corrida — freno deliberado, no un error de red`,
    );
  }

  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) throw new Error("falta RAILWAY_API_TOKEN en el entorno");

  const desde = Date.now() - ultima;
  if (ultima && desde < ESPACIADO_MS) await dormir(ESPACIADO_MS - desde);

  usadas++;
  ultima = Date.now();

  // Railway distingue dos clases de token por CABECERA, no por formato:
  //   - token de cuenta  -> Authorization: Bearer
  //   - token de proyecto -> Project-Access-Token, y sólo ve su propio proyecto
  // Un token de proyecto mandado como Bearer autentica pero devuelve
  // «Not Authorized» en todo lo de cuenta, que es exactamente lo que pasó la
  // primera vez. `RAILWAY_TOKEN_TIPO` permite fijarlo; por defecto, proyecto.
  const tipo = (process.env.RAILWAY_TOKEN_TIPO ?? "proyecto").toLowerCase();
  const cabeceras =
    tipo === "cuenta"
      ? { authorization: `Bearer ${token}` }
      : { "project-access-token": token };

  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabeceras },
    body: JSON.stringify({ query, variables }),
  });

  if (r.status === 429) {
    const espera = Number(r.headers.get("retry-after") ?? 0);
    throw new Error(
      `429 de Railway · Retry-After: ${espera || "sin cabecera"} s. Se detiene: reintentar en bucle es lo que hay que evitar`,
    );
  }

  const texto = await r.text();
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} · ${texto.slice(0, 300)}`);
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    throw new Error(`respuesta no-JSON · ${texto.slice(0, 200)}`);
  }

  if (cuerpo.errors?.length) {
    const msg = cuerpo.errors.map((e) => e.message).join(" · ");
    throw new Error(`GraphQL: ${msg.slice(0, 400)}`);
  }
  return cuerpo.data;
}
