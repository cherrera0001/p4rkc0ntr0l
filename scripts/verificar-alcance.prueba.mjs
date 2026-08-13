/**
 * Prueba del gate de alcance **con el fallo plantado**.
 *
 * La regla que este archivo hace cumplir, y que costó un veto aprender:
 * **un gate que solo se probó contra un repo limpio no se probó.** El criterio
 * anterior daba "sin resultados" y eso se leyó como evidencia de que el gate
 * funcionaba; en realidad el regex estaba roto y habría dado "sin resultados"
 * con Stripe adentro.
 *
 * Acá se construyen árboles falsos en un directorio temporal, se corre el gate
 * real contra cada uno, y se exige que **falle donde tiene que fallar**. Nada
 * toca el repo.
 *
 * Uso:  node scripts/verificar-alcance.prueba.mjs
 *       npm run verificar:alcance:prueba
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = join(RAIZ, "scripts", "verificar-alcance.mjs");

const resultados = [];
const comprobar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

/** Corre el gate contra un árbol y devuelve `{ codigo, salida }`. */
function correrGate(raiz) {
  try {
    const salida = execFileSync(process.execPath, [GATE, raiz], { encoding: "utf8" });
    return { codigo: 0, salida };
  } catch (e) {
    return { codigo: e.status ?? 1, salida: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/** Construye un árbol mínimo y le aplica las mutaciones que se le pasen. */
function arbol(archivos) {
  const dir = mkdtempSync(join(tmpdir(), "alcance-"));
  const base = {
    "package.json": JSON.stringify({ name: "x", dependencies: { next: "16.3.0" } }, null, 2),
    "src/app/page.tsx": "export default function P() { return null; }\n",
    "src/db/schema.ts": "export const usuario = {};\n",
    ...archivos,
  };
  for (const [ruta, contenido] of Object.entries(base)) {
    const abs = join(dir, ruta);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contenido, "utf8");
  }
  return dir;
}

const temporales = [];
const con = (archivos) => {
  const d = arbol(archivos);
  temporales.push(d);
  return d;
};

try {
  // --- Control positivo: un árbol limpio pasa -------------------------------
  {
    const { codigo } = correrGate(con({}));
    comprobar("un árbol limpio pasa el gate", codigo === 0, `exit=${codigo}`);
  }

  // --- El caso que el criterio anterior NO veía -----------------------------
  // Ruta nueva, fuera de cualquier lista blanca, cobrándole al conductor.
  {
    const { codigo, salida } = correrGate(
      con({
        "src/app/api/cobro/route.ts":
          'import Stripe from "stripe";\nexport async function POST() { return new Stripe("").checkout; }\n',
      }),
    );
    comprobar(
      "una RUTA NUEVA que le cobra al conductor es rechazada",
      codigo === 1 && /AC-SCOPE-1a/.test(salida) && /cobro\/route\.ts/.test(salida),
      `exit=${codigo}`,
    );
  }

  // --- La pasarela declarada en el manifiesto, sin frontera ------------------
  {
    const { codigo, salida } = correrGate(
      con({
        "package.json": JSON.stringify(
          { name: "x", dependencies: { next: "16.3.0", "transbank-sdk": "^4.0.0" } },
          null,
          2,
        ),
      }),
    );
    comprobar(
      "una dependencia de pasarela SIN frontera declarada es rechazada",
      codigo === 1 && /AC-SCOPE-1[bc]/.test(salida),
      `exit=${codigo}`,
    );
  }

  // --- La pasarela DENTRO de su frontera: permitida por ADR-004 --------------
  {
    const { codigo, salida } = correrGate(
      con({
        "package.json": JSON.stringify(
          { name: "x", dependencies: { next: "16.3.0", "transbank-sdk": "^4.0.0" } },
          null,
          2,
        ),
        "src/lib/suscripcion/webpay.ts": 'import { WebpayPlus } from "transbank-sdk";\nexport const w = WebpayPlus;\n',
      }),
    );
    comprobar(
      "la pasarela DENTRO de src/lib/suscripcion/ es aceptada (ADR-004)",
      codigo === 0,
      codigo === 0 ? "" : salida.split("\n").filter((l) => l.startsWith("FAIL")).join(" | "),
    );
  }

  // --- Los tres bypasses que un veto reprodujo -------------------------------
  // Los tres daban 7/7 PASS con la versión anterior del gate. Van acá para que
  // no puedan volver: son la razón por la que la enumeración se invirtió.

  const conFrontera = {
    "package.json": JSON.stringify(
      { name: "x", dependencies: { next: "16.3.0", "transbank-sdk": "^4.0.0" } },
      null,
      2,
    ),
    // Nombre neutro a propósito: si el archivo se llamara `webpay.ts`, el
    // hallazgo saltaría por la ruta del import y no por la regla.
    "src/lib/suscripcion/cliente.ts": 'import { WebpayPlus } from "transbank-sdk";\nexport const cobrar = (m) => WebpayPlus.create(m);\n',
  };

  {
    const { codigo, salida } = correrGate(
      con({
        ...conFrontera,
        // Ruta NUEVA, nombre neutro, fuera de cualquier lista blanca.
        "src/app/api/cobro-salida/route.ts":
          'import { cobrar } from "@/lib/suscripcion/cliente";\nexport async function POST() { return cobrar(1500); }\n',
      }),
    );
    comprobar(
      "BYPASS 1 · una RUTA NUEVA de nombre neutro que importa la frontera es rechazada",
      codigo === 1 && /solo la superficie de suscripción declarada/.test(salida),
      `exit=${codigo}`,
    );
  }

  {
    const { codigo, salida } = correrGate(
      con({
        ...conFrontera,
        "src/app/formulario-salida.tsx":
          'import { cobrar } from "@/lib/suscripcion/cliente";\nexport default function F() { return cobrar(1500); }\n',
      }),
    );
    comprobar(
      "BYPASS 2 · un componente de UI del operador que importa la frontera es rechazado",
      codigo === 1 && /solo la superficie de suscripción declarada/.test(salida),
      `exit=${codigo}`,
    );
  }

  {
    const { codigo, salida } = correrGate(
      con({
        "package.json": JSON.stringify(
          { name: "x", dependencies: { next: "16.3.0", stripe: "^18.0.0" } },
          null,
          2,
        ),
        // El cobro del CONDUCTOR escondido DENTRO de la frontera. Antes pasaba
        // porque la frontera estaba exceptuada entera y nada decía qué puede
        // vivir adentro.
        "src/lib/suscripcion/cobro-conductor.ts":
          'import Stripe from "stripe";\nimport { sesionVehiculo } from "@/db/schema";\nexport const cobrarEstacionamiento = (m) => new Stripe("").charge(m, sesionVehiculo);\n',
      }),
    );
    comprobar(
      "BYPASS 3 · el cobro del CONDUCTOR escondido dentro de la frontera es rechazado",
      codigo === 1 && /no toca el dominio del estacionamiento/.test(salida),
      `exit=${codigo}`,
    );
  }

  // --- AC-SCOPE-2 y 3 --------------------------------------------------------
  {
    const { codigo, salida } = correrGate(
      con({ "src/db/schema.ts": 'export const pago = pgTable("pago", {});\n' }),
    );
    comprobar(
      "una entidad Pago en el esquema es rechazada",
      codigo === 1 && /AC-SCOPE-2/.test(salida),
      `exit=${codigo}`,
    );
  }
  {
    // `_` es carácter de palabra: `\bpago\b` NO matchea `pagos_estacionamiento`.
    const { codigo } = correrGate(
      con({ "src/db/schema.ts": 'export const t = pgTable("pagos_estacionamiento", {});\n' }),
    );
    comprobar("una entidad en snake_case (pagos_estacionamiento) es rechazada", codigo === 1, `exit=${codigo}`);
  }
  {
    const { codigo } = correrGate(
      con({ "drizzle/0002_x.sql": 'CREATE TABLE "pago" ("id" uuid PRIMARY KEY);\n' }),
    );
    comprobar("una entidad prohibida creada en una MIGRACIÓN es rechazada", codigo === 1, `exit=${codigo}`);
  }
  {
    const { codigo } = correrGate(
      con({ "src/app/selector-sucursal.tsx": "export default function S() { return null; }\n" }),
    );
    comprobar("un selector de sucursal en la interfaz es rechazado (ADR-001)", codigo === 1, `exit=${codigo}`);
  }
  {
    // `.jsx` es extensión de primera clase del App Router y no se escaneaba.
    const { codigo } = correrGate(
      con({ "src/app/cobro.jsx": 'import Stripe from "stripe";\nexport default () => new Stripe("");\n' }),
    );
    comprobar("una pasarela en un archivo .jsx es rechazada", codigo === 1, `exit=${codigo}`);
  }
  {
    const { codigo } = correrGate(
      con({
        "src/app/api/cobro/route.ts":
          'import paypal from "@paypal/checkout-server-sdk";\nexport const p = paypal;\n',
      }),
    );
    comprobar("una pasarela fuera de la lista original (PayPal) es rechazada", codigo === 1, `exit=${codigo}`);
  }
  {
    const { codigo, salida } = correrGate(
      con({ "src/app/camara.tsx": "navigator.mediaDevices.getUserMedia({ video: true });\n" }),
    );
    comprobar(
      "captura de imagen para leer patentes es rechazada",
      codigo === 1 && /AC-SCOPE-3/.test(salida),
      `exit=${codigo}`,
    );
  }

  // --- Falsos positivos: lo que NO debe disparar -----------------------------
  {
    const { codigo, salida } = correrGate(
      con({
        // `overflow` contiene "flow"; sin límites de palabra el gate sería ruido.
        "src/app/tabla.tsx": 'export const c = "overflow-x-auto overflow-hidden";\n',
        // Los comentarios NOMBRAN lo prohibido a propósito, para explicar por qué.
        "src/db/nota.ts": "// El cobro es en efectivo: no hay entidad Pago ni Transaccion.\nexport const x = 1;\n",
      }),
    );
    comprobar(
      "no falla por `overflow` ni por comentarios que nombran lo prohibido",
      codigo === 0,
      codigo === 0 ? "" : salida.split("\n").filter((l) => l.startsWith("FAIL")).join(" | "),
    );
  }
} finally {
  for (const d of temporales) rmSync(d, { recursive: true, force: true });
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("GATE DE ALCANCE PROBADO CON EL FALLO PLANTADO: PASS");
