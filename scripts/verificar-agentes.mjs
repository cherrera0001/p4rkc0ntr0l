/**
 * Guard de las definiciones de agente: **una sola fuente para todos los harnesses.**
 *
 * Por qué existe. El repo tenía los tres roles del concilio escritos dos veces, y
 * la copia sin versionar había perdido la restricción de herramientas del rol
 * adversarial: *«No modificás código»* era una valla en un harness y prosa en el
 * otro. El fundamento completo está en `scripts/lib/agentes.mjs`.
 *
 * Regenerar una vez no alcanza: **la divergencia vuelve el día que alguien edite
 * el `.toml` directamente**, que es exactamente como empezó. Por eso hay guard y
 * no sólo generador.
 *
 * Uso:  npm run verificar:agentes
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { agentes, destinoCodex, DIR_CODEX, DIR_FUENTE, renderCodex } from "./lib/agentes.mjs";

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

// Leer la fuente también puede fallar —un frontmatter roto, un archivo
// ilegible—, y hasta el 2026-08-16 esa llamada estaba fuera de todo `try`: el
// guard **moría sin imprimir veredicto**, que es el hallazgo que originó
// `verificar-verificadores.mjs`. Falla cerrada, pero un comando sin veredicto se
// publica `SIN VEREDICTO` en el bloque de evidencia en vez de FAIL.
let fuente = [];
let errorFuente = null;
try {
  fuente = agentes();
} catch (e) {
  errorFuente = e.message;
}
comprobar("la fuente se puede leer", errorFuente === null, errorFuente ?? `${fuente.length} archivo(s)`);

// Piso contra el vacío: si el directorio queda vacío o cambia de ruta, todas las
// comprobaciones de abajo pasan sobre el conjunto vacío. Es el defecto que este
// repo persigue desde AC-MEAS-1.
comprobar(
  "hay agentes en la fuente que verificar",
  fuente.length > 0,
  `${fuente.length} en .claude/agents/`,
);

for (const agente of fuente) {
  const destino = destinoCodex(agente);

  if (!existsSync(destino)) {
    comprobar(`${agente.rol} · existe en .codex/`, false, "falta: corré npm run generar:agentes");
    continue;
  }

  const enDisco = readFileSync(destino, "utf8").replace(/\r\n/g, "\n");

  // `renderCodex` lanza si la fuente no se puede traducir —sin `tools`, o con un
  // cuerpo que rompería el TOML—. **Se atrapa y se reporta como FAIL en vez de
  // dejar morir al script:** un verificador que aborta no imprime veredicto, y un
  // comando sin veredicto se publica como SIN VEREDICTO en el bloque de
  // evidencia. Es el hallazgo que originó `verificar-verificadores.mjs`.
  let esperado = null;
  let motivo = "";
  try {
    esperado = renderCodex(agente);
  } catch (e) {
    motivo = e.message;
  }

  comprobar(
    `${agente.rol} · la fuente se puede traducir a .codex`,
    esperado !== null,
    esperado !== null ? "render OK" : motivo,
  );

  if (esperado !== null) {
    comprobar(
      `${agente.rol} · .codex coincide con la fuente`,
      enDisco === esperado,
      enDisco === esperado ? "generado desde .claude/agents/" : "DESVIADO: corré npm run generar:agentes",
    );
  }

  // **Piso: la valla tiene que existir en la fuente.**
  //
  // La primera versión de este guard escribía `if (agente.tools) { comprobar(…) }`,
  // y con eso **la comprobación desaparecía junto con la propiedad que vigila**:
  // borrar `tools:` de la fuente daba 7/7 PASS con el rol adversarial sin
  // restricción en los dos harnesses, y sin una sola línea FAIL. Reproducido por
  // el auditor el 2026-08-16.
  //
  // Es exactamente lo que `CLAUDE.md` §1 condena —*«un criterio que siempre pasa
  // es peor que no tener criterio»*— y lo que este repo ya pagó con AC-SCOPE-1.
  // Un rol sin valla declarada es un FAIL, no una comprobación que no corre.
  comprobar(
    `${agente.rol} · declara su valla de herramientas en la fuente`,
    Boolean(agente.tools),
    agente.tools ? `tools: ${agente.tools}` : "sin `tools:` en el frontmatter: el rol queda sin restricción",
  );

  // (Ver el bloque de «quién puede escribir», después del bucle.)
  //
  // El piso anterior exigía que hubiera una valla; no miraba su contenido. Un
  // `tools: Read, Grep, Edit, Write, PowerShell` en el rol adversarial daba
  // 14/14 PASS — y el `.codex` generado le instruía obedientemente que podía
  // escribir. Reproducido por el auditor el 2026-08-16.
  //
  // Es la razón de ser que este mismo módulo declara (`scripts/lib/agentes.mjs`):
  // *un rol que audita y además puede escribir aprueba lo que él mismo escribió*.
  // Se detecta por CONTENIDO —qué dice el rol que hace— y no por una lista de
  // nombres: enumerar roles es el defecto que este repo ya pagó dos veces.
  // (La comprobación de quién puede escribir se hace sobre el CONJUNTO, abajo:
  // preguntársela a cada rol según cómo se describe es auto-anulable.)

  // Y tiene que llegar al otro harness. En la fuente es una valla del harness;
  // en el destino, texto — pero tiene que estar.
  comprobar(
    `${agente.rol} · la restricción de herramientas llegó a .codex`,
    Boolean(agente.tools) && enDisco.includes(agente.tools),
    agente.tools ? `tools: ${agente.tools}` : "no hay nada que traducir",
  );
}

// --- Quién puede escribir: se afirma sobre el CONJUNTO -------------------------
//
// **Dos versiones anteriores de esta comprobación se auto-anulaban**, y la segunda
// lo hacía mientras su comentario reclamaba lo contrario:
//
//  1. `if (agente.tools) { … }` — la comprobación desaparecía junto con la valla.
//  2. `if (/adversarial|audit/i.test(name + description)) { … }` — la condición se
//     evaluaba sobre **texto que el archivo auditado controla**. Reproducido por
//     el auditor: renombrar el rol a `revisor-critico` y darle `Edit, Write` daba
//     **15/15 PASS**, sin una sola línea FAIL; el recuento bajaba de 16 a 15 y
//     nada lo nombraba. Y el comentario decía *«por contenido, no por lista de
//     nombres»* sobre una regex que **es** una lista de dos nombres. Es el caso de
//     `api/cobro-salida/` que obligó a reescribir AC-SCOPE-1 **por exclusión**
//     (`CLAUDE.md` §1), aplicado a la prosa en vez de a la ruta.
//
// La forma que no se puede anular no le pregunta a cada rol según cómo se
// describe: **afirma sobre el conjunto entero.** Los roles que declaran
// herramientas de escritura tienen que ser exactamente `ESCRIBEN`.
//
// Falla si el auditor gana `Edit`. Falla si aparece un cuarto rol que escribe. Y
// falla **cerrado** si alguien renombra al implementador —el conjunto deja de
// coincidir— en vez de abrirse, que es lo que hacían las dos versiones anteriores.
const ESCRIBEN = ["implementador"];
const ESCRITURA = /^(Edit|Write|NotebookEdit|MultiEdit)$/i;

const conEscritura = fuente
  .filter((a) => (a.tools ?? "").split(",").some((t) => ESCRITURA.test(t.trim())))
  .map((a) => a.rol)
  .sort();
const esperados = [...ESCRIBEN].sort();

comprobar(
  `solo ${ESCRIBEN.join(", ")} declara herramientas de escritura`,
  conEscritura.length === esperados.length && conEscritura.every((r, i) => r === esperados[i]),
  `escriben: ${conEscritura.length ? conEscritura.join(", ") : "ninguno"} · esperado: ${esperados.join(", ")}`,
);

// Un rol que existe solo en un harness es la divergencia en su forma más simple.
const huerfanos = existsSync(DIR_CODEX)
  ? readdirSync(DIR_CODEX)
      .filter((f) => f.endsWith(".toml"))
      .filter((f) => !existsSync(join(DIR_FUENTE, f.replace(/\.toml$/, ".md"))))
  : [];
comprobar(
  "ningún rol vive solo en .codex/",
  huerfanos.length === 0,
  huerfanos.length ? `sin fuente: ${huerfanos.join(", ")}` : "todos tienen su fuente en .claude/agents/",
);

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("AGENTES: PASS");
