/**
 * AC-H1-1 — la métrica de H1, con su tamaño de muestra.
 *
 * H1 (`spec.md` §1): *un operador registra entrada + salida más rápido que en el
 * cuaderno*. `spec.md` §6 define la métrica: `tecleo_fin_at − tecleo_inicio_at`.
 *
 * ## Por qué este verificador es distinto de todos los demás del repo
 *
 * `AC-MEAS-1` **no puede fallar por ausencia de datos**. Sus dos guardas son
 * `nulos !== 0` —un `count(*)` sobre un `WHERE`, vacuamente verdadero sobre el
 * conjunto vacío— y `obligatorias !== 2`, que se lee de `information_schema` y
 * no depende de las filas (`scripts/verificar-meas1.mjs:53` y `:57`).
 *
 * **Un criterio universal —"todo X cumple P"— es automáticamente verdadero si no
 * hay ningún X.** Cuando lo que importa es que *existan* X, el criterio tiene que
 * ser **existencial**, y su salida no es un PASS: es un número.
 *
 * Por eso acá el veredicto se deriva de `n`, y por eso este script **falla con la
 * base vacía**. *"No pude medirlo" no es "está bien".*
 *
 * ## Las tres poblaciones, que nunca se mezclan
 *
 * Es lo más importante del diseño. Un número sin esta separación sería plausible
 * y falso — la forma exacta del `6,2 s` inventado de las maquetas `1g`/`1k`.
 *
 *   real     `patente NOT LIKE 'FIXT%'`                    evidencia de H1: SÍ, la única
 *   banco    `patente LIKE 'FIXTB%'`                        evidencia de H1: no
 *   efímero  `LIKE 'FIXT%'` y no `FIXTB%`                   evidencia de H1: NO
 *
 * ## Lo que este instrumento NO puede saber, y por lo tanto no afirma
 *
 * **La procedencia de una fila no está en la base.** El banco *pretende* ser
 * sesiones tecleadas por una persona en la interfaz, pero eso es una **convención
 * sobre un prefijo, sin ningún mecanismo que la haga cumplir**: un `INSERT` con
 * duraciones elegidas a mano entra al banco y produce PASS. Está comprobado —lo
 * reprodujo el auditor en el ciclo 1 de FASE D— y por eso este archivo ya no
 * describe al banco como "una persona tecleando", sino como lo que es.
 *
 * Un instrumento que afirma lo que no puede comprobar es el defecto que este
 * proyecto ya registró en INT-12 y en el gate de evidencia. No se repite acá.
 *
 * ## Un número que este archivo publica, y que hay que re-medir y no heredar
 *
 * "6 de los 9 verificadores de navegador llaman `limpiarFixtures()` al iniciar".
 * **Medido el 2026-08-16**, no copiado: importan `puppeteer-core` nueve
 * (`a3`, `endurecimiento`, `int12`, `m4`, `meas2`, `op1`, `pwa`, `temporizador`,
 * `ui`) y llaman `limpiarFixtures()` seis (todos menos `int12`, `pwa` y `ui`).
 *
 * La primera versión de este archivo decía **5 de 8**, heredado de `STATE.md`.
 * Quedó viejo cuando entró `scripts/verificar-temporizador.mjs:208`, que hace
 * las dos cosas. Se anota acá porque es el mismo modo de falla que FASE D
 * persigue: **un número copiado se republica como si se hubiera medido.**
 *
 * ## Lo que este comando NO hace
 *
 * **No concluye sobre H1.** Medir no requiere umbral; comparar sí, y
 * `{{UMBRAL_H1_SEGUNDOS}}` y `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` siguen abiertos
 * (`spec.md` §12). Tampoco aplica un mínimo de muestra: cuál es el `n` a partir
 * del cual una mediana significa algo es decisión humana, propuesta como
 * `{{N_MINIMO_H1}}`. **Deuda declarada: ese nombre todavía no está en `spec.md`
 * §12; se agrega al cablear (iteración 3).**
 *
 * Uso:  npm run verificar:h1
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import { PREFIJO_BANCO } from "./lib/fixtures.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL · falta DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

/** Metadatos de cada población. El orden es el de la salida. */
const POBLACIONES = [
  {
    id: "real",
    etiqueta: "real",
    filtro: "patente NOT LIKE 'FIXT%'",
    evidencia: "SÍ — la única que vale para H1",
  },
  {
    id: "banco",
    etiqueta: "banco",
    filtro: "patente LIKE 'FIXTB%'",
    evidencia: "no — y su procedencia no se comprueba (ver nota)",
  },
  {
    id: "efimero",
    etiqueta: "efímero",
    filtro: "resto de FIXT%",
    evidencia: "NO — tecleo de un robot, no de una persona",
  },
];

/**
 * **El único lugar de todo el script donde una mediana se convierte en texto.**
 *
 * Devuelve la fila entera, con `n` adentro, en un solo string. No hay un
 * formateador de mediana suelto que alguien pueda llamar por su cuenta, y el
 * veredicto (abajo) nunca recibe la mediana: solo recibe `n`.
 *
 * Esto no es adorno. La primera versión de este archivo afirmaba que publicar
 * una mediana sin su `n` era "imposible por construcción", y era falso: la
 * mediana circulaba suelta en cuatro lugares y la co-ocurrencia con `n` la
 * imponía un `console.log`. El auditor lo refutó con un comando. La propiedad
 * que hoy se sostiene, y que es la que se afirma, es más chica y es verdadera:
 * **hay un solo camino de código que imprime una mediana, y ese camino imprime
 * la fila completa.**
 */
function componerFila(meta, fila) {
  const anchos = { pob: 9, n: 5, med: 10, min: 10, max: 10 };
  const n = fila?.n ?? 0;
  const s = (v) => `${Number(v).toFixed(2)} s`;
  const celdas =
    n === 0
      ? { med: "—", min: "—", max: "—" }
      : { med: s(fila.mediana), min: s(fila.minimo), max: s(fila.maximo) };

  return (
    meta.etiqueta.padEnd(anchos.pob) +
    String(n).padStart(anchos.n) +
    celdas.med.padStart(anchos.med) +
    celdas.min.padStart(anchos.min) +
    celdas.max.padStart(anchos.max) +
    `   ${meta.evidencia}`
  );
}

try {
  // El universo: sesiones cerradas con ambos timestamps (SPEC-D §3.1).
  //
  // El esquema declara las dos columnas NOT NULL (`src/db/schema.ts:125` y
  // `src/db/schema.ts:127`), así que hoy el `IS NOT NULL` es redundante. Se
  // escribe igual: si un cambio futuro las afloja, este comando tiene que seguir
  // midiendo sobre datos completos en vez de promediar nulos en silencio.
  const filas = await sql`
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

  // Las poblaciones sin filas no vuelven del GROUP BY: una población ausente y
  // una vacía son lo mismo acá, y las dos tienen que aparecer en la tabla.
  const porId = new Map(filas.map((f) => [f.poblacion, f]));

  // **Solo `n` sale de acá hacia el resto del script.** El veredicto y las
  // advertencias trabajan con este mapa, nunca con las filas crudas, así que no
  // existe forma de que publiquen una mediana.
  const n = new Map(POBLACIONES.map((p) => [p.id, porId.get(p.id)?.n ?? 0]));

  // Lo que el universo deja afuera, por población. El límite del instrumento se
  // declara en su propia salida, no en un comentario que nadie corre.
  const activas = await sql`
    SELECT
      CASE
        WHEN patente NOT LIKE 'FIXT%'  THEN 'real'
        WHEN patente LIKE 'FIXTB%'     THEN 'banco'
        ELSE 'efimero'
      END AS poblacion,
      count(*)::int AS n
    FROM sesion_vehiculo
    WHERE estado = 'activa'
    GROUP BY 1
  `;
  const activasPorId = new Map(activas.map((f) => [f.poblacion, f.n]));
  const activasTotal = activas.reduce((acc, f) => acc + f.n, 0);

  console.log("Métrica de H1 · tiempo de tecleo = tecleo_fin_at − tecleo_inicio_at (spec.md §6)");
  console.log("Universo: sesiones cerradas con ambos timestamps.\n");

  console.log(
    "población".padEnd(9) +
      "n".padStart(5) +
      "mediana".padStart(10) +
      "mín".padStart(10) +
      "máx".padStart(10) +
      "   ¿evidencia de H1?",
  );
  for (const meta of POBLACIONES) {
    console.log(componerFila(meta, porId.get(meta.id)));
  }

  console.log("\nFiltros: " + POBLACIONES.map((p) => `${p.etiqueta} = ${p.filtro}`).join(" · "));

  if (n.get("efimero") > 0) {
    console.log(
      `\nADVERTENCIA · las ${n.get("efimero")} sesión/es de la población efímera NO son evidencia de H1.`,
    );
    console.log("  Las teclea Puppeteer por CDP o las inserta la API directo: su tecleo es la");
    console.log("  latencia de un robot. Publicar esa mediana como si midiera a una persona");
    console.log("  sería el `6,2 s` inventado otra vez, con más decimales.");
  }

  // La limitación más importante del instrumento, y la que más fácil se olvida.
  console.log("\nLÍMITE DEL INSTRUMENTO · la procedencia de una fila NO está en la base.");
  console.log("  El banco es una convención sobre un prefijo, sin mecanismo que la haga");
  console.log("  cumplir: un INSERT con duraciones elegidas a mano entra al banco y da PASS.");
  console.log("  Reproducido en el ciclo 1 de auditoría de FASE D. Este comando NO puede");
  console.log("  distinguir una persona tecleando de una fila fabricada — solo puede decirlo.");

  // --- Control negativo del banco ----------------------------------------
  //
  // Sin esto, el banco "funciona" por casualidad hasta el día que alguien toque
  // el DELETE — que es exactamente la forma de casualidad que este proyecto ya
  // corrigió en M-2 y que `docs/data/actores.md` §3 describe para el aislamiento.
  //
  // Cinco comprobaciones. Las cuatro estáticas atrapan el cambio de código; la
  // viva atrapa que el predicado no haga lo que el texto dice.
  console.log("\nCONTROL NEGATIVO DEL BANCO");
  const control = [];
  const comprobar = (nombre, ok, detalle = "") => {
    control.push(ok);
    console.log(`  ${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
  };

  // **Por exclusión, no por enumeración.** La primera versión de este control
  // miraba dos archivos —`lib/fixtures.mjs` y `limpiar-fixtures.mjs`— porque eran
  // los dos que el diseño nombraba. Dio PASS mientras el banco moría: había tres
  // borrados más, escritos inline en `verificar-a3.mjs` y `verificar-meas2.mjs`,
  // que no pasan por `limpiarFixtures()`.
  //
  // Es la misma lección que `CLAUDE.md` §1 registra para el gate de alcance:
  // **enumerar archivos deja agujeros por construcción.** Acá se escanea toda la
  // superficie de scripts y se exige que TODO borrado pruebe que no toca el banco.
  const fuentes = [
    ...readdirSync(DIR)
      .filter((f) => f.endsWith(".mjs"))
      .map((f) => [`scripts/${f}`, join(DIR, f)]),
    ...readdirSync(join(DIR, "lib"))
      .filter((f) => f.endsWith(".mjs"))
      .map((f) => [`scripts/lib/${f}`, join(DIR, "lib", f)]),
  ];

  // Se busca el DELETE **donde sea que esté** —template literal, `sql.unsafe`,
  // concatenación, tabla entrecomillada— y se clasifica al revés de lo intuitivo:
  // un borrado es seguro solo si **se puede probar** que no alcanza al banco.
  // Todo lo demás es inseguro, incluido un `DELETE` sin `WHERE`.
  //
  // La versión anterior hacía `if (!ANCHO) continue`, y su comentario decía
  // "acotado a un sub-prefijo". No lo implicaba: `!ANCHO` también es verdadero
  // para un `DELETE FROM sesion_vehiculo` pelado. El auditor plantó seis formas
  // que mataban el banco y las seis eran invisibles.
  const INICIO_BORRADO = /DELETE\s+FROM\s+"?sesion_vehiculo"?/gi;
  // Prueba de que no toca el banco: o lleva la guardia, o está acotado a
  // patentes concretas, o a un prefijo con dígito (los verificadores usan
  // `FIXT`+dos dígitos; el banco usa `FIXT`+`B`).
  const SEGURO = [
    /NOT\s*\(\s*patente\s+LIKE\s+\$\{/i, // la guardia del banco
    /patente\s+NOT\s+LIKE\s+\$\{/i,
    /patente\s*=\s*\$\{/i, // una patente concreta
    /patente\s+IN\s*[$(]/i, // una lista concreta, con o sin paréntesis
    /LIKE\s+'FIXT\d/i, // prefijo con dígito: no alcanza a FIXT+B
    /sesion_vehiculo\s*\$\{whereReal\}/, // el propio WHERE extraído del fuente
  ];
  const DELIBERADO = /BORRA-BANCO-A-PROPOSITO/;

  const desprotegidos = [];
  let borradosVistos = 0;
  let vistosEnLaLimpieza = 0;
  for (const [nombre, ruta] of fuentes) {
    // Los comentarios se descartan: describen borrados, no los ejecutan. Sin
    // esto, este mismo archivo se delataba a sí mismo por el texto de la
    // explicación de arriba. Mismo criterio que `verificar-verificadores.mjs:57`.
    const texto = readFileSync(ruta, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const m of texto.matchAll(INICIO_BORRADO)) {
      // **La sentencia termina donde termina, no 400 caracteres después.**
      //
      // La versión anterior tomaba un tramo fijo hacia adelante «por las dudas»,
      // y con eso la pregunta dejaba de ser *¿este borrado prueba que no toca el
      // banco?* para pasar a ser *¿hay algo cerca que parezca una prueba?*.
      // Reproducido por el auditor: `DELETE ... WHERE estado = 'cerrada'` —que
      // borra el banco ENTERO, porque el banco *es* las FIXTB cerradas— pasaba
      // con solo tener debajo un borrado guardado, que es justo la forma de los
      // bloques `finally` de a3 y meas2.
      //
      // La guardia vive **dentro** del literal por construcción, así que cortar
      // en su cierre no pierde nada: comprobado sobre los 13 borrados del repo,
      // los 13 se sostienen solos.
      const resto = texto.slice(m.index);
      const cortes = [resto.indexOf("`"), resto.indexOf(";")].filter((i) => i > 0);
      const sentencia = resto.slice(0, cortes.length ? Math.min(...cortes) : resto.length);
      borradosVistos++;
      if (nombre === "scripts/lib/fixtures.mjs") vistosEnLaLimpieza++;
      if (!SEGURO.some((r) => r.test(sentencia)) && !DELIBERADO.test(sentencia)) {
        desprotegidos.push(`${nombre} (+${m.index})`);
      }
    }
  }

  // El alcance se declara en la propia aserción: este escáner lee `scripts/`, no
  // `src/`. **Importa y hay que decirlo:** el mecanismo de retención de INT-7
  // —el único hallazgo abierto del informe integral— va a ser un borrado por
  // fecha escrito en Drizzle dentro de `src/`, y este control no lo vería.
  comprobar(
    "todo borrado de sesion_vehiculo en scripts/ prueba que no toca el banco",
    desprotegidos.length === 0,
    desprotegidos.length
      ? `sin prueba en: ${[...new Set(desprotegidos)].join(", ")}`
      : `${borradosVistos} borrado(s) revisado(s) en ${fuentes.length} archivo(s) · ` +
        `no cubre src/ (ver INT-7)`,
  );

  // **Piso, para que el criterio no pueda pasar por vacío.** Si un refactor
  // cambia la forma del borrado y la búsqueda deja de encontrarlo,
  // `desprotegidos.length === 0` se vuelve vacuamente verdadero — que es
  // exactamente el defecto que este archivo condena en su encabezado.
  comprobar(
    "la limpieza compartida sigue siendo visible para este control",
    vistosEnLaLimpieza >= 1,
    vistosEnLaLimpieza >= 1
      ? `${vistosEnLaLimpieza} borrado(s) en scripts/lib/fixtures.mjs`
      : "no se encontró ningún DELETE en scripts/lib/fixtures.mjs: el escáner quedó ciego",
  );

  // Colisión: el espacio de nombres del banco tiene que seguir libre. Los
  // verificadores usan FIXT + dos dígitos; el banco usa FIXT + B.
  const invasores = readdirSync(DIR)
    .filter((f) => f.startsWith("verificar-") && f.endsWith(".mjs") && f !== "verificar-h1.mjs")
    .filter((f) => new RegExp(`["'\`]${PREFIJO_BANCO}`).test(readFileSync(join(DIR, f), "utf8")));
  comprobar(
    `ningún verificador usa una patente ${PREFIJO_BANCO}…`,
    invasores.length === 0,
    invasores.length ? invasores.join(", ") : "el espacio de nombres del banco sigue libre",
  );

  // **El predicado REAL, extraído del fuente — no una copia.**
  //
  // La versión anterior re-tecleaba el `WHERE` de `limpiarFixtures()` dentro de
  // la transacción y su comentario decía "el mismo predicado". Era una copia, y
  // una copia no puede detectar divergencia: el auditor borró la guardia del
  // original y este control siguió dando PASS.
  //
  // Ahora el `WHERE` se lee de `scripts/lib/fixtures.mjs` y se ejecuta tal cual.
  // Si el fuente cambia de forma y la extracción falla, esto **falla** — no pasa
  // en silencio.
  const libFixtures = readFileSync(join(DIR, "lib", "fixtures.mjs"), "utf8");
  const extraido = libFixtures.match(
    /DELETE\s+FROM\s+sesion_vehiculo\s+(WHERE[\s\S]*?)\s+RETURNING/i,
  );
  const whereReal = extraido
    ? extraido[1].replace(/\$\{\s*PREFIJO_BANCO\s*\+\s*"%"\s*\}/g, `'${PREFIJO_BANCO}%'`)
    : null;

  comprobar(
    "el WHERE de limpiarFixtures() se pudo extraer para ejercerlo",
    whereReal !== null && !whereReal.includes("${"),
    whereReal
      ? whereReal.replace(/\s+/g, " ").trim()
      : "no se encontró el DELETE ... RETURNING en scripts/lib/fixtures.mjs",
  );

  // Control vivo, en transacción revertida. No toca una sola fila de las que ya
  // están: tres sondas —banco cerrada, banco activa, efímera— y el predicado
  // real. La sonda de banco ACTIVA es la que el auditor encontró faltando: el
  // banco solo crece pasando por `activa`, y protegerla rompía `verificar:op1`.
  const [ctx] = await sql`
    SELECT e.id AS estacionamiento_id,
           (SELECT id FROM usuario WHERE estacionamiento_id = e.id LIMIT 1) AS operador_id
    FROM estacionamiento e LIMIT 1
  `;

  if (!ctx?.operador_id || !whereReal) {
    console.log(
      "  NO CORRIDO · control vivo · " +
        (whereReal
          ? "falta un estacionamiento con usuario sembrado (npm run sembrar)"
          : "no se pudo extraer el WHERE real"),
    );
    console.log("             NO CORRIDO no es PASS: esta comprobación no se hizo hoy.");
  } else {
    class Revertir extends Error {}
    const quedo = {};
    // patente → estado con el que se siembra, y si debe sobrevivir al borrado.
    const SONDAS = [
      { patente: `${PREFIJO_BANCO}79`, estado: "cerrada", sobrevive: true },
      { patente: `${PREFIJO_BANCO}78`, estado: "activa", sobrevive: false },
      { patente: "FIXT79", estado: "cerrada", sobrevive: false },
    ];
    try {
      await sql.begin(async (tx) => {
        for (const s of SONDAS) {
          await tx`
            INSERT INTO sesion_vehiculo
              (estacionamiento_id, operador_id, patente, entrada_at, salida_at,
               monto_calculado, tecleo_inicio_at, tecleo_fin_at, estado, sync_estado)
            VALUES
              (${ctx.estacionamiento_id}, ${ctx.operador_id}, ${s.patente},
               now() - interval '1 hour',
               ${s.estado === "cerrada" ? sql`now()` : sql`NULL`},
               ${s.estado === "cerrada" ? 0 : null},
               now() - interval '1 hour', now() - interval '59 minutes',
               ${s.estado}, 'sincronizada')
          `;
        }

        // El WHERE real, leído del fuente y ejecutado tal cual.
        await tx.unsafe(`DELETE FROM sesion_vehiculo ${whereReal}`);

        for (const s of SONDAS) {
          const [{ n }] = await tx`
            SELECT count(*)::int AS n FROM sesion_vehiculo WHERE patente = ${s.patente}
          `;
          quedo[s.patente] = n;
        }

        throw new Revertir();
      });
    } catch (e) {
      if (!(e instanceof Revertir)) throw e;
    }

    const fallidas = SONDAS.filter((s) => quedo[s.patente] !== (s.sobrevive ? 1 : 0));
    comprobar(
      "el borrado real conserva el banco cerrado y barre el resto",
      fallidas.length === 0,
      SONDAS.map(
        (s) => `${s.patente}/${s.estado}→${quedo[s.patente] === 1 ? "queda" : "borrada"}`,
      ).join(" · ") + " · transacción revertida",
    );
  }

  console.log(
    `\nFuera del universo: ${activasTotal} sesión/es en estado 'activa' ` +
      `(real ${activasPorId.get("real") ?? 0} · banco ${activasPorId.get("banco") ?? 0} · efímero ${activasPorId.get("efimero") ?? 0}).`,
  );
  console.log("  Una sesión sin cerrar no tiene ciclo completo: SPEC-D §3.1 las excluye a propósito.");

  console.log("\nEste comando NO concluye sobre H1.");
  console.log("  Medir no requiere umbral; comparar sí. {{UMBRAL_H1_SEGUNDOS}} y");
  console.log("  {{LINEA_BASE_CUADERNO_SEGUNDOS}} siguen abiertos (spec.md §12).");
  console.log("  Tampoco se aplica un tamaño mínimo de muestra: {{N_MINIMO_H1}} es");
  console.log("  decisión humana y no se inventa acá.");

  // --- Veredicto ---------------------------------------------------------
  //
  // Existencial, no universal: el PASS exige que EXISTA al menos una medición
  // sobre la que valga la pena hablar. La población efímera no cuenta para esto,
  // justamente porque no es evidencia de nada.
  // El control va primero: si el banco no es durable, la muestra que este
  // comando publique mañana no significa nada, tenga el n que tenga.
  if (!control.every(Boolean)) {
    console.log("\nEl control negativo del banco no pasa: el banco dejó de estar protegido");
    console.log("de la limpieza, o alguien invadió su espacio de nombres. Cualquier muestra");
    console.log("que se acumule a partir de acá se borra en la próxima corrida de navegador,");
    console.log("sin avisar.");
    // El veredicto va solo en su línea y al ras del margen: `evidencia.mjs:362`
    // exige exactamente esa forma, y una línea con explicación pegada se publica
    // como SIN VEREDICTO.
    console.log("\nAC-H1-1: FAIL");
    process.exit(1);
  }

  if (n.get("banco") === 0 && n.get("real") === 0) {
    console.log("\nNo hay una sola sesión de banco ni de operación real que medir.");
    console.log("Esto NO es un defecto del comando: es la ausencia de datos de H1, visible");
    console.log("por primera vez en un veredicto en vez de escondida detrás de un PASS vacuo.");
    console.log("Se cierra tecleando en la app. Insertar filas por SQL también daría PASS");
    console.log("—el instrumento no puede impedirlo— y sería fabricar el `6,2 s` de nuevo.");
    console.log("\nAC-H1-1: FAIL");
    process.exit(1);
  }

  if (n.get("real") === 0) {
    console.log("\nBLOQUEO declarado, no defecto: n(real) = 0. La operación con patentes reales");
    console.log("  exige resolver antes {{BASE_LICITUD}} y {{PLAZO_RETENCION_PATENTE}}, que son");
    console.log("  decisión humana. OPERACION_REAL_HABILITADA sigue en false.");
  }

  console.log("\nAC-H1-1: PASS");
} finally {
  await sql.end();
}
