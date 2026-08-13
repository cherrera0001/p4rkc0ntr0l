/**
 * Verificación de SPEC-004 — capa de presentación (AC-UI-1..4).
 *
 * **Por qué existe, y por qué mira el navegador y no el fuente.**
 *
 * El 2026-08-13 los cuatro criterios de SPEC-004 daban PASS mientras la mitad de
 * las decisiones tipográficas de M6 **no se aplicaba**. Todo `globals.css` estaba
 * sin `@layer`, y una declaración sin capa le gana a cualquier capa sin importar
 * la especificidad; Tailwind pone sus utilidades en `@layer utilities`. O sea:
 * `p { font-size: var(--fs-body) }` derrotaba a `text-xs` en todos los `<p>` del
 * producto, y `.cifra` derrotaba a `text-2xl` en el sitio de uso.
 *
 * Ninguno de los cuatro criterios podía verlo: AC-UI-1/2/3 miran el **fuente** y
 * AC-UI-4 mira la **CSP**. La lección generalizable —y el motivo de este
 * archivo— es que **un criterio sobre el fuente no verifica el resultado**. Para
 * CSS, la propiedad se comprueba en el estilo computado del navegador.
 *
 * Qué comprueba:
 *
 *   AC-UI-1 · cero literales hex en los componentes.
 *   AC-UI-2 · cero tamaños tipográficos sueltos en los componentes.
 *   AC-UI-3 · cero recursos de terceros en `src/` y `public/`.
 *   NUEVO   · el orden de capas de la hoja SERVIDA es base < components <
 *             utilities, y ninguna regla del sistema quedó fuera de capa.
 *   NUEVO   · el navegador computa lo que las pantallas asumen: una utilidad de
 *             Tailwind gana sobre el default de elemento y sobre `.cifra`.
 *
 * AC-UI-4 (la CSP sigue en verde) lo cubre `verificar-endurecimiento.mjs`, que
 * ya carga la app y escucha violaciones de CSP en consola. No se duplica.
 *
 * Uso:  node scripts/verificar-ui.mjs [url]
 * Requiere el servidor levantado (`npm run build && npm start`).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";

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

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

/** Archivos de un árbol, filtrados por extensión. */
function archivos(raiz, extensiones) {
  const salida = [];
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir)) {
      const ruta = join(dir, entrada);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (extensiones.includes(extname(ruta))) salida.push(ruta);
    }
  };
  if (existsSync(raiz)) recorrer(raiz);
  return salida;
}

/**
 * Busca un patrón en archivos y devuelve las coincidencias.
 * Los comentarios se descartan: describen el defecto, no lo cometen.
 */
function buscar(rutas, patron) {
  const hallazgos = [];
  for (const ruta of rutas) {
    const texto = readFileSync(ruta, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*(\/\/|#|\*).*$/gm, "");
    for (const linea of texto.split("\n")) {
      if (patron.test(linea)) hallazgos.push(`${ruta}: ${linea.trim().slice(0, 70)}`);
    }
  }
  return hallazgos;
}

// --- AC-UI-1/2/3 · lo que se puede ver en el fuente ---------------------------

const componentes = archivos("src", [".tsx"]);

const hex = buscar(componentes, /#[0-9A-Fa-f]{6}\b/);
comprobar(
  "AC-UI-1 · ningún literal hex en los componentes",
  hex.length === 0,
  hex.slice(0, 3).join(" | "),
);

const tamanos = buscar(componentes, /font-size:\s*\d/);
comprobar(
  "AC-UI-2 · ningún tamaño tipográfico suelto en los componentes",
  tamanos.length === 0,
  tamanos.slice(0, 3).join(" | "),
);

const terceros = buscar(
  [...archivos("src", [".tsx", ".ts", ".css"]), ...archivos("public", [".js", ".css", ".json"])],
  /fonts\.googleapis|unpkg\.com|cdn\.[a-z]/,
);
comprobar(
  "AC-UI-3 · ningún recurso de terceros en src/ ni public/",
  terceros.length === 0,
  terceros.slice(0, 3).join(" | "),
);

// --- La hoja SERVIDA, que es lo que el navegador aplica -----------------------

const html = await (await fetch(`${URL_BASE}/login`)).text();
const hoja = html.match(/\/_next\/static\/[^"']+\.css/)?.[0] ?? null;

comprobar("la página trae una hoja de estilos del build", hoja !== null, hoja ?? "ninguna");

if (hoja) {
  const css = await (await fetch(new URL(hoja, URL_BASE))).text();

  const posicion = (capa) => css.indexOf(`@layer ${capa}{`);
  const base = posicion("base");
  const componentesCapa = posicion("components");
  const utilidades = posicion("utilities");

  comprobar(
    "las tres capas existen en la hoja servida",
    base >= 0 && componentesCapa >= 0 && utilidades >= 0,
    `base=${base} components=${componentesCapa} utilities=${utilidades}`,
  );

  comprobar(
    "el orden es base < components < utilities",
    base >= 0 && base < componentesCapa && componentesCapa < utilidades,
    `base=${base} components=${componentesCapa} utilities=${utilidades}`,
  );

  // Una regla del sistema que quede FUERA de capa le gana a toda utilidad de
  // Tailwind. Es el defecto que este verificador existe para impedir.
  const capaDe = (indice) => {
    const previas = [...css.slice(0, indice).matchAll(/@layer (base|components|utilities|theme|properties)\{/g)];
    return previas.length ? previas[previas.length - 1][1] : "SIN CAPA";
  };

  for (const [regla, esperada] of [
    [".eyebrow{", "components"],
    [".patente{", "components"],
    [".cifra{", "components"],
    [".tabular{", "components"],
  ]) {
    const i = css.indexOf(regla);
    comprobar(
      `${regla} está en @layer ${esperada}`,
      i >= 0 && capaDe(i) === esperada,
      i < 0 ? "no está en la hoja" : `capa=${capaDe(i)}`,
    );
  }

  comprobar(
    ":focus-visible no impone border-radius (le cambiaba las esquinas al enfocar)",
    !/:focus-visible\{[^}]*border-radius/.test(css),
  );
}

// --- Lo que el navegador realmente computa -----------------------------------

const browser = await puppeteer.launch({
  executablePath: navegador,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  await page.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2" });

  const medido = await page.evaluate(() => {
    const medir = (clases, etiqueta = "p") => {
      const el = document.createElement(etiqueta);
      el.className = clases;
      el.textContent = "0";
      document.body.appendChild(el);
      const s = getComputedStyle(el);
      const r = { fontSize: s.fontSize, fontFamily: s.fontFamily, color: s.color };
      el.remove();
      return r;
    };
    return {
      parrafoDefault: medir(""),
      parrafoChico: medir("text-xs"),
      cifra: medir("cifra"),
      cifraAjustada: medir("cifra text-2xl"),
      cuerpo: getComputedStyle(document.body),
      familiaCuerpo: getComputedStyle(document.body).fontFamily,
      fondoCuerpo: getComputedStyle(document.body).backgroundColor,
    };
  });

  // 0.75rem = 12px. Si el default de elemento ganara, esto daría 16px — que es
  // exactamente lo que pasaba antes de poner los defaults en `@layer base`.
  comprobar(
    "una utilidad de Tailwind gana sobre el default de elemento · text-xs = 12px",
    medido.parrafoChico.fontSize === "12px",
    `${medido.parrafoChico.fontSize} (default del elemento: ${medido.parrafoDefault.fontSize})`,
  );

  comprobar(
    "el default de elemento sigue aplicándose cuando no hay utilidad",
    medido.parrafoDefault.fontSize === "16px",
    medido.parrafoDefault.fontSize,
  );

  // `.cifra` sola manda; con una utilidad al lado, manda la utilidad. Las dos
  // mitades importan: la primera es el sistema, la segunda es poder ajustarlo.
  comprobar(
    "la cifra grande se aplica · .cifra = 44px",
    medido.cifra.fontSize === "44px",
    medido.cifra.fontSize,
  );

  comprobar(
    "y una utilidad la puede ajustar en el sitio de uso · .cifra.text-2xl = 24px",
    medido.cifraAjustada.fontSize === "24px",
    `${medido.cifraAjustada.fontSize} (sin la utilidad: ${medido.cifra.fontSize})`,
  );

  // La app carga Geist por `next/font/google` (autoalojado en build). Antes el
  // CSS lo descartaba con `font-family: Arial` en la línea siguiente.
  comprobar(
    "el cuerpo usa la tipografía del sistema de diseño, no una del navegador",
    /geist/i.test(medido.familiaCuerpo),
    medido.familiaCuerpo.slice(0, 70),
  );

  // --canvas = #fafaf9 = rgb(250, 250, 249)
  comprobar(
    "el fondo sale del token --canvas",
    medido.fondoCuerpo === "rgb(250, 250, 249)",
    medido.fondoCuerpo,
  );

  // AC-UI-3, comprobado en runtime y no solo por grep: ninguna petición sale
  // del propio origen.
  const externas = [];
  const page2 = await browser.newPage();
  page2.on("request", (r) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(URL_BASE).origin && u.protocol !== "data:") externas.push(u.origin);
  });
  await page2.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2" });

  comprobar(
    "AC-UI-3 · cargar la pantalla no pide nada a un tercero",
    externas.length === 0,
    [...new Set(externas)].join(", "),
  );
} catch (e) {
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
console.log("SPEC-004: PASS");
