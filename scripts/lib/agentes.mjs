/**
 * Una sola definición de cada rol del concilio, para todos los harnesses.
 *
 * ## Por qué existe
 *
 * El repo tenía los tres roles escritos **dos veces**: `.claude/agents/*.md` y
 * `.codex/agents/*.toml`. Los cuerpos eran idénticos —una línea de diferencia, el
 * nombre del harness— así que la duplicación parecía inocua.
 *
 * **No lo era.** Medido el 2026-08-16:
 *
 *   auditor         .claude → tools: Read, Grep, PowerShell        .codex → sin restricción
 *   implementador   .claude → tools: Read, Grep, Edit, PowerShell  .codex → sin restricción
 *   verificador     .claude → tools: Read, PowerShell              .codex → sin restricción
 *
 * > **Esa medición ya no se puede re-derivar del árbol, y es culpa del orden en
 * > que se hizo esto.** `.codex/` nunca estuvo en git, y el generador sobrescribió
 * > los `.toml` originales en su lugar: no hay copia ni en el historial ni en el
 * > índice. Lo correcto era commitear `.codex/` **antes** de regenerar.
 * >
 * > La salida original quedó transcripta en `LEDGER.md` (2026-08-16), que es donde
 * > vive ahora la única evidencia. Se anota acá porque este mismo archivo cita
 * > INT-12 como la lección de que **un artefacto fuera de git no aparece en una
 * > revisión** — y la repitió mientras la citaba.
 *
 * Lo que divergió no fue el texto: fue **la valla**. En `.claude` el auditor no
 * tiene `Edit`, y por eso *«No modificás código»* es una restricción del harness.
 * En `.codex` la misma frase es una sugerencia. El rol adversarial existe para no
 * poder aprobar lo que él mismo escribió; sin la valla, esa garantía es prosa.
 *
 * Y `.codex/` **no estaba en git**: era justamente la copia que perdió la valla y
 * la que nadie ve en un diff.
 *
 * ## Qué hace esto
 *
 * `.claude/agents/*.md` es la **fuente**. De ahí sale `.codex/agents/*.toml`, que
 * pasa a ser artefacto generado y versionado —versionado a propósito: un artefacto
 * fuera de git no aparece en una revisión, que es la lección de INT-12—.
 *
 * `npm run verificar:agentes` falla si lo generado no coincide con la fuente. No
 * alcanza con regenerar y confiar: sin el guard, la divergencia vuelve el día que
 * alguien edite el `.toml` directamente, que es exactamente como empezó ésta.
 *
 * ## Límite declarado, porque no se puede resolver desde acá
 *
 * **La valla de `tools` se traduce a prosa, no a mecanismo.** El formato de Codex
 * puede tener o no un campo equivalente; **no lo inventamos**: escribir una clave
 * que no existe sería peor que no escribirla, porque parecería una restricción
 * activa. Lo que se emite es una línea explícita de restricción dentro de las
 * instrucciones, y esta nota para que nadie lea el `.toml` como si tuviera una
 * valla del harness. Si Codex documenta un campo de herramientas, cambiarlo es una
 * línea en `renderCodex()`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DIR_FUENTE = join(RAIZ, ".claude", "agents");
export const DIR_CODEX = join(RAIZ, ".codex", "agents");

/** Lee un agente de la fuente y devuelve sus partes. */
export function leerAgente(archivo) {
  // El BOM se saca antes de mirar el frontmatter. PowerShell 5.1 lo escribe con
  // `Set-Content -Encoding utf8`, y un BOM delante de `---` hace que el
  // frontmatter deje de matchear: el guard moría con «no tiene frontmatter YAML»
  // sobre un archivo que se ve perfecto. Ya pasó dos veces en este repo —está en
  // el ledger para INT-12 y para `env.ts`— y volvió a pasar acá.
  const texto = readFileSync(join(DIR_FUENTE, archivo), "utf8")
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n");
  const m = texto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${archivo}: no tiene frontmatter YAML`);

  const campo = (nombre) => m[1].match(new RegExp(`^${nombre}:\\s*(.+)$`, "m"))?.[1].trim();
  const name = campo("name");
  const description = campo("description");
  const tools = campo("tools");
  if (!name || !description) throw new Error(`${archivo}: falta name o description`);

  return { archivo, rol: archivo.replace(/\.md$/, ""), name, description, tools, cuerpo: m[2].trim() };
}

/** Los tres roles, en orden estable. */
export function agentes() {
  return readdirSync(DIR_FUENTE)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map(leerAgente);
}

/**
 * Render del `.toml` de Codex a partir de la fuente.
 *
 * Dos transformaciones, y las dos son deliberadas:
 *
 *  1. el nombre del harness en la nota de PATH — decir "reiniciá Claude Code"
 *     dentro del agente de Codex es una instrucción que no se puede seguir;
 *  2. la restricción de herramientas, que en la fuente es un campo del harness y
 *     acá sólo puede ser texto (ver el encabezado de este archivo).
 */
export function renderCodex(agente) {
  const cuerpo = agente.cuerpo.replace(/\bClaude Code\b/g, "Codex");

  // `tools` es obligatorio: sin él no hay valla que traducir. Ver el piso en
  // `verificar-agentes.mjs` — acá se falla fuerte porque generar un `.toml` sin
  // restricción es peor que no generarlo.
  if (!agente.tools) {
    throw new Error(
      `${agente.archivo}: no declara \`tools\`. Todo rol del concilio tiene que declarar ` +
        `su valla de herramientas: el rol adversarial sin restricción puede editar lo que audita.`,
    );
  }

  const restriccion =
    `\n\n## Herramientas permitidas\n\n` +
    `Solo: **${agente.tools}**.\n\n` +
    `En la fuente (\`.claude/agents/${agente.archivo}\`) esto es una valla del\n` +
    `harness. Acá es una instrucción: seguila igual. No uses ninguna herramienta\n` +
    `fuera de esa lista aunque el entorno te la ofrezca.`;

  const texto = cuerpo + restriccion;

  // **Cadena literal (`'''`), no básica (`"""`).**
  //
  // En una cadena básica de TOML la barra invertida es escape: una ruta de
  // Windows como `C:\Users\...` produce `\U`, que es un escape inválido, y el
  // archivo entero deja de parsear. Estas tres fuentes son documentación de
  // Windows y PowerShell, así que la ruta no es hipotética.
  //
  // Y el guard no lo vería: compara lo generado contra lo que el mismo render
  // produce, así que un `.toml` roto coincidiría consigo mismo para siempre. Una
  // cadena literal no interpreta escapes; lo único que la puede cerrar es su
  // propio delimitador, y eso se comprueba acá abajo.
  if (texto.includes("'''")) {
    throw new Error(
      `${agente.archivo}: el cuerpo contiene ''' y cerraría la cadena literal del TOML.`,
    );
  }

  return (
    `# GENERADO por \`npm run generar:agentes\` desde .claude/agents/${agente.archivo}\n` +
    `# No editar a mano: \`npm run verificar:agentes\` falla si esto se desvía de la fuente.\n` +
    `name = ${JSON.stringify(agente.name)}\n` +
    `description = ${JSON.stringify(agente.description)}\n` +
    `developer_instructions = '''\n${texto}'''\n`
  );
}

/** Ruta destino del `.toml` de un agente. */
export const destinoCodex = (agente) => join(DIR_CODEX, `${agente.rol}.toml`);
