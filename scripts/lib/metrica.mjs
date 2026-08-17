/**
 * AC-H1-2 — la métrica del código es la que `spec.md` §6 declara.
 *
 * ## Por qué existe
 *
 * Hasta el 2026-08-16 el código y §6 coincidían **por casualidad**: los dos decían
 * `tecleo_fin_at − tecleo_inicio_at` y nada comprobaba que siguieran diciéndolo.
 * Cambiar el SQL convertía a §6 en mentira sin que ningún comando lo notara.
 *
 * ## Por qué la primera versión no servía, y cómo se demostró
 *
 * La primera versión buscaba `EXTRACT(EPOCH FROM (…))` y exigía `usos.length > 0`.
 * El auditor la burló de tres formas, todas con la mediana apuntando a
 * `salida_at - entrada_at` y las tres comprobaciones en **PASS**:
 *
 *   - minúsculas: `extract(epoch from (…))` — el matcher era case-sensitive;
 *   - sin `EXTRACT`: `ORDER BY (salida_at - entrada_at)` — no había qué matchear;
 *   - cualquier cambio de espaciado o salto de línea en el envoltorio.
 *
 * **El piso era el defecto principal.** `> 0` se satisface con los otros dos usos
 * —mín y máx— mientras el único número que importa, la mediana, queda escondido.
 * Un piso que cuenta apariciones no ancla ninguna.
 *
 * Y quedó demostrado sin querer: el commit `1c5e421`, el que **introduce**
 * AC-H1-2, capturó una de esas mutaciones y ni el guard ni la regresión la vieron.
 *
 * ## La forma que no se burla
 *
 * Dos comprobaciones que se cubren entre sí:
 *
 *  1. **Por exclusión** — toda resta entre columnas de tiempo, en cualquier parte
 *     de `scripts/` y `src/`, tiene que ser la expresión declarada. No se busca el
 *     envoltorio (`EXTRACT`, paréntesis, mayúsculas): se busca **la resta**, que
 *     es lo que no se puede disfrazar sin dejar de calcular una duración.
 *  2. **Anclada** — la mediana, que es el número publicado, tiene que computarse
 *     con esa expresión. Es la que la primera versión no tenía y la que permitía
 *     esconder justo el sitio que importa.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Columnas de tiempo del esquema: una resta entre dos de éstas es una duración. */
const COLUMNAS = "tecleo_inicio_at|tecleo_fin_at|salida_at|entrada_at";
const RESTA = new RegExp(`(${COLUMNAS})\\s*-\\s*(${COLUMNAS})`, "gi");

/** El menos de la spec es U+2212; el de SQL es un guion. Se comparan expresiones, no tipografía. */
const normalizar = (s) => s.replace(/[−–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();

const sinComentarios = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

/** Todos los archivos de código donde podría vivir un cómputo de duración. */
function fuentes() {
  const salida = [];
  const recorrer = (dir, rel) => {
    for (const entrada of readdirSync(dir)) {
      const ruta = join(dir, entrada);
      if (statSync(ruta).isDirectory()) {
        recorrer(ruta, `${rel}/${entrada}`);
      } else if (/\.(mjs|ts|tsx|sql)$/.test(entrada)) {
        salida.push([`${rel}/${entrada}`, ruta]);
      }
    }
  };
  recorrer(join(RAIZ, "scripts"), "scripts");
  recorrer(join(RAIZ, "src"), "src");
  recorrer(join(RAIZ, "drizzle"), "drizzle");
  return salida;
}

/**
 * **La consulta de poblaciones — una sola definición, para que se pueda probar.**
 *
 * Vive acá y no en `verificar-h1.mjs` por una razón concreta: si el cómputo está
 * en un solo lugar, se lo puede **ejercitar** contra una fila de duración
 * conocida. Copiarla para probarla solo demostraría que la copia hace lo que la
 * copia hace.
 */
export function consultaPoblaciones(sql) {
  // El universo: sesiones cerradas con ambos timestamps (SPEC-D §3.1).
  //
  // El esquema declara las dos columnas NOT NULL (`src/db/schema.ts:125` y
  // `src/db/schema.ts:127`), así que hoy el `IS NOT NULL` es redundante. Se
  // escribe igual: si un cambio futuro las afloja, esto tiene que seguir midiendo
  // sobre datos completos en vez de promediar nulos en silencio.
  return sql`
    SELECT
      CASE
        WHEN patente NOT LIKE 'FIXT%'  THEN 'real'
        WHEN patente LIKE 'FIXTB%'     THEN 'banco'
        ELSE 'efimero'
      END AS poblacion,
      count(*)::int AS n,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (tecleo_fin_at - tecleo_inicio_at))
      ) AS mediana,
      min(EXTRACT(EPOCH FROM (tecleo_fin_at - tecleo_inicio_at))) AS minimo,
      max(EXTRACT(EPOCH FROM (tecleo_fin_at - tecleo_inicio_at))) AS maximo
    FROM sesion_vehiculo
    WHERE estado = 'cerrada'
      AND tecleo_inicio_at IS NOT NULL
      AND tecleo_fin_at IS NOT NULL
    GROUP BY 1
  `;
}

/**
 * **La comprobación que ninguna forma sintáctica evade: se ejercita la consulta.**
 *
 * El guard estático de abajo es enumeración de una forma —`col - col`— y se
 * puede esquivar sin esfuerzo:
 *
 *   EXTRACT(EPOCH FROM salida_at) - EXTRACT(EPOCH FROM entrada_at)
 *   age(salida_at, entrada_at)
 *   salida_at::timestamptz - entrada_at::timestamptz
 *   …o restando en JavaScript después de traer las dos columnas.
 *
 * **No se puede detectar «el código calcula otra duración» leyendo el texto.** Lo
 * que sí se puede es preguntarle a la consulta real, con una fila cuya duración
 * de tecleo se conoce y cuyo `salida_at − entrada_at` es deliberadamente otro
 * número: si publica el segundo, está midiendo lo que no debe.
 *
 * Es la misma corrección que `verificar-ui.mjs` hizo al pasar de leer el fuente a
 * medir el estilo computado: se verifica la propiedad, no la forma del código.
 *
 * Todo ocurre en una transacción revertida: no toca una sola fila real.
 */
export async function ejercitarMetrica(sql) {
  // **Cuatro instantes distintos, y los seis pares que se pueden formar con ellos
  // dan seis números distintos.**
  //
  // La primera sonda ponía `salida_at` y `tecleo_fin_at` en el MISMO instante y
  // solo separaba `entrada_at`. Con eso cubría una de las cuatro confusiones
  // posibles y dejaba la más plausible sin cubrir: cualquier expresión que
  // cambiara `tecleo_fin_at` por `salida_at` medía **idéntico** sobre la sonda.
  // El auditor publicó `salida_at − tecleo_inicio_at` con las cuatro capas en
  // verde. Una sonda que no distingue no prueba nada.
  //
  // Desplazamientos, en segundos hacia atrás desde `now()`:
  const T = { entrada: 3600, tecleoInicio: 900, tecleoFin: 893, salida: 0 };

  // Los seis pares, para poder decir QUÉ se midió cuando no es lo declarado.
  const PARES = {
    "tecleo_fin_at − tecleo_inicio_at": T.tecleoInicio - T.tecleoFin, // 7 ← el declarado
    "salida_at − entrada_at": T.entrada - T.salida, // 3600
    "salida_at − tecleo_inicio_at": T.tecleoInicio - T.salida, // 900
    "salida_at − tecleo_fin_at": T.tecleoFin - T.salida, // 893
    "tecleo_fin_at − entrada_at": T.entrada - T.tecleoFin, // 2707
    "tecleo_inicio_at − entrada_at": T.entrada - T.tecleoInicio, // 2700
  };
  const ESPERADO = PARES["tecleo_fin_at − tecleo_inicio_at"];

  const [ctx] = await sql`
    SELECT e.id AS est, (SELECT id FROM usuario WHERE estacionamiento_id = e.id LIMIT 1) AS op
    FROM estacionamiento e LIMIT 1
  `;
  if (!ctx?.op) return { corrido: false, motivo: "falta un estacionamiento con usuario sembrado (npm run sembrar)" };

  class Revertir extends Error {}
  let medido = null;
  try {
    await sql.begin(async (tx) => {
      // La sonda tiene que ser la única fila del universo, o la mediana mezcla.
      //
      // La marca va **dentro del literal SQL**, no en un comentario de JS: el
      // control negativo de `verificar-h1.mjs:307` descarta los comentarios de JS
      // antes de escanear, así que una marca puesta arriba sería invisible para
      // él. Y va en `--` y no en `/* */` porque el descarte de bloques de JS
      // también se la comería.
      await tx`
        DELETE FROM sesion_vehiculo
        -- BORRA-BANCO-A-PROPOSITO: sí, este borrado alcanza al banco, a propósito.
        -- Es legítimo porque la transacción que lo contiene SIEMPRE revierte: el
        -- throw de abajo no es condicional, no hay camino en que esto se confirme.
        -- Sin la marca, el control lo clasificaba —con razón— como borrado ancho
        -- sin prueba, y hacía fallar a verificar:h1 por el motivo equivocado.
      `;
      await tx`
        INSERT INTO sesion_vehiculo
          (estacionamiento_id, operador_id, patente, entrada_at, salida_at,
           monto_calculado, tecleo_inicio_at, tecleo_fin_at, estado, sync_estado)
        VALUES
          (${ctx.est}, ${ctx.op}, 'FIXTB77',
           now() - (${T.entrada} || ' seconds')::interval,
           now() - (${T.salida} || ' seconds')::interval,
           0,
           now() - (${T.tecleoInicio} || ' seconds')::interval,
           now() - (${T.tecleoFin} || ' seconds')::interval,
           'cerrada', 'sincronizada')
      `;
      const filas = await consultaPoblaciones(tx);
      medido = filas.length === 1 ? Number(filas[0].mediana) : null;
      throw new Revertir();
    });
  } catch (e) {
    if (!(e instanceof Revertir)) throw e;
  }

  // Si no es el declarado, se dice **qué par publicó**: un FAIL que nombra la
  // confusión vale más que uno que solo dice que el número no coincide.
  const coincide = (v) =>
    Object.entries(PARES).find(([, esp]) => v !== null && Math.abs(v - esp) < 0.5)?.[0];

  return {
    corrido: true,
    esperado: ESPERADO,
    medido,
    pares: PARES,
    identificado: coincide(medido),
    ok: medido !== null && Math.abs(medido - ESPERADO) < 0.5,
  };
}

/** La expresión que `spec.md` §6 declara como la métrica de H1. */
export function metricaDeclarada() {
  const spec = readFileSync(join(RAIZ, "spec.md"), "utf8");
  const m = spec.match(/La duración del tecleo = `([^`]+)` es la métrica de H1/);
  return m ? m[1] : null;
}

/**
 * Corre las comprobaciones y devuelve `[{ nombre, ok, detalle }]`.
 * No imprime ni sale: quien la llama decide cómo reportar.
 */
export function comprobarMetrica() {
  const r = [];
  const declarada = metricaDeclarada();

  r.push({
    nombre: "spec.md §6 declara la métrica en la forma que este guard puede leer",
    ok: Boolean(declarada),
    detalle: declarada
      ? `«${declarada}»`
      : "no se encontró «La duración del tecleo = `…` es la métrica de H1»",
  });
  if (!declarada) return r;

  // --- 1 · Por exclusión: ninguna resta entre columnas de tiempo diverge -------
  const divergentes = [];
  let restasVistas = 0;
  for (const [nombre, ruta] of fuentes()) {
    const texto = sinComentarios(readFileSync(ruta, "utf8"));
    for (const m of texto.matchAll(RESTA)) {
      restasVistas++;
      if (normalizar(m[0]) !== normalizar(declarada)) divergentes.push(`${nombre}: «${m[0].trim()}»`);
    }
  }

  r.push({
    nombre: "toda resta entre columnas de tiempo es la métrica declarada",
    ok: divergentes.length === 0,
    detalle: divergentes.length
      ? `${divergentes.length} divergente(s): ${[...new Set(divergentes)].slice(0, 3).join(" | ")}`
      : `${restasVistas} resta(s) revisada(s) en scripts/, src/ y drizzle/`,
  });

  // --- 2 · Anclada: la MEDIANA se computa con esa expresión --------------------
  //
  // Es la comprobación que la primera versión no tenía. Sin ella, esconder el
  // sitio de la mediana bastaba: los otros usos sostenían el piso.
  // Se busca donde vive la consulta —este mismo módulo—, no donde vivía antes.
  // El refactor que la centralizó dejó el ancla apuntando a `verificar-h1.mjs`
  // por una corrida: la comprobación pasó a decir «el ancla se perdió», que es
  // fallar cerrado. Es la dirección correcta del error y por eso se detectó.
  //
  // **Igualdad, no `includes`.** Con `includes` bastaba con dejar la expresión
  // declarada adentro y sumarle otra cosa al lado. El auditor lo hizo con una
  // línea, y las cuatro capas quedaron en verde publicando otra duración:
  //
  //     ORDER BY EXTRACT(EPOCH FROM (tecleo_fin_at - tecleo_inicio_at)) * 0
  //              + EXTRACT(EPOCH FROM salida_at) - EXTRACT(EPOCH FROM tecleo_inicio_at)
  //
  // Contiene la métrica declarada —multiplicada por cero— y mide otra. §6 dice
  // «exactamente», así que el ORDER BY entero tiene que ser la forma canónica:
  // ni un término más. Si el envoltorio legítimo cambia alguna vez, se cambia
  // acá y en §6, que es justamente el acoplamiento que este AC existe para
  // sostener.
  const fuente = sinComentarios(readFileSync(join(RAIZ, "scripts", "lib", "metrica.mjs"), "utf8"));
  const mediana = fuente.match(/percentile_cont\([^)]*\)\s*WITHIN GROUP\s*\(([\s\S]{0,300}?)\)\s*AS\s+mediana/i);
  const canonica = `order by extract(epoch from (${normalizar(declarada)}))`;
  const hallada = mediana ? normalizar(mediana[1]) : null;

  r.push({
    nombre: "la mediana publicada se computa con la métrica declarada, y solo con ella",
    ok: hallada === canonica,
    detalle: !mediana
      ? "no se encontró el percentile_cont … AS mediana: el ancla se perdió"
      : hallada === canonica
        ? `«${hallada}» ≡ la forma canónica`
        : `«${hallada}» ≠ «${canonica}»`,
  });

  return r;
}
