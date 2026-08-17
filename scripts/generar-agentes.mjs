/**
 * Genera `.codex/agents/*.toml` desde `.claude/agents/*.md`.
 *
 * La fuente es una sola: `.claude/agents/`. Ver `scripts/lib/agentes.mjs` para el
 * porqué —la duplicación ya había perdido la valla de herramientas del rol
 * adversarial— y para el límite declarado de la traducción.
 *
 * Uso:  npm run generar:agentes
 *       npm run verificar:agentes   ← falla si esto quedó sin correr
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";

import { agentes, destinoCodex, DIR_CODEX, renderCodex } from "./lib/agentes.mjs";

mkdirSync(DIR_CODEX, { recursive: true });

let cambiados = 0;
for (const agente of agentes()) {
  const destino = destinoCodex(agente);
  const nuevo = renderCodex(agente);
  const previo = existsSync(destino) ? readFileSync(destino, "utf8").replace(/\r\n/g, "\n") : null;

  if (previo === nuevo) {
    console.log(`  = ${agente.rol.padEnd(15)} sin cambios`);
    continue;
  }
  writeFileSync(destino, nuevo, "utf8");
  cambiados++;
  console.log(`  ${previo === null ? "+" : "~"} ${agente.rol.padEnd(15)} ${previo === null ? "creado" : "actualizado"}`);
}

console.log(`\n${cambiados} archivo(s) escrito(s) desde .claude/agents/`);
console.log("AGENTES: PASS");
