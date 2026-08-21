/**
 * AC-SEG-2 · el limitador de `/api/login` corta de verdad, contra la URL viva.
 *
 * Existe porque la corrección de `identificarCliente` se verificó en unitarias y
 * eso **no alcanzaba**: la pregunta de M-8 es sobre producción. Medir en
 * producción devolvió un resultado que ninguna unitaria podía dar (ver M-10).
 *
 * Aislamiento, y es lo que hace válida la medición: el limitador usa DOS claves,
 * `ip:` y `email:`. Cada intento va con un **email distinto**, así que un 429
 * sólo puede venir de la clave de IP. Repetir el email daría un PASS falso que
 * no dice nada de lo que se está preguntando.
 *
 *   node scripts/verificar-seg2.mjs <url-base>
 *
 * Se le puede apuntar a un deploy inmutable viejo para verlo FALLAR, que es cómo
 * se probó: el deploy de `a0f792e` evade 10/10.
 */

const base = (process.argv[2] ?? process.env.URL_PRODUCCION ?? "").replace(/\/$/, "");
if (!base) {
  console.error("FAIL · falta la URL base (argumento o URL_PRODUCCION).");
  process.exit(2);
}

const INTENTOS = 30;
const MAX_INTENTOS = 5; // OPCIONES_LOGIN.maxIntentos

async function intentar(i, xff) {
  const cabeceras = { "content-type": "application/json" };
  if (xff) cabeceras["x-forwarded-for"] = xff;
  const r = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({
      email: `fixture-seg2-${Date.now()}-${i}@ejemplo.invalido`,
      clave: "clave-que-no-es",
    }),
  });
  return { estado: r.status, instancia: r.headers.get("x-vercel-id") };
}

async function corrida(nombre, xffDe) {
  const estados = [];
  const instancias = new Set();
  for (let i = 0; i < INTENTOS; i++) {
    const { estado, instancia } = await intentar(i, xffDe?.(i));
    estados.push(estado);
    if (instancia) instancias.add(instancia.split("::").pop().split("-")[0]);
  }
  const corta = estados.indexOf(429);
  console.log(
    `${nombre.padEnd(26)} 429=${String(estados.filter((e) => e === 429).length).padStart(2)}` +
      `  instancias=${String(instancias.size).padStart(2)}` +
      `  -> ${corta >= 0 ? `corta en el ${corta + 1}` : "NUNCA CORTA"}`,
  );
  return { corta, instancias: instancias.size };
}

console.log(`AC-SEG-2 contra ${base}\n`);

const limpia = await corrida("sin cabecera forjada", null);
const rotando = await corrida("x-forwarded-for rotando", (i) => `203.0.113.${(i % 250) + 1}`);

const comprobaciones = [
  {
    nombre: "el limitador corta sin que nadie forje nada",
    ok: limpia.corta >= 0 && limpia.corta + 1 <= MAX_INTENTOS + 1,
    detalle:
      limpia.corta >= 0
        ? `cortó en el ${limpia.corta + 1}`
        : `${INTENTOS} intentos sin un solo 429 (M-10) · ${limpia.instancias} valores de x-vercel-id, que NO son instancias`,
  },
  {
    nombre: "rotar x-forwarded-for no fabrica cupos nuevos",
    ok: rotando.corta >= 0 && rotando.corta + 1 <= MAX_INTENTOS + 1,
    detalle:
      rotando.corta >= 0
        ? `cortó en el ${rotando.corta + 1}`
        : `${INTENTOS} intentos sin un solo 429 · un cupo por petición`,
  },
];

console.log("");
for (const c of comprobaciones) {
  console.log(`${c.ok ? "PASS" : "FAIL"} · ${c.nombre} · ${c.detalle}`);
}
const pasan = comprobaciones.filter((c) => c.ok).length;
console.log(`\n${pasan}/${comprobaciones.length} comprobaciones PASS`);
console.log(`AC-SEG-2: ${pasan === comprobaciones.length ? "PASS" : "FAIL"}`);
process.exit(pasan === comprobaciones.length ? 0 : 1);
