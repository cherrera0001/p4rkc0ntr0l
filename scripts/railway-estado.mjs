/**
 * Lee el estado y el GASTO de Railway. SOLO LECTURA: no crea, no despliega.
 *
 * Existe antes que cualquier despliegue por una razón dicha explícitamente: un
 * despliegue anterior disparó el costo. Primero se mira la factura, después se
 * decide. El cliente que usa tiene tope de peticiones y espaciado propios.
 *
 * El token entregado el 2026-08-20 es de EQUIPO: `me` da «Not Authorized» y
 * `projectToken` da «Project Token not found`, pero `projects` responde. Por eso
 * se entra por ahí y no por la cuenta.
 */
import { consultar, peticionesUsadas } from "./lib/railway.mjs";

const p = (s = "") => console.log(s);

// 1 · Qué argumentos aceptan las consultas de uso. Se introspecciona en vez de
//     adivinar: cada consulta equivocada gasta una petición del presupuesto.
const intro = await consultar(`
  { __schema { queryType { fields {
      name
      args { name type { kind name ofType { kind name } } }
  } } } }
`);
const campoDe = (n) => intro.__schema.queryType.fields.find((f) => f.name === n);
const argsDe = (n) =>
  (campoDe(n)?.args ?? []).map(
    (a) => `${a.name}:${a.type.name ?? a.type.ofType?.name ?? a.type.kind}`,
  );

p(`argumentos de estimatedUsage: ${argsDe("estimatedUsage").join(", ") || "(no existe)"}`);
p(`argumentos de usage:          ${argsDe("usage").join(", ") || "(no existe)"}`);
p();

// 2 · Los proyectos del equipo, con sus servicios. Todos: el gasto puede venir
//     de un proyecto que no es el del estacionamiento.
const datos = await consultar(`
  { projects { edges { node {
      id name createdAt
      services { edges { node { id name createdAt } } }
      environments { edges { node { id name } } }
  } } } }
`);

const proyectos = datos.projects.edges.map((e) => e.node);
const esteProyecto = process.env.RAILWAY_PROJECT_ID;

p(`proyectos del equipo: ${proyectos.length}`);
p();
let totalServicios = 0;
for (const pr of proyectos) {
  const marca = pr.id === esteProyecto ? "  <-- el del estacionamiento" : "";
  p(`${pr.name}   (${pr.id})${marca}`);
  p(`  creado ${pr.createdAt?.slice(0, 10)} · entornos: ${pr.environments.edges.map((e) => e.node.name).join(", ")}`);
  const ss = pr.services.edges.map((e) => e.node);
  totalServicios += ss.length;
  if (ss.length === 0) {
    p(`  servicios: ninguno`);
  } else {
    p(`  servicios (${ss.length}):`);
    for (const s of ss) p(`    - ${s.name.padEnd(24)} creado ${s.createdAt?.slice(0, 10)}  (${s.id})`);
  }
  p();
}
p(`TOTAL de servicios desplegados en el equipo: ${totalServicios}`);
p(`Cada uno factura mientras exista, no mientras se use.`);
p();

// 3 · El gasto. Es el punto entero de este script.
if (campoDe("estimatedUsage")) {
  const tieneTeam = argsDe("estimatedUsage").some((a) => a.startsWith("teamId"));
  const variables = tieneTeam ? {} : { p: esteProyecto };
  const query = tieneTeam
    ? `{ estimatedUsage { measurement estimatedValue projectId } }`
    : `query($p: String!) { estimatedUsage(projectId: $p) { measurement estimatedValue } }`;
  try {
    const est = await consultar(query, variables);
    p("uso estimado del ciclo en curso:");
    const filas = est.estimatedUsage ?? [];
    if (filas.length === 0) p("  (sin datos)");
    for (const m of filas) {
      const nombre = proyectos.find((x) => x.id === m.projectId)?.name ?? m.projectId ?? "";
      p(`  ${String(m.measurement).padEnd(26)} ${String(m.estimatedValue).padEnd(14)} ${nombre}`);
    }
  } catch (e) {
    p(`uso estimado: NO LEGIBLE con este token · ${e.message}`);
  }
}
p();
p(`peticiones usadas: ${peticionesUsadas()} (tope de la corrida: 12)`);
