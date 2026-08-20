/**
 * AC-API-1 — ninguna entrada malformada de la frontera produce un 5xx.
 *
 * ## Por qué importa más de lo que parece
 *
 * Un 5xx no es «un error feo». El cliente offline lo clasifica como
 * **recuperable** (`src/lib/cola-local.ts:276-278`) y además **corta el lote**
 * con un `break` (`src/lib/cola-local.ts:337-344`). Es decir: un solo registro
 * con un valor que la base nunca va a aceptar **bloquea la cola entera del
 * turno**, para siempre, y con ella la evidencia de H1 que es el producto.
 *
 * El caso concreto que originó este criterio, medido: `/^[0-9a-f-]{36}$/i`
 * —el guard de id de `sesiones/route.ts` y `salida/route.ts`— acepta 36 guiones.
 * Ese id pasa el 400, llega a Postgres, produce `22P02`, sale como 503, y la cola
 * lo reintenta hasta el fin de los tiempos.
 *
 * ## Por exclusión, no por lista
 *
 * Las rutas **se descubren escaneando `src/app/api/`**, no se enumeran. Es la
 * lección que este repo pagó con `api/cobro-salida/` (`CLAUDE.md` §1): una lista
 * blanca de tres rutas no ve la cuarta. Una ruta nueva entra sola a este
 * verificador el día que se crea el archivo.
 *
 * ## Es universal, y por eso el piso
 *
 * «Ninguna entrada produce 5xx» es vacuamente verdadero si no se envía ninguna.
 * Fallan: corpus vacío, cero rutas descubiertas, o una ruta descubierta que no
 * recibió una sola petición.
 *
 * ## Lo que NO prueba, y se dice en la salida en vez de fingirse
 *
 * El corpus de valores degenerados es finito. Un PASS significa «ninguno de los
 * N casos enviados produjo 5xx», no «ninguna entrada posible». Leerlo de más es
 * exactamente el error que AC-H1-2 acaba de costar.
 *
 * Uso:  npm run verificar:frontera [url]
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import { EMAIL_DUENO, EMAIL_OPERADOR, EMAIL_PLATAFORMA } from "./lib/fixtures.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL_BASE = process.argv[2] ?? "http://localhost:3000";

const resultados = [];
const comprobar = (nombre, ok, detalle) => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

/** Toda ruta bajo src/app/api/, con los métodos que exporta. Por exclusión. */
function rutasDelArbol() {
  const base = join(RAIZ, "src", "app", "api");
  const salida = [];
  const recorrer = (dir, ruta) => {
    for (const entrada of readdirSync(dir)) {
      const completa = join(dir, entrada);
      if (statSync(completa).isDirectory()) {
        recorrer(completa, `${ruta}/${entrada}`);
      } else if (entrada === "route.ts" || entrada === "route.tsx") {
        const texto = readFileSync(completa, "utf8");
        // **Cualquier forma de exportar el manejador, no una.** La primera
        // versión buscaba `export async function GET`, y el envoltorio de ruta
        // las convirtió en `export const GET = rutaAutenticada(…)`: el
        // descubrimiento devolvió cero métodos para dos de las tres rutas y este
        // verificador dejó de probarlas sin decir nada. Lo cazó el piso de «toda
        // ruta descubierta recibió al menos una petición», que existe para eso —
        // y es la misma lección de AC-SCOPE-1: enumerar una forma deja agujeros.
        const metodos = [
          ...texto.matchAll(
            /export\s+(?:async\s+function|const|let|var)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
          ),
        ].map((m) => m[1]);
        salida.push({ ruta, metodos });
      }
    }
  };
  recorrer(base, "/api");
  return salida;
}

/**
 * Valores degenerados. No son «raros»: son las formas con que una frontera se
 * rompe en la práctica —el tipo equivocado, el vacío, el que casi es válido, y
 * el largo que nadie acotó—.
 */
const DEGENERADOS = [
  ["cadena vacía", ""],
  ["36 guiones (el caso medido)", "------------------------------------"],
  ["UUID casi válido", "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"],
  ["número donde va texto", 12345],
  ["nulo", null],
  ["arreglo", ["a", "b"]],
  ["objeto anidado", { a: { b: 1 } }],
  ["10 KB de texto", "A".repeat(10_240)],
  ["caracteres invisibles", "​​​​"],
  ["salto de línea", "a\n b"],
  // **El byte NUL va escrito como escape, no literal.** La primera versión lo
  // puso crudo en el fuente y convirtió a este archivo en binario para `grep`,
  // que es la clase de daño colateral que un verificador no debe causar. Y es
  // el caso que encontró el 503 del login, que nadie sabía que existía.
  ["byte NUL", `a${String.fromCharCode(0)}b`],
  // **Fechas fuera de rango.** Se agregan al corpus, pero hay que decir lo que
  // se midió y no lo que uno querría: **por sí solas NO alcanzan el parseo de
  // fechas de `POST /api/sesiones`**. Este verificador manda el mismo valor
  // degenerado en TODOS los campos a la vez, así que `validarPatente` rechaza
  // con 400 antes. Reproducido: con la cota de rango quitada del producto, este
  // criterio seguía dando **5/5 PASS**.
  //
  // O sea: el hueco no era el corpus, es **la forma de la sonda** — toda
  // validación aguas abajo de la primera guarda que rechaza queda sin
  // ejercitar. Cerrarlo exige mandar un cuerpo por lo demás VÁLIDO con un solo
  // campo degenerado, y eso crearía filas reales en cada petición (sesiones,
  // versiones de tarifa): es un cambio de diseño de este verificador, con su
  // decisión de contaminación, no un ajuste.
  //
  // Mientras tanto la propiedad la sostiene `src/lib/frontera.test.ts`, que
  // llega a `fechaDeFrontera` directo y falla si se le quita la cota (medido:
  // 3 pruebas en rojo). Se dejan igual acá porque sí ejercitan las rutas cuya
  // primera guarda no es la patente.
  ["año fuera del rango de Postgres", "-010000-01-01T00:00:00.000Z"],
  ["borde superior de Date", "+275760-09-13T00:00:00.000Z"],
  ["borde inferior de Date", "-271821-04-20T00:00:00.000Z"],
  ["fecha con forma válida e imposible", "9999-99-99T99:99:99.999Z"],
];

/** Campos que las rutas leen del cuerpo. Se envían todos a todas: una ruta que
 *  ignore un campo simplemente lo ignora, y una que lo lea sin validar se delata. */
// **Union de los campos que lee CUALQUIER ruta.** El descubrimiento de rutas
// es por exclusion (bien); el de campos era una enumeracion que no incluia los
// del alta de cliente, asi que las 66 peticiones a /api/plataforma/clientes
// morian con cuerpo vacio y la ruta pasaba sin haberse probado. Un criterio
// que siempre pasa es peor que no tenerlo (CLAUDE.md §1).
const CAMPOS = [
  "id", "patente", "entradaAt", "tecleoInicioAt", "tecleoFinAt", "clienteAhora",
  "email", "clave",
  "nombre", "zonaHoraria", "capacidadTotal", "valorHora", "fraccionMinutos",
  "montoMinimo", "emailDueno", "emailOperador",
];

const rutas = rutasDelArbol();
comprobar(
  "se descubrieron rutas de API en el árbol (piso: sin rutas no se prueba nada)",
  rutas.length > 0,
  `${rutas.length} ruta(s): ${rutas.map((r) => `${r.ruta} [${r.metodos.join(",")}]`).join(" · ")}`,
);

async function entrar(email) {
  const r = await fetch(`${URL_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, clave: process.env.CLAVE_ACCESO ?? "" }),
  });
  if (!r.ok) throw new Error(`No se pudo iniciar sesión (${email}): HTTP ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

// El rol plataforma no vive de forma permanente en la base (se limpia). Se
// siembra para esta corrida y se borra al final: sin él, la ruta de alta solo se
// podía probar con un 401, que es justo el agujero que este verificador cierra.
const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 1 }) : null;

const cincoXX = [];
const tocadas = new Set();
// Por ruta: ¿alguna sesión alcanzó su frontera (una respuesta que no sea 401/403)?
// Una ruta que responde 401 en el 100% de sus casos no probó su validación:
// probó su puerta. Ese es el agujero exacto que dejaba pasar la ruta nueva.
const alcanzada = new Set();
let casos = 0;
let limitadas = 0;

try {
  // **Una sesión por rol.** Antes se entraba solo como operador, y toda ruta que
  // exige otro rol respondía 401 antes de validar nada. Se prueba cada ruta con
  // cada rol; basta que UNA sesión alcance su frontera para haberla probado.
  // El dueño es fixture permanente igual que el operador (lo siembra
  // `sembrar.mjs`), así que no hay que crearlo acá. Se agrega porque la carga de
  // una versión nueva de tarifa (`POST /api/tarifas`) exige ese rol: sin esta
  // sesión la ruta respondía 401 en el 100% de sus casos y **el piso de abajo lo
  // delató** —4/5, «ninguna quedó en 401/403 el 100%»— que es exactamente para lo
  // que ese piso existe.
  const sesiones = [
    { rol: "operador", cookie: await entrar(EMAIL_OPERADOR) },
    { rol: "dueño", cookie: await entrar(EMAIL_DUENO) },
  ];
  if (sql) {
    await sql`
      INSERT INTO usuario (email, rol, estacionamiento_id)
      VALUES (${EMAIL_PLATAFORMA}, 'plataforma', NULL)
      ON CONFLICT (email) DO NOTHING`;
    sesiones.push({ rol: "plataforma", cookie: await entrar(EMAIL_PLATAFORMA) });
  }

  for (const { ruta, metodos } of rutas) {
    for (const metodo of metodos) {
      for (const [nombreValor, valor] of DEGENERADOS) {
        // El segmento dinámico se sustituye por el degenerado; si no lo hay, se
        // deja la ruta tal cual y el degenerado viaja solo en el cuerpo.
        const camino = ruta.replace(/\[[^\]]+\]/g, encodeURIComponent(String(valor ?? "")));
        const cuerpo = Object.fromEntries(CAMPOS.map((c) => [c, valor]));

        for (const { cookie } of sesiones) {
          let r;
          try {
            r = await fetch(`${URL_BASE}${camino}`, {
              method: metodo,
              headers: { "Content-Type": "application/json", Cookie: cookie },
              body: metodo === "GET" || metodo === "DELETE" ? undefined : JSON.stringify(cuerpo),
            });
          } catch (e) {
            cincoXX.push(`${metodo} ${ruta} · ${nombreValor} · sin respuesta: ${e.message}`);
            continue;
          }

          casos++;
          tocadas.add(ruta);
          if (r.status !== 401 && r.status !== 403) alcanzada.add(ruta);
          // 429 es una respuesta legítima de la frontera —el limitador de intentos
          // del login—, no un 5xx. Se cuenta aparte para poder declararlo.
          if (r.status === 429) limitadas++;
          if (r.status >= 500) {
            cincoXX.push(`${metodo} ${ruta} · ${nombreValor} → HTTP ${r.status}`);
          }
        }
      }
    }
  }
} catch (e) {
  comprobar("la corrida llegó al final", false, e.message);
} finally {
  if (sql) {
    await sql`DELETE FROM usuario WHERE email = ${EMAIL_PLATAFORMA}`.catch(() => {});
    await sql.end();
  }
}

comprobar(
  "el corpus enviado no está vacío (piso: un universal pasa sobre la nada)",
  casos > 0,
  `${casos} caso(s) = ${rutas.reduce((n, r) => n + r.metodos.length, 0)} punto(s) de entrada × ${DEGENERADOS.length} valor(es)`,
);

comprobar(
  "toda ruta descubierta recibió al menos una petición",
  tocadas.size === rutas.length,
  tocadas.size === rutas.length
    ? `${tocadas.size}/${rutas.length}`
    : `sin probar: ${rutas.filter((r) => !tocadas.has(r.ruta)).map((r) => r.ruta).join(", ")}`,
);

// **Piso que delata la evasión por rol.** Una ruta que respondió 401/403 en el
// 100% de sus casos no probó su validación: probó su puerta. Es exactamente lo
// que le pasaba a /api/plataforma/clientes cuando el verificador entraba solo
// como operador — daba PASS sin haber tocado una sola guarda de la ruta.
comprobar(
  "toda ruta alcanzó su frontera con algún rol (ninguna quedó en 401/403 el 100%)",
  alcanzada.size === rutas.length,
  alcanzada.size === rutas.length
    ? `${alcanzada.size}/${rutas.length} validadas de verdad, no solo su puerta`
    : `solo su puerta (401/403 siempre): ${rutas.filter((r) => !alcanzada.has(r.ruta)).map((r) => r.ruta).join(", ")}`,
);

comprobar(
  "ninguna entrada malformada produjo un 5xx",
  cincoXX.length === 0,
  cincoXX.length ? `${cincoXX.length}: ${cincoXX.slice(0, 4).join(" | ")}` : `${casos} caso(s) sin 5xx`,
);

console.log(
  `\nAlcance declarado: ${casos} caso(s) de un corpus finito de ${DEGENERADOS.length} valores ` +
    `sobre ${CAMPOS.length} campos. ${limitadas} respuesta(s) 429 del limitador de intentos, ` +
    `que son frontera legítima y no 5xx.`,
);
console.log("Un PASS dice «ninguno de estos casos», NO «ninguna entrada posible».");

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);

if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  console.log("\nUn 5xx en la frontera no es cosmético: la cola local lo trata como");
  console.log("recuperable y corta el lote. Un solo registro así bloquea la sincronización");
  console.log("entera del turno, y con ella la evidencia de H1.");
  process.exit(1);
}

console.log("AC-API-1: PASS");
