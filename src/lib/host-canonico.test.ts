import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { destinoCanonico, hostsCanonicos, HOST_DESTINO } from "./host-canonico.ts";

const PROD = "production";

describe("destinoCanonico", () => {
  it("redirige el host de vercel.app, que es el camino que evade Cloudflare", () => {
    assert.equal(
      destinoCanonico("estacionamiento-three.vercel.app", "/login", PROD),
      `https://${HOST_DESTINO}/login`,
    );
  });

  it("conserva ruta y parámetros: un 308 sin la ruta perdería la petición", () => {
    assert.equal(
      destinoCanonico("estacionamiento-three.vercel.app", "/api/sesiones?desde=1", PROD),
      `https://${HOST_DESTINO}/api/sesiones?desde=1`,
    );
  });

  it("deja pasar el host canónico y el apex", () => {
    assert.equal(destinoCanonico("www.parkcontrol.cl", "/login", PROD), null);
    assert.equal(destinoCanonico("parkcontrol.cl", "/login", PROD), null);
  });

  it("no le importa el caso ni el puerto", () => {
    assert.equal(destinoCanonico("WWW.ParkControl.CL:443", "/", PROD), null);
  });

  it("no toca las vistas previas: redirigirlas las volvería imposibles de probar", () => {
    assert.equal(
      destinoCanonico("estacionamiento-git-rama-c4-all.vercel.app", "/login", "preview"),
      null,
    );
    assert.equal(destinoCanonico("cualquier.cosa", "/login", undefined), null);
  });

  it("no toca el desarrollo local ni los verificadores contra npm start", () => {
    assert.equal(destinoCanonico("localhost:3000", "/login", PROD), null);
    assert.equal(destinoCanonico("127.0.0.1:3000", "/login", PROD), null);
  });

  it("sin cabecera host no se inventa un destino", () => {
    assert.equal(destinoCanonico(null, "/login", PROD), null);
  });

  it("un host parecido NO cuela: el subdominio ajeno no es el propio", () => {
    assert.equal(
      destinoCanonico("parkcontrol.cl.atacante.example", "/api/login", PROD),
      `https://${HOST_DESTINO}/api/login`,
    );
  });
});

describe("hostsCanonicos", () => {
  it("tiene valor por defecto: un control que depende de una variable se apaga solo", () => {
    assert.deepEqual(hostsCanonicos(), ["www.parkcontrol.cl", "parkcontrol.cl"]);
  });

  it("se puede mudar de dominio por entorno", () => {
    assert.deepEqual(hostsCanonicos(" Otro.CL , x.cl "), ["otro.cl", "x.cl"]);
  });
});
