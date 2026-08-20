/**
 * Verificación del temporizador de permanencia (spec.md §5, línea 176).
 *
 * "El temporizador muestra el tiempo transcurrido por cada sesión activa."
 *
 * **Por qué existe.** Hasta hoy esa frase era la única capacidad del núcleo sin
 * una sola aserción en el repo. `duracion()` vive en
 * `src/app/pantalla-operador.tsx`, no se exporta y ninguna prueba la importa;
 * `verificar-meas2.mjs` mira los números del panel del DUEÑO —otra pantalla que
 * también muestra cifras— y `verificar-m4.mjs` dice explícitamente que prueba la
 * regla de reconciliación "no el intervalo del temporizador". Acreditar una
 * capacidad parecida ya pasó en este proyecto y no se vuelve a hacer.
 *
 * **Por qué mira el navegador y no el fuente.** Misma lección que
 * `verificar-ui.mjs`: AC-UI-1, AC-UI-2 y AC-UI-3 daban PASS mientras el
 * navegador aplicaba otra tipografía, porque miraban el fuente. Acá se lee el
 * texto RENDERIZADO de la fila, dos veces separadas en el tiempo, y se compara
 * contra `entrada_at`.
 *
 * Qué comprueba:
 *
 *   1. Correspondencia · con una sesión activa registrada por el operador, la
 *      fila muestra EXACTAMENTE los minutos que implica su `entrada_at`.
 *      Igualdad literal, sin tolerancia.
 *   2. Avance solo · se lee, se espera, se relee: el valor tiene que haber
 *      cambiado, y hacia arriba. Un temporizador congelado es el modo de falla
 *      realista y hoy nadie lo vería.
 *   3. Formato · exactamente el que la pantalla promete hoy: minutos, y horas
 *      más minutos a partir de la hora. No se inventa formato ni se toca la UI;
 *      el verificador reimplementa la regla de `duracion()` y exige igualdad
 *      literal con lo renderizado.
 *   4. Atribución · con dos sesiones activas de antigüedad muy distinta, cada
 *      fila se compara contra SU PROPIO valor esperado. Un temporizador que
 *      pintara en cada fila el tiempo de la vecina queda cazado acá.
 *
 * ---------------------------------------------------------------------------
 * POR QUÉ LA CORRESPONDENCIA NO TIENE TOLERANCIA, Y POR QUÉ IGUAL ES SANA
 * ---------------------------------------------------------------------------
 *
 * La versión anterior aceptaba `total === esperado || total === esperado - 1`.
 * Sobre un display cuya granularidad es el minuto, tolerar un minuto es no
 * afirmar nada: con `Math.floor(ms / 60_000) - 1` plantado en `duracion()`
 * daba 15/15 PASS **imprimiendo su propia contradicción** ("pantalla 2 min ·
 * entrada_at implica 3 min · PASS").
 *
 * La tolerancia tenía una causa real: la pantalla repinta cada 30 s
 * (`setInterval` de `pantalla-operador.tsx`), así que lo pintado puede estar
 * hasta 30 s rancio, y una lectura tomada cerca del cruce de minuto puede
 * legítimamente ir un minuto atrás. El diseño viejo AGRAVABA eso a propósito:
 * envejecía las sesiones dejando el cruce a 15-20 s de la lectura, para que el
 * avance se viera rápido. Los dos objetivos chocaban y se resolvió debilitando
 * la aserción.
 *
 * Acá se resuelve moviendo el problema al eje del tiempo en vez de al de la
 * aserción. `entrada_at` no se retrasa una cantidad redonda: se retrasa a una
 * **fase** elegida dentro del minuto (`FASE_ANCLAJE_MS`), y una lectura solo se
 * usa para afirmar correspondencia si en ese instante el transcurrido real está
 * dentro de la VENTANA SEGURA: al menos `VENTANA_DESDE_MS` después del último
 * cruce de minuto.
 *
 * El argumento, explícito porque es lo que sostiene la igualdad exacta: sea T
 * el instante de lectura y p el instante del último repintado, con T - p <= 30 s
 * (repintado cada 30 s; el primer pintado es el del load, que es fresco). Si el
 * transcurrido en T lleva `fase >= 35 s` dentro de su minuto, entonces el
 * transcurrido en p lleva al menos 5 s dentro del MISMO minuto, luego
 * `floor(p) === floor(T)` y lo pintado es exactamente lo esperado. Los 5 s de
 * sobra son el margen sobre el repintado. Fuera de esa ventana no se afirma
 * nada: la comprobación **falla** con "no se alcanzó la ventana segura", nunca
 * se salta.
 *
 * Y el cruce de minuto sigue quedando cerca (a `60 s - FASE_ANCLAJE_MS` del
 * anclaje) para que el avance sea observable rápido: las dos propiedades ya no
 * compiten porque se observan en instantes distintos, no con criterios
 * distintos.
 *
 * Consecuencia buscada: **un error sistemático de un minuto hace fallar el
 * verificador**, en las cuatro comprobaciones que dependen del valor.
 *
 * ---------------------------------------------------------------------------
 * POR QUÉ EL DENOMINADOR ES FIJO
 * ---------------------------------------------------------------------------
 *
 * La versión anterior declaraba 15 comprobaciones sana y 13 congelada: las dos
 * `el valor nuevo sigue correspondiendo…` vivían dentro de un `if (despues)` y
 * DESAPARECÍAN en vez de fallar. "11/13" se lee mejor que el honesto "11/15", y
 * el resumen es justo lo que consume el generador de evidencia.
 *
 * Es la misma lección que `scripts/verificar-verificadores.mjs` existe para
 * hacer cumplir —"un verificador que se muere miente hacia el lado optimista"—
 * por otra vía: rama condicional en vez de excepción, que aquel guard no
 * detecta.
 *
 * Por eso el conjunto de comprobaciones se declara ENTERO y por adelantado en
 * `PLAN`, con todas en FAIL "no se llegó a ejecutar". Correr una comprobación
 * solo puede cambiar su veredicto, nunca la existencia de la fila. Muera el
 * script donde muera, el denominador es el mismo, y `comprobar()` con un nombre
 * fuera del plan es a su vez un FAIL.
 *
 * ---------------------------------------------------------------------------
 * LÍMITES DECLARADOS
 * ---------------------------------------------------------------------------
 *
 * - **No se comprueba la cota de INT-14 sobre el display.** El camino del dinero
 *   la tiene (`src/lib/tiempo.ts`); `duracion()` no, y con el reloj del
 *   dispositivo adelantado le pinta "-4 min" al operador. Es un hallazgo de
 *   producto, fuera del alcance de este verificador: acá no se induce un reloj
 *   adelantado ni se afirma nada sobre ese caso.
 * - No se toca el flujo offline: no se desconecta la red ni se cambia de dónde
 *   lee la pantalla.
 *
 * Cómo se consigue una sesión "vieja" sin esperar dos horas: el operador la
 * registra de verdad desde su pantalla, y después se retrasa `entrada_at` en la
 * base con el reloj de ESTA máquina, que es el mismo que corre el navegador, así
 * que no se mezclan relojes de máquinas distintas (ver la nota de
 * `verificar-m4.mjs` sobre `greatest(now(), entrada_at)`).
 *
 * Fixtures con prefijo FIXT (spec.md §11). La limpieza va al INICIO y **nunca al
 * final**, como manda `scripts/lib/fixtures.mjs`: borrar al terminar destruía la
 * sesión cerrada que `verificar-salida.mjs` deja a propósito para
 * `verificar-meas1.mjs` (medido: `cerradas: 1` → `cerradas: 0` después de esta
 * corrida).
 *
 * Uso:  node scripts/verificar-temporizador.mjs [url]
 * Requiere el servidor levantado y DATABASE_URL en el entorno.
 */

import { existsSync } from "node:fs";
import postgres from "postgres";
import puppeteer from "puppeteer-core";
import { EMAIL_OPERADOR, limpiarFixtures } from "./lib/fixtures.mjs";
import { leerJson } from "./lib/respuesta.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const CLAVE = process.env.CLAVE_ACCESO ?? "";

/** Recién entrada: ejercita la rama de solo minutos. */
const RECIENTE = "FIXT50";
/** Lleva horas adentro: ejercita la rama con horas y la atribución por fila. */
const ANTIGUA = "FIXT51";

/** Minutos enteros que se le restan a cada `entrada_at`. */
const MINUTOS_ATRAS = {
  [RECIENTE]: 5,
  [ANTIGUA]: 2 * 60 + 20,
};

/**
 * Fase dentro del minuto en el instante del anclaje: `entrada_at` queda a
 * N minutos y `FASE_ANCLAJE_MS` de ahora.
 *
 * 38 s deja la lectura DENTRO de la ventana segura de entrada (>= 35 s) desde el
 * primer intento y hasta 20 s después —de sobra para el reload y las dos
 * peticiones que van en el medio— y a la vez pone el cruce de minuto a 22 s, que
 * es lo que hace observable el avance sin esperar un minuto entero.
 */
const FASE_ANCLAJE_MS = 38_000;

/** Cada cuánto repinta la pantalla el transcurrido (`setInterval` del componente). */
const REPINTADO_MS = 30_000;

/**
 * Ventana segura: cuánto tiene que llevar el transcurrido DENTRO de su minuto
 * para que lo pintado no pueda ser del minuto anterior. `REPINTADO_MS` + 5 s de
 * margen. Ver el argumento completo en la cabecera.
 */
const VENTANA_DESDE_MS = REPINTADO_MS + 5_000;
/** Cota superior de la ventana: no se lee pegado al cruce siguiente. */
const VENTANA_HASTA_MS = 58_000;

/**
 * Ventana máxima para ver un cambio Y volver a una lectura segura después.
 *
 * Peor caso analítico del avance: 60 s (cruce de minuto) + 30 s (repintado) =
 * 90 s; y la lectura segura posterior llega a lo sumo 57 s después. 180 s es el
 * doble del peor caso del avance. El valor viejo (100 s) dejaba 10 % de margen
 * sobre 90 s, en el verificador de navegador más largo del repo y el único con
 * presupuesto temporal: `LEARNINGS.md` ya registra tres falsos positivos
 * distintos por contención entre instancias de Edge, y un FAIL falso acá es
 * indistinguible de un congelamiento real.
 */
const ESPERA_AVANCE_MS = 180_000;

/** Cuánto se espera, como mucho, a que el transcurrido entre en la ventana segura. */
const ESPERA_VENTANA_MS = 75_000;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const navegador = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
]
  .filter(Boolean)
  .find((p) => existsSync(p));

if (!navegador) {
  console.error("FAIL · no se encontró Edge. Definí CHROME_PATH.");
  process.exit(1);
}

// Precondición mecanizada, no confiada al humano: las activas de una corrida
// anterior se copian al dispositivo y ensucian la lista que se va a leer.
await limpiarFixtures();

/**
 * El conjunto de comprobaciones, declarado entero antes de correr ninguna.
 * Ver "POR QUÉ EL DENOMINADOR ES FIJO" en la cabecera.
 */
const PLAN = [
  "el operador llega a su pantalla",
  "las dos sesiones activas del operador llegaron a la base",
  "el servidor lista las dos sesiones con el entrada_at que se ancló",
  // Va ANTES de las de correspondencia porque es su precondición: sin la lista
  // del servidor aplicada, lo que se mida es el primer pintado —el que sale de
  // IndexedDB— y no lo que la app sabe. Ver el bloque de la segunda pintada.
  "la lista del servidor llegó y el navegador la pintó antes de medir",
  ...[RECIENTE, ANTIGUA].flatMap((p) => [
    `${p} · el formato es el que promete la pantalla`,
    `${p} · el transcurrido es exactamente el que implica su entrada_at`,
  ]),
  "con dos activas, cada fila muestra su propio tiempo y no el de la otra",
  "la que lleva horas adentro muestra más tiempo que la recién entrada",
  ...[RECIENTE, ANTIGUA].flatMap((p) => [
    `${p} · el temporizador avanza solo, sin que nadie toque la pantalla`,
    `${p} · el valor nuevo es exactamente el que implica su entrada_at`,
  ]),
  "la corrida completó sin excepción",
];

const estado = new Map(
  PLAN.map((nombre) => [nombre, { ok: false, detalle: "no se llegó a ejecutar", corrida: false }]),
);

const comprobar = (nombre, ok, detalle = "") => {
  if (!estado.has(nombre)) {
    // Una comprobación fuera del plan rompe la garantía del denominador fijo.
    // Se reporta como defecto del verificador —entra al recuento como FAIL— y
    // no se acepta en silencio.
    PLAN.push(nombre);
    estado.set(nombre, { ok: false, detalle: "comprobación fuera del PLAN", corrida: true });
    console.log(`FAIL · ${nombre} · comprobación fuera del PLAN declarado`);
    return;
  }
  estado.set(nombre, { ok, detalle, corrida: true });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

const sql = postgres(url, { max: 1 });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * La regla de `duracion()` de `src/app/pantalla-operador.tsx`, reimplementada.
 *
 * Es a propósito una copia y no un import: el fuente es cliente, TypeScript y
 * privado del componente. Reimplementarla convierte el formato en un contrato
 * comprobable —si la pantalla cambia de formato, esto falla y hay que decidirlo
 * a conciencia— en vez de en un detalle que nadie mira.
 */
const formatear = (totalMin) => {
  const h = Math.floor(totalMin / 60);
  return h > 0 ? `${h} h ${totalMin % 60} min` : `${totalMin} min`;
};

/**
 * Minutos totales que representa un texto renderizado, o null si no es del
 * formato. Solo dígitos: "undefined min", "-4 min", "" y "FIXT50" dan null, así
 * que la comprobación de formato subsume a la de "no es un placeholder" que
 * antes figuraba aparte —y que pasaba con las tres.
 */
const parsear = (texto) => {
  const conHora = /^(\d+) h (\d+) min$/.exec(texto);
  if (conHora) return Number(conHora[1]) * 60 + Number(conHora[2]);
  const soloMin = /^(\d+) min$/.exec(texto);
  if (soloMin) return Number(soloMin[1]);
  return null;
};

const minutosEsperados = (entradaMs, instanteMs) =>
  Math.floor((instanteMs - entradaMs) / 60_000);

/** Lo que se ancló en la base, por patente: la verdad contra la que se compara. */
const anclaje = {};
/** Lo que el SERVIDOR devuelve por patente. Es el dato del que deriva la pantalla. */
const delServidor = new Map();
const entradaDe = (patente) => {
  const v = delServidor.get(patente);
  return Number.isFinite(v) ? v : null;
};

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: navegador,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  // El reloj es un `setInterval`: en una pestaña oculta el navegador lo frena.
  await page.bringToFront();

  await page.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('[data-testid="email"]', EMAIL_OPERADOR);
  await page.type('[data-testid="clave"]', CLAVE);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('[data-testid="entrar"]'),
  ]);
  comprobar(
    "el operador llega a su pantalla",
    (await page.$('[data-testid="nuevo-ingreso"]')) !== null,
    new URL(page.url()).pathname,
  );

  // Dispositivo limpio: un espejo de una corrida anterior mostraría filas que no
  // son las de esta prueba.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("estacionamiento");
        req.onsuccess = req.onerror = req.onblocked = () => resolve(undefined);
      }),
  );
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="nuevo-ingreso"]');

  // ---- El operador registra las dos sesiones desde su pantalla -------------
  for (const patente of [RECIENTE, ANTIGUA]) {
    await page.waitForSelector('[data-testid="nuevo-ingreso"]');
    await page.click('[data-testid="nuevo-ingreso"]');
    await page.waitForSelector('[data-testid="campo-patente"]');
    await page.type('[data-testid="campo-patente"]', patente, { delay: 15 });
    await page.click('[data-testid="confirmar-ingreso"]');
    await esperar(400);
  }

  const activasEnBase = async () => {
    const [{ n }] = await sql`
      SELECT count(*)::int AS n
      FROM sesion_vehiculo WHERE patente LIKE 'FIXT5%' AND estado = 'activa'
    `;
    return n;
  };

  let enBase = 0;
  for (let i = 0; i < 40 && enBase < 2; i++) {
    await esperar(250);
    enBase = await activasEnBase();
  }
  comprobar(
    "las dos sesiones activas del operador llegaron a la base",
    enBase === 2,
    `${enBase}/2`,
  );

  // ---- Se anclan con el reloj de esta máquina ------------------------------
  // No `now() - interval`: ese es el reloj de Postgres, y el transcurrido lo
  // calcula el navegador con el suyo. Mezclarlos mediría el desfase entre
  // máquinas y no el temporizador.
  //
  // Las dos se anclan en el mismo tramo de código: quedan con la misma fase
  // dentro del minuto (milisegundos de diferencia), así que una sola espera a la
  // ventana segura sirve para las dos.
  for (const [patente, minutos] of Object.entries(MINUTOS_ATRAS)) {
    const entrada = Date.now() - (minutos * 60_000 + FASE_ANCLAJE_MS);
    anclaje[patente] = entrada;
    await sql`
      UPDATE sesion_vehiculo
      SET entrada_at = ${new Date(entrada)}
      WHERE patente = ${patente} AND estado = 'activa'
    `;
  }

  // La referencia es el `entrada_at` que el SERVIDOR le entrega al navegador.
  const rLogin = await fetch(`${URL_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL_OPERADOR, clave: CLAVE }),
  });
  await leerJson(rLogin);
  const cookie = (rLogin.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const rLista = await fetch(`${URL_BASE}/api/sesiones`, {
    headers: { Cookie: cookie },
    cache: "no-store",
  });
  const cuerpoLista = await leerJson(rLista);
  for (const s of Array.isArray(cuerpoLista.sesiones) ? cuerpoLista.sesiones : []) {
    delServidor.set(s.patente, new Date(s.entradaAt).getTime());
  }

  // Que el servidor devuelva LO QUE SE ANCLÓ, no cualquier cosa: sin esto, un
  // servidor que devolviera otro instante haría que todo lo demás se comparara
  // contra una referencia equivocada y "cuadrara" igual.
  const desvio = (p) => {
    const v = entradaDe(p);
    return v === null ? null : Math.abs(v - anclaje[p]);
  };
  const desvios = [RECIENTE, ANTIGUA].map(desvio);
  comprobar(
    "el servidor lista las dos sesiones con el entrada_at que se ancló",
    desvios.every((d) => d !== null && d <= 1_500),
    `HTTP ${rLista.status} · desvíos [${desvios.map((d) => (d === null ? "sin dato" : `${d} ms`)).join(", ")}]`,
  );

  // ---- Lo que el navegador RENDERIZA --------------------------------------
  //
  // **La lista se pinta DOS veces, y hay que asertar sobre la segunda.**
  //
  // Los `<li>` salen primero de IndexedDB —eso es offline-first, y es correcto:
  // la pantalla no espera a la red para mostrar lo que el dispositivo sabe—. La
  // lista del servidor llega después y la pisa. En esta prueba el `entrada_at`
  // se retrasó **por SQL, a espaldas de la app**, así que el valor del
  // dispositivo es deliberadamente distinto del anclado: ningún cliente puede
  // conocerlo antes de que el servidor se lo diga.
  //
  // La sonda anterior esperaba `lista-activas li` y leía ahí. Eso es leer el
  // primer pintado y reportar como defecto del producto **un estado
  // intermedio**: daba 11/14 con las dos filas en "0 min", y las mismas dos
  // comprobaciones de "avanza solo" —que leen más tarde— pasaban con el valor
  // exacto. Dos lecturas del mismo hecho discrepando: la que no esperó estaba mal.
  //
  // `networkidle2` no alcanza: se cumple antes de que React hidrate y dispare su
  // fetch, así que la respuesta que importa todavía no salió.
  //
  // Lo que sigue **no ablanda ninguna aserción de valor**: la igualdad exacta
  // contra `entrada_at` queda intacta. Solo deja de medirse en vuelo. Y tiene
  // piso: si la lista del servidor no llega, o el pintado no se asienta dentro
  // del límite, se **falla** — un temporizador que nunca se asienta también es
  // un defecto.
  const listaDelServidor = page.waitForResponse(
    (r) =>
      r.url().includes("/api/sesiones") &&
      r.request().method() === "GET" &&
      r.status() === 200,
    { timeout: 20_000 },
  );
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="lista-activas"] li');

  // La espera vive más abajo, después de `leerFila`: necesita leer el DOM.

  /**
   * Texto del transcurrido de UNA fila, identificada por su patente.
   *
   * Se descarta el sufijo "sin sincronizar", que comparte el párrafo, y se
   * devuelve el instante de lectura tomado por el reloj de la página: es el
   * mismo reloj con el que la pantalla calculó el valor, y se toma en el mismo
   * bloque síncrono que el texto, así que no pueden corresponder a minutos
   * distintos.
   */
  const leerFila = (patente) =>
    page.evaluate((p) => {
      const fila = document.querySelector('li[data-patente="' + p + '"]');
      if (!fila) return null;
      const parrafo = [...fila.querySelectorAll("p")].find(
        (el) => !el.classList.contains("patente"),
      );
      if (!parrafo) return null;
      return {
        texto: parrafo.textContent.split("·")[0].trim(),
        leidoEn: Date.now(),
      };
    }, patente);

  // ---- La segunda pintada: se espera a que la lista del servidor esté aplicada
  //
  // Ver el bloque de arriba. Acá se consuma la espera, ahora que `leerFila`
  // existe. Tiene piso propio: si la lista no llega o el pintado no se asienta,
  // esta comprobación **falla** en vez de dejar medir en vuelo.
  let listaAplicada = false;
  try {
    await listaDelServidor;
    // La respuesta llegó; falta que la app lea el cuerpo y que React pinte. Se
    // espera a que el texto de la fila deje de cambiar dos lecturas seguidas.
    // **La estabilidad no puede tapar un valor equivocado**: el valor se compara
    // igual, contra `entrada_at`, en `comprobarCorrespondencia`.
    const arranque = Date.now();
    let previo = null;
    while (Date.now() - arranque < 8_000) {
      const actual = (await leerFila(ANTIGUA))?.texto ?? null;
      if (actual !== null && actual === previo) {
        listaAplicada = true;
        break;
      }
      previo = actual;
      await esperar(250);
    }
  } catch {
    listaAplicada = false;
  }

  comprobar(
    "la lista del servidor llegó y el navegador la pintó antes de medir",
    listaAplicada,
    listaAplicada
      ? "GET /api/sesiones 200 y el transcurrido se asentó"
      : "no llegó la lista, o el pintado no se asentó en 8 s: lo que se mida desde acá es un estado intermedio",
  );

  /**
   * Lectura tomada DENTRO de la ventana segura (ver cabecera). Devuelve también
   * si lo consiguió: fuera de la ventana no se afirma correspondencia, se falla.
   */
  const leerEnVentanaSegura = async (patente, limite = ESPERA_VENTANA_MS) => {
    const entrada = entradaDe(patente);
    const arranque = Date.now();
    let ultima = null;
    do {
      const lectura = await leerFila(patente);
      if (lectura) {
        ultima = lectura;
        if (entrada !== null) {
          const transcurrido = lectura.leidoEn - entrada;
          const fase = ((transcurrido % 60_000) + 60_000) % 60_000;
          if (
            transcurrido >= 0 &&
            fase >= VENTANA_DESDE_MS &&
            fase <= VENTANA_HASTA_MS
          ) {
            return { lectura, seguro: true, fase };
          }
        }
      }
      await esperar(500);
    } while (Date.now() - arranque < limite);
    return { lectura: ultima, seguro: false, fase: null };
  };

  /** Minutos esperados para una lectura concreta, o null si falta algo. */
  const esperadoDe = (patente, lectura) => {
    const entrada = entradaDe(patente);
    if (!lectura || entrada === null) return null;
    return minutosEsperados(entrada, lectura.leidoEn);
  };

  /** Igualdad EXACTA contra `entrada_at`, y solo sobre una lectura segura. */
  const comprobarCorrespondencia = (nombre, patente, medicion) => {
    const lectura = medicion?.lectura ?? null;
    const total = lectura ? parsear(lectura.texto) : null;
    const esperado = esperadoDe(patente, lectura);
    const detalle = !lectura
      ? "(sin lectura de esa fila)"
      : `pantalla "${lectura.texto}" · entrada_at implica ` +
        (esperado === null ? '"(sin referencia)"' : `"${formatear(Math.max(esperado, 0))}"`) +
        (medicion.seguro
          ? ` · leído a ${Math.round(medicion.fase / 1000)} s del cruce de minuto`
          : " · NO se alcanzó la ventana segura: la lectura no permite afirmar nada");
    comprobar(
      nombre,
      Boolean(medicion?.seguro) && total !== null && esperado !== null && total === esperado,
      detalle,
    );
  };

  const primera = {};
  for (const patente of [RECIENTE, ANTIGUA]) {
    primera[patente] = await leerEnVentanaSegura(patente);
    const lectura = primera[patente].lectura;
    const texto = lectura?.texto ?? "";
    const total = lectura ? parsear(texto) : null;

    comprobar(
      `${patente} · el formato es el que promete la pantalla`,
      total !== null && formatear(total) === texto,
      lectura
        ? `"${texto}"` + (total === null ? "" : ` · canónico "${formatear(total)}"`)
        : "(sin lectura)",
    );

    comprobarCorrespondencia(
      `${patente} · el transcurrido es exactamente el que implica su entrada_at`,
      patente,
      primera[patente],
    );
  }

  // ---- Atribución: cada fila contra SU PROPIO valor esperado ---------------
  // No basta con que las dos filas difieran entre sí: con la vecina plantada
  // —cada fila pintando el tiempo de la otra— los textos siguen siendo
  // distintos y un `textoReciente !== textoAntigua` pasa. Se compara cada fila
  // contra lo suyo, y se exige además que lo suyo sea distinguible.
  const lecturaReciente = primera[RECIENTE]?.lectura ?? null;
  const lecturaAntigua = primera[ANTIGUA]?.lectura ?? null;
  const totalReciente = lecturaReciente ? parsear(lecturaReciente.texto) : null;
  const totalAntigua = lecturaAntigua ? parsear(lecturaAntigua.texto) : null;
  const propioReciente = esperadoDe(RECIENTE, lecturaReciente);
  const propioAntigua = esperadoDe(ANTIGUA, lecturaAntigua);

  comprobar(
    "con dos activas, cada fila muestra su propio tiempo y no el de la otra",
    primera[RECIENTE]?.seguro === true &&
      primera[ANTIGUA]?.seguro === true &&
      propioReciente !== null &&
      propioAntigua !== null &&
      propioReciente !== propioAntigua &&
      totalReciente === propioReciente &&
      totalAntigua === propioAntigua,
    `${RECIENTE} muestra "${lecturaReciente?.texto ?? "(sin fila)"}" y lo suyo es ` +
      `"${propioReciente === null ? "?" : formatear(Math.max(propioReciente, 0))}" · ` +
      `${ANTIGUA} muestra "${lecturaAntigua?.texto ?? "(sin fila)"}" y lo suyo es ` +
      `"${propioAntigua === null ? "?" : formatear(Math.max(propioAntigua, 0))}"`,
  );

  comprobar(
    "la que lleva horas adentro muestra más tiempo que la recién entrada",
    totalReciente !== null && totalAntigua !== null && totalAntigua > totalReciente,
    `${totalAntigua} min vs ${totalReciente} min`,
  );

  // ---- Avance solo: leer, esperar, releer ----------------------------------
  // Nadie toca la pantalla en este tramo. Si el valor no cambia, el temporizador
  // está congelado, que es exactamente el modo de falla que nadie veía.
  const arranque = Date.now();
  const segunda = {};
  const pendientes = new Set(
    [RECIENTE, ANTIGUA].filter((p) => primera[p]?.lectura),
  );

  while (pendientes.size > 0 && Date.now() - arranque < ESPERA_AVANCE_MS) {
    await esperar(1000);
    for (const patente of [...pendientes]) {
      const lectura = await leerFila(patente);
      if (lectura && lectura.texto !== primera[patente].lectura.texto) {
        segunda[patente] = lectura;
        pendientes.delete(patente);
      }
    }
  }

  const espera = Math.round((Date.now() - arranque) / 1000);
  for (const patente of [RECIENTE, ANTIGUA]) {
    const antes = primera[patente]?.lectura ?? null;
    const despues = segunda[patente] ?? null;
    const totalAntes = antes ? parsear(antes.texto) : null;
    const totalDespues = despues ? parsear(despues.texto) : null;

    comprobar(
      `${patente} · el temporizador avanza solo, sin que nadie toque la pantalla`,
      totalAntes !== null && totalDespues !== null && totalDespues > totalAntes,
      despues
        ? `"${antes.texto}" → "${despues.texto}"`
        : `sigue en "${antes?.texto ?? "(sin fila)"}" tras ${espera} s: congelado`,
    );

    // Fuera de cualquier `if`: una pantalla congelada tiene que FALLAR acá, no
    // desaparecer del recuento. La lectura se toma FRESCA —no se reusa la de
    // antes— justamente para que un valor rancio se vea como lo que es.
    comprobarCorrespondencia(
      `${patente} · el valor nuevo es exactamente el que implica su entrada_at`,
      patente,
      await leerEnVentanaSegura(patente),
    );
  }

  comprobar("la corrida completó sin excepción", true);
} catch (e) {
  comprobar(
    "la corrida completó sin excepción",
    false,
    String(e?.message ?? e).split("\n")[0],
  );
} finally {
  if (browser) await browser.close();
  // Sin borrado acá: la limpieza va al INICIO (`scripts/lib/fixtures.mjs`).
  // Borrar al final destruía la sesión cerrada que `verificar-salida.mjs` deja
  // para `verificar-meas1.mjs`, y trabajaría en contra de un banco que acumula.
  await sql.end();
}

// Las que nunca corrieron se imprimen igual, como FAIL: lo que no se ejecutó no
// puede desaparecer del denominador.
for (const nombre of PLAN) {
  const r = estado.get(nombre);
  if (!r.corrida) console.log(`FAIL · ${nombre} · no se llegó a ejecutar`);
}

const fallidos = PLAN.filter((nombre) => !estado.get(nombre).ok);
console.log(`\n${PLAN.length - fallidos.length}/${PLAN.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.join(", "));
  process.exit(1);
}
console.log("TEMPORIZADOR (spec.md §5): PASS");
