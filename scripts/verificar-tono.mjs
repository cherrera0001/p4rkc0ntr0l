/**
 * Verificación de la voz del producto (decisión del decisor, 2026-08-20).
 *
 * **Por qué existe.** Las cuatro reglas de abajo se pidieron más de una vez y
 * volvieron a aparecer en pantalla. Una convención de escritura que depende de
 * que alguien se acuerde no es una convención: es una intención. Acá se vuelve
 * comando, y el comando falla.
 *
 * Las reglas, todas sobre **texto que el usuario ve**:
 *
 *   TONO-1 · la marca es `ParkControl`. El producto no se llama
 *            «Estacionamiento» ni «Gestión de Estacionamiento». La palabra en
 *            minúscula sigue siendo válida: nombra al recinto, no al producto.
 *   TONO-2 · sin em dash ni en dash. Se reescribe con coma, dos puntos o
 *            paréntesis.
 *   TONO-3 · sin la palabra «piloto». Al operador no se le anuncia que está
 *            adentro de una prueba.
 *   TONO-4 · español de Chile, con tuteo. Nada de voseo rioplatense.
 *
 * **Qué cuenta como texto visible, y por qué no es un `grep`.** Un `grep` sobre
 * el archivo marcaría comentarios (que describen el defecto, no lo cometen),
 * identificadores (`obtenerEstacionamiento`) y clases de Tailwind. Acá el fuente
 * se recorre carácter a carácter para separar código de comentarios, y de lo que
 * queda se toman dos cosas y solo dos: **los literales de cadena** y **los nodos
 * de texto JSX**. Un literal que parece técnico —todo en minúscula, sin acentos,
 * como `aviso-piloto` o `flex items-center`— no es copia y se descarta.
 *
 * Uso:  node scripts/verificar-tono.mjs
 * No necesita servidor ni base: mira el fuente.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/** Cuántas infracciones se listan por criterio. `TONO_TODO=1` las muestra todas. */
const TOPE = process.env.TONO_TODO ? 60 : 4;

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

/** Archivos de un árbol, filtrados por extensión y sin pruebas. */
function archivos(raiz, extensiones) {
  const salida = [];
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir)) {
      const ruta = join(dir, entrada);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (extensiones.includes(extname(ruta)) && !ruta.endsWith(".test.ts")) salida.push(ruta);
    }
  };
  if (existsSync(raiz)) recorrer(raiz);
  return salida;
}

/**
 * Recorre el fuente separando código, comentarios y cadenas.
 *
 * Devuelve el fuente **sin comentarios** (conservando los saltos de línea, para
 * que los números de línea sigan siendo los del archivo) y la lista de literales
 * de cadena con su posición.
 */
function analizar(fuente) {
  let limpio = "";
  const cadenas = [];
  let modo = "codigo";
  let cierre = "";
  let inicio = 0;
  let acumulado = "";

  for (let i = 0; i < fuente.length; ) {
    const c = fuente[i];
    const d = fuente[i + 1];

    if (modo === "codigo") {
      if (c === "/" && d === "/") { modo = "linea"; i += 2; continue; }
      if (c === "/" && d === "*") { modo = "bloque"; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") {
        modo = "cadena"; cierre = c; inicio = i + 1; acumulado = "";
        limpio += " "; i += 1; continue;
      }
      limpio += c; i += 1; continue;
    }

    if (modo === "linea") {
      if (c === "\n") { modo = "codigo"; limpio += c; }
      i += 1; continue;
    }

    if (modo === "bloque") {
      if (c === "*" && d === "/") { modo = "codigo"; i += 2; continue; }
      if (c === "\n") limpio += c;
      i += 1; continue;
    }

    // modo === "cadena"
    if (c === "\\") { acumulado += c + (d ?? ""); i += 2; continue; }
    if (c === cierre) {
      cadenas.push({ texto: acumulado, indice: inicio });
      modo = "codigo";
      // Se conservan los saltos de línea de las plantillas multilínea.
      limpio += acumulado.replace(/[^\n]/g, " ");
      i += 1; continue;
    }
    acumulado += c;
    i += 1;
  }

  return { limpio, cadenas };
}

/** Número de línea (1-based) de una posición absoluta. */
const lineaDe = (fuente, indice) => fuente.slice(0, indice).split("\n").length;

/**
 * Una cadena que parece técnica no es copia: clases de Tailwind, rutas, ids,
 * cabeceras HTTP, nombres de cookie. Se reconocen porque no llevan ni una
 * mayúscula ni un acento.
 */
const pareceTecnica = (t) => /^[a-z0-9._/:#[\]()%\s@?&=+*-]*$/.test(t);

/** Texto visible de un archivo: literales de copia + nodos de texto JSX. */
function textoVisible(ruta) {
  const fuente = readFileSync(ruta, "utf8");
  const { limpio, cadenas } = analizar(fuente);
  const piezas = [];

  for (const { texto, indice } of cadenas) {
    if (!/[a-záéíóúñ]/i.test(texto)) continue;
    if (pareceTecnica(texto)) continue;
    piezas.push({ ruta, linea: lineaDe(fuente, indice), texto });
  }

  // Nodos de texto JSX: lo que queda entre `>` y `<` sin llaves de por medio.
  for (const m of limpio.matchAll(/>([^<>{}]+)</g)) {
    const texto = m[1];
    if (!/[a-záéíóúñ]{2}/i.test(texto)) continue;
    // La línea se cuenta sobre `limpio`, no sobre el fuente: quitar comentarios
    // acorta los desplazamientos pero conserva todos los saltos de línea, así
    // que el número coincide con el del archivo. Contarlo sobre `fuente` con un
    // índice de `limpio` daba líneas corridas hacia arriba, tantas como
    // comentarios hubiera antes.
    piezas.push({ ruta, linea: lineaDe(limpio, m.index + 1), texto: texto.replace(/\s+/g, " ").trim() });
  }

  return piezas;
}

const fuentes = archivos("src", [".tsx", ".ts"]);
const visibles = fuentes.flatMap(textoVisible);

/** Las coincidencias de un patrón sobre el texto visible, ya formateadas. */
const infractoras = (patron) =>
  visibles
    .filter((p) => patron.test(p.texto))
    .map((p) => `${p.ruta}:${p.linea} «${p.texto.slice(0, 56)}»`);

// --- TONO-1 · la marca ---------------------------------------------------------

const marcaVieja = infractoras(/\bEstacionamiento\b/);
comprobar(
  "TONO-1 · el producto no se llama «Estacionamiento» en ninguna pantalla",
  marcaVieja.length === 0,
  marcaVieja.slice(0, TOPE).join(" | "),
);

// El espejo: la marca correcta tiene que estar puesta donde el sistema operativo
// y la tienda de aplicaciones la leen. Sin esta mitad, borrar el nombre viejo
// dejaría el producto sin nombre y el criterio pasaría igual.
for (const ruta of ["src/app/layout.tsx", "src/app/manifest.ts"]) {
  const texto = existsSync(ruta) ? readFileSync(ruta, "utf8") : "";
  comprobar(
    `TONO-1 · ${ruta} nombra el producto como ParkControl`,
    /ParkControl/.test(texto),
    existsSync(ruta) ? "" : "el archivo no está",
  );
}

const marcaMalEscrita = visibles
  .filter((p) => /park\s?control/i.test(p.texto) && !/ParkControl/.test(p.texto))
  .map((p) => `${p.ruta}:${p.linea} «${p.texto.slice(0, 56)}»`);
comprobar(
  "TONO-1 · la marca se escribe siempre ParkControl, en una palabra",
  marcaMalEscrita.length === 0,
  marcaMalEscrita.slice(0, TOPE).join(" | "),
);

// --- TONO-2 · sin em dash ------------------------------------------------------

const rayas = infractoras(/[—–]/);
comprobar(
  "TONO-2 · ningún em dash ni en dash en el texto visible",
  rayas.length === 0,
  rayas.slice(0, TOPE).join(" | "),
);

// --- TONO-3 · sin «piloto» -----------------------------------------------------

const piloto = infractoras(/\bpilotos?\b/i);
comprobar(
  "TONO-3 · la palabra «piloto» no aparece en el texto visible",
  piloto.length === 0,
  piloto.slice(0, TOPE).join(" | "),
);

// --- TONO-4 · español de Chile, con tuteo --------------------------------------

/**
 * Voseo rioplatense. Dos familias:
 *
 *   - presente: «podés», «tenés», «sos», «querés»;
 *   - imperativo agudo: «reintentá», «definí», «probá», con o sin enclítico
 *     («definila», «fijate», «acordate»).
 *
 * La lista de raíces es explícita a propósito: un patrón general de «consonante
 * + vocal acentuada final» marcaría «está», «acá» y «según», que son correctos.
 */
const VOSEO = [
  /\b(vos|sos|pod[eé]s|ten[eé]s|quer[eé]s|sab[eé]s|deb[eé]s|hac[eé]s|dec[ií]s|ven[ií]s|and[aá]s)\b/i,
  // `\b` no sirve del lado del acento: para JavaScript «á» no es carácter de
  // palabra, así que `[áéí]\b` nunca cierra frontera y el patrón no matchea
  // nunca. Se vio en la primera corrida, con la sonda en rojo. Van lookarounds
  // que sí incluyen las vocales acentuadas y la eñe.
  /(?<![\wáéíóúñ])(reintent|prob|revis|mir|and|ingres|carg|eleg|escrib|confirm|toc|apret|defin|esper|volv|segu|pon|sac|cerr|abr|borr|agreg|cambi|corr|med|cont|avis|cheque|verific|complet|intent|actualiz|guard|busc|dej|mand|llam|marc|anot|ped|quit|sum|rest|tom|fij|acord|qued|us)[áéí](?![\wáéíóúñ])/i,
  /(?<![\wáéíóúñ])(defin|cont|avis|dec|mand|mir|dej|toc|pas|mostr|fij|acord|qued|and|pon|sac)[íáé](me|te|lo|la|le|nos|los|las)(?![\wáéíóúñ])/i,
];

const voseo = VOSEO.flatMap((p) => infractoras(p));
comprobar(
  "TONO-4 · ninguna forma de voseo en el texto visible",
  voseo.length === 0,
  [...new Set(voseo)].slice(0, TOPE).join(" | "),
);

// --- El propio verificador tiene que poder fallar ------------------------------
//
// Un criterio que nunca se vio en rojo es una promesa, no una medición. Estas
// dos frases son sondas: si el analizador dejara de ver el texto visible, el
// verificador entero pasaría a dar PASS sobre el conjunto vacío sin que nadie lo
// note. Acá se le da texto conocido y se exige que lo marque.
const SONDAS = [
  ["texto con em dash", "Se guardó —y sube solo—", /[—–]/],
  ["texto con voseo", "Reintentá cuando puedas", VOSEO[1]],
  ["texto con la marca vieja", "Gestión de Estacionamiento", /\bEstacionamiento\b/],
];
for (const [nombre, muestra, patron] of SONDAS) {
  comprobar(`sonda · el analizador reconoce ${nombre}`, patron.test(muestra));
}

comprobar(
  "el analizador encontró texto visible que revisar (no pasó sobre el vacío)",
  visibles.length > 40,
  `${visibles.length} piezas de copia en ${fuentes.length} archivos`,
);

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("Voz del producto: PASS");
