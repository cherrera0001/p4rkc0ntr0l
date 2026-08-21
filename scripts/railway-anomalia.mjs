/**
 * Persigue una anomalía concreta: un proyecto que reporta el mayor consumo del
 * equipo y a la vez dice tener CERO servicios.
 *
 * `estimatedUsage` y `project.services` no se contradicen por capricho: la API
 * tiene `includeDeleted`, así que la hipótesis a descartar es que haya servicios
 * borrados —o volúmenes huérfanos— que siguen contando.
 */
import { consultar, peticionesUsadas } from "./lib/railway.mjs";

const p = (s = "") => console.log(s);
const objetivo = process.argv[2];
if (!objetivo) {
  console.error("uso: node scripts/railway-anomalia.mjs <projectId>");
  process.exit(2);
}

const datos = await consultar(
  `query($id: String!) {
     project(id: $id) {
       id name createdAt deletedAt
       services { edges { node { id name createdAt deletedAt } } }
       volumes { edges { node { id name createdAt } } }
       environments { edges { node { id name } } }
     }
   }`,
  { id: objetivo },
);

const pr = datos.project;
p(`proyecto ${pr.name}  (${pr.id})`);
p(`  creado ${pr.createdAt?.slice(0, 10)}${pr.deletedAt ? ` · BORRADO ${pr.deletedAt.slice(0, 10)}` : ""}`);
p(`  entornos: ${pr.environments.edges.map((e) => e.node.name).join(", ")}`);
p();

const servicios = pr.services.edges.map((e) => e.node);
p(`servicios visibles: ${servicios.length}`);
for (const s of servicios) {
  p(`  - ${s.name.padEnd(24)} creado ${s.createdAt?.slice(0, 10)}${s.deletedAt ? ` · BORRADO ${s.deletedAt.slice(0, 10)}` : ""}`);
}
p();

const volumenes = pr.volumes?.edges?.map((e) => e.node) ?? [];
p(`volúmenes: ${volumenes.length}`);
for (const v of volumenes) {
  p(`  - ${String(v.name).padEnd(24)} creado ${v.createdAt?.slice(0, 10)}  (${v.id})`);
}
p();

// El uso con servicios borrados incluidos, agrupado por servicio: es lo que
// nombra al responsable.
const est = await consultar(
  `query($id: String!, $m: [MetricMeasurement!]!) {
     usage(projectId: $id, measurements: $m, groupBy: [SERVICE_ID], includeDeleted: true) {
       measurement value tags { serviceId projectId }
     }
   }`,
  { id: objetivo, m: ["MEMORY_USAGE_GB", "DISK_USAGE_GB", "CPU_USAGE"] },
);

const filas = est.usage ?? [];
p(`uso por servicio (incluyendo borrados): ${filas.length} fila(s)`);
const nombreDe = new Map(servicios.map((s) => [s.id, s.name]));
for (const f of filas.sort((a, b) => b.value - a.value)) {
  const sid = f.tags?.serviceId ?? "(sin servicio)";
  const nombre = nombreDe.get(sid) ?? "(NO VISIBLE — borrado o huérfano)";
  p(`  ${String(f.measurement).padEnd(20)} ${String(f.value).padEnd(22)} ${nombre}  ${sid}`);
}
p();
p(`peticiones usadas: ${peticionesUsadas()} (tope de la corrida: 12)`);
