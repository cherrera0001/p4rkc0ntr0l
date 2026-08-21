/**
 * El GASTO de Railway, por proyecto. Solo lectura.
 *
 * Se separa de `railway-estado.mjs` para que mirar la factura no obligue a
 * releer todo el inventario: menos peticiones por corrida es menos superficie
 * contra el límite de tasa.
 */
import { consultar, peticionesUsadas } from "./lib/railway.mjs";

const p = (s = "") => console.log(s);

// Qué se puede medir. Sin esto, la consulta de uso falla por validación y gasta
// una petición sin devolver nada.
const intro = await consultar(`
  { __type(name: "MetricMeasurement") { enumValues { name } } }
`);
const disponibles = intro.__type.enumValues.map((v) => v.name);
p(`medidas que expone la API (${disponibles.length}):`);
p(`  ${disponibles.join(", ")}`);
p();

// Las que hablan de plata: cómputo, memoria, disco y salida de red.
const QUIERO = [
  "CPU_USAGE",
  "MEMORY_USAGE_GB",
  "DISK_USAGE_GB",
  "NETWORK_TX_GB",
  "NETWORK_RX_GB",
  "EPHEMERAL_DISK_USAGE_GB",
];
const medidas = QUIERO.filter((m) => disponibles.includes(m));
p(`se consultan: ${medidas.join(", ")}`);
p();

const workspaceId = process.env.RAILWAY_WORKSPACE_ID;

const est = await consultar(
  `query($w: String!, $m: [MetricMeasurement!]!) {
     estimatedUsage(workspaceId: $w, measurements: $m) {
       measurement estimatedValue projectId
     }
   }`,
  { w: workspaceId, m: medidas },
);

const filas = est.estimatedUsage ?? [];
if (filas.length === 0) {
  p("uso estimado: sin datos para el ciclo en curso");
} else {
  // Agrupado por proyecto: la pregunta es cuál dispara el costo, no el total.
  const porProyecto = new Map();
  for (const f of filas) {
    const k = f.projectId ?? "(sin proyecto)";
    if (!porProyecto.has(k)) porProyecto.set(k, []);
    porProyecto.get(k).push(f);
  }
  p(`uso estimado del ciclo en curso · ${porProyecto.size} proyecto(s) con datos`);
  p();
  for (const [proyecto, ms] of porProyecto) {
    p(`proyecto ${proyecto}`);
    for (const m of ms.sort((a, b) => b.estimatedValue - a.estimatedValue)) {
      p(`  ${String(m.measurement).padEnd(26)} ${m.estimatedValue}`);
    }
    p();
  }
}

p(`peticiones usadas: ${peticionesUsadas()} (tope de la corrida: 12)`);
