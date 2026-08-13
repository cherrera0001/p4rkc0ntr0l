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

  // --- Pero el flujo del estacionamiento no puede importarla -----------------
  {
    const { codigo, salida } = correrGate(
      con({
        "package.json": JSON.stringify(
          { name: "x", dependencies: { next: "16.3.0", "transbank-sdk": "^4.0.0" } },
          null,
          2,
        ),
        "src/lib/suscripcion/webpay.ts": 'export const w = 1;\n',
        "src/app/api/sesiones/route.ts": 'import { w } from "@/lib/suscripcion/webpay";\nexport const x = w;\n',
      }),
    );
    comprobar(
      "el flujo del estacionamiento NO puede importar la frontera de suscripción",
      codigo === 1 && /no importa la frontera/.test(salida),
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
