/**
 * Verificación de AC-PWA-1 (spec.md §9).
 *
 * Comprueba la PROPIEDAD exigida, no una herramienta concreta:
 *
 *   1. El manifiesto se sirve y cumple los requisitos de instalabilidad
 *      (name/short_name, start_url, display, iconos de 192 y 512 px).
 *   2. Los iconos declarados existen y se sirven como imagen.
 *   3. El service worker se registra, se activa y CONTROLA la página.
 *
 * El criterio original decía "auditoría PWA (Lighthouse)". Lighthouse eliminó
 * la categoría PWA (13.4.1 solo define `performance`), así que ese criterio era
 * inverificable. Este script lo reemplaza y sobrevive a que la herramienta
 * cambie: habla CDP directo contra un navegador Chromium.
 *
 * Uso:  node scripts/verificar-pwa.mjs [url]
 * Requiere el servidor levantado (`npm run build && npm start`).
 * Sale con código 0 si todo PASA, 1 si algo FALLA.
 */

import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";

const NAVEGADORES = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const navegador = NAVEGADORES.find((p) => existsSync(p));
if (!navegador) {
  console.error("FAIL · no se encontró un navegador Chromium. Definí CHROME_PATH.");
  process.exit(1);
}

const resultados = [];
function comprobar(nombre, ok, detalle) {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: navegador,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  await page.goto(URL_BASE, { waitUntil: "networkidle2" });

  // --- 1. Manifiesto -------------------------------------------------------
  const hrefManifiesto = await page.$eval('link[rel="manifest"]', (el) => el.href)
    .catch(() => null);
  comprobar("existe <link rel=manifest>", Boolean(hrefManifiesto), hrefManifiesto ?? "");

  let manifiesto = null;
  if (hrefManifiesto) {
    const r = await page.goto(hrefManifiesto, { waitUntil: "domcontentloaded" });
    comprobar("el manifiesto responde 200", r.status() === 200, `HTTP ${r.status()}`);
    try {
      manifiesto = JSON.parse(await r.text());
    } catch {
      comprobar("el manifiesto es JSON válido", false);
    }
  }

  if (manifiesto) {
    comprobar("el manifiesto es JSON válido", true);
    comprobar(
      "tiene name o short_name",
      Boolean(manifiesto.name || manifiesto.short_name),
      manifiesto.name ?? manifiesto.short_name ?? "",
    );
    comprobar("tiene start_url", Boolean(manifiesto.start_url), manifiesto.start_url ?? "");

    const displaysValidos = ["standalone", "fullscreen", "minimal-ui"];
    comprobar(
      "display permite instalación",
      displaysValidos.includes(manifiesto.display),
      manifiesto.display ?? "(ausente)",
    );

    const iconos = manifiesto.icons ?? [];
    const tiene = (lado) =>
      iconos.some((i) => String(i.sizes ?? "").split(/\s+/).includes(`${lado}x${lado}`));
    comprobar("tiene icono de 192x192", tiene(192));
    comprobar("tiene icono de 512x512", tiene(512));

    // --- 2. Los iconos declarados existen de verdad ------------------------
    for (const icono of iconos) {
      const url = new URL(icono.src, URL_BASE).href;
      const r = await page.goto(url, { waitUntil: "domcontentloaded" });
      const tipo = r.headers()["content-type"] ?? "";
      comprobar(
        `icono ${icono.src} se sirve como imagen`,
        r.status() === 200 && tipo.startsWith("image/"),
        `HTTP ${r.status()} · ${tipo}`,
      );
    }
  }

  // --- 3. Service worker: registrado, activo y controlando -----------------
  await page.goto(URL_BASE, { waitUntil: "networkidle2" });

  const registrado = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { ok: false, motivo: "API ausente" };
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg) return { ok: false, motivo: "no llegó a ready" };
    return { ok: true, scope: reg.scope, estado: reg.active?.state ?? "sin worker activo" };
  });
  comprobar(
    "el service worker se registra y activa",
    registrado.ok && registrado.estado === "activated",
    registrado.ok ? `scope=${registrado.scope} estado=${registrado.estado}` : registrado.motivo,
  );

  // Un SW activo no controla la pestaña que lo instaló hasta que reclama o se
  // recarga. Recargamos para comprobar el control real, que es lo que importa
  // para que la app abra sin red.
  await page.reload({ waitUntil: "networkidle2" });
  const controlando = await page.evaluate(() => ({
    controlada: navigator.serviceWorker.controller !== null,
    script: navigator.serviceWorker.controller?.scriptURL ?? null,
  }));
  comprobar(
    "el service worker controla la página",
    controlando.controlada,
    controlando.script ?? "sin controlador",
  );
} finally {
  await browser.close();
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(
  `\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones PASS`,
);
if (fallidos.length) {
  console.log("FALLARON: " + fallidos.map((f) => f.nombre).join(", "));
  process.exit(1);
}
console.log("AC-PWA-1: PASS");
