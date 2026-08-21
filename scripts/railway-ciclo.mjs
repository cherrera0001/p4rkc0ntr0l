/**
 * Uso del CICLO EN CURSO, por servicio, con fechas explícitas.
 *
 * Existe porque `railway-anomalia.mjs` consulta sin rango, y una consulta sin
 * rango puede estar sumando historia en vez del mes que se factura. La
 * diferencia decide si un servicio borrado sigue costando o sólo aparece en el
 * acumulado — que son dos conclusiones opuestas.
 */
import { consultar, peticionesUsadas } from "./lib/railway.mjs";

const p = (s = "") => console.log(s);

// Primer día del mes en curso, en UTC, y ahora.
const ahora = new Date();
const desde = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
p(`ciclo medido: ${desde.toISOString().slice(0, 10)} → ${ahora.toISOString().slice(0, 10)}`);
p();

// ¿Expone la API algo de facturación directa? Se pregunta una vez.
const intro = await consultar(`{ __schema { queryType { fields { name } } } }`);
const facturacion = intro.__schema.queryType.fields
  .map((f) => f.name)
  .filter((n) => /cost|invoice|billing|price|plan|credit/i.test(n));
p(`campos de facturación en la API: ${facturacion.join(", ") || "ninguno accesible"}`);
p();

const workspaceId = process.env.RAILWAY_WORKSPACE_ID;
const MEDIDAS = ["MEMORY_USAGE_GB", "CPU_USAGE", "DISK_USAGE_GB", "NETWORK_TX_GB"];

const datos = await consultar(
  `query($w: String!, $m: [MetricMeasurement!]!, $d: DateTime!, $h: DateTime!) {
     usage(workspaceId: $w, measurements: $m, startDate: $d, endDate: $h,
           groupBy: [PROJECT_ID, SERVICE_ID], includeDeleted: true) {
       measurement value tags { projectId serviceId }
     }
   }`,
  { w: workspaceId, m: MEDIDAS, d: desde.toISOString(), h: ahora.toISOString() },
);

// Nombres, para que la salida se pueda leer sin cotejar UUID a mano.
const inv = await consultar(`
  { projects { edges { node { id name services { edges { node { id name } } } } } } }
`);
const nombreProy = new Map();
const nombreServ = new Map();
for (const { node: pr } of inv.projects.edges) {
  nombreProy.set(pr.id, pr.name);
  for (const { node: s } of pr.services.edges) nombreServ.set(s.id, s.name);
}

const filas = (datos.usage ?? []).filter((f) => f.value > 0);
p(`filas con valor > 0: ${filas.length}`);
p();

for (const medida of MEDIDAS) {
  const deEsta = filas.filter((f) => f.measurement === medida);
  if (deEsta.length === 0) continue;
  const total = deEsta.reduce((a, b) => a + b.value, 0);
  p(`── ${medida}   total ${total.toFixed(2)}`);
  for (const f of deEsta.sort((a, b) => b.value - a.value).slice(0, 12)) {
    const pj = nombreProy.get(f.tags?.projectId) ?? "(proyecto borrado)";
    const sv = nombreServ.get(f.tags?.serviceId) ?? "(servicio borrado/huérfano)";
    const cuota = ((f.value / total) * 100).toFixed(1);
    p(`   ${String(f.value.toFixed(2)).padStart(12)}  ${String(cuota + "%").padStart(6)}  ${pj} / ${sv}`);
  }
  p();
}

p(`peticiones usadas: ${peticionesUsadas()} (tope de la corrida: 12)`);
