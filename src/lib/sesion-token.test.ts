/**
 * Pruebas del token de sesión (hallazgo A-1).
 *
 * Lo que se prueba es la propiedad que faltaba: que el servidor rechace una
 * cookie vencida aunque esté perfectamente firmada. Es la clase de regla que
 * falla en silencio y siempre a favor de quien tenga la cookie, así que no puede
 * quedar solo verificada "a ojo" en una corrida manual.
 *
 * `SESSION_SECRET` se define acá con un valor de fixture, que se ve como
 * fixture: la prueba no toca el entorno real.
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  deserializarSesion,
  DURACION_SEGUNDOS,
  igualEnTiempoConstante,
  serializarSesion,
  type SesionUsuario,
} from "./sesion-token.ts";

const USUARIO: SesionUsuario = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "operador@fixture.invalid",
  rol: "operador",
  estacionamientoId: "00000000-0000-4000-8000-0000000000ff",
};

const T0 = new Date("2026-08-10T08:00:00.000Z");
const seg = (n: number) => new Date(T0.getTime() + n * 1000);

let previa: string | undefined;

beforeEach(() => {
  previa = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "SECRETO-DE-FIXTURE-NO-REAL";
});

afterEach(() => {
  if (previa === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = previa;
});

describe("serializarSesion / deserializarSesion", () => {
  it("una sesión recién emitida se acepta y conserva la identidad", () => {
    const carga = deserializarSesion(serializarSesion(USUARIO, T0), T0);

    assert.ok(carga);
    assert.equal(carga.id, USUARIO.id);
    assert.equal(carga.rol, "operador");
    assert.equal(carga.estacionamientoId, USUARIO.estacionamientoId);
  });

  it("firma iat y exp: no son un atributo de cookie que el cliente pueda ignorar", () => {
    const carga = deserializarSesion(serializarSesion(USUARIO, T0), T0);

    assert.ok(carga);
    assert.equal(carga.iat, Math.floor(T0.getTime() / 1000));
    assert.equal(carga.exp, carga.iat + DURACION_SEGUNDOS);
  });

  it("sigue válida un segundo antes de vencer", () => {
    const token = serializarSesion(USUARIO, T0);
    assert.ok(deserializarSesion(token, seg(DURACION_SEGUNDOS - 1)));
  });

  it("deja de valer al vencer, con la firma intacta", () => {
    const token = serializarSesion(USUARIO, T0);
    assert.equal(deserializarSesion(token, seg(DURACION_SEGUNDOS)), null);
    assert.equal(deserializarSesion(token, seg(DURACION_SEGUNDOS + 3600)), null);
  });

  it("una carga sin exp —las emitidas antes de A-1— se trata como vencida", () => {
    // Se firma a mano una carga con el formato viejo, y con firma GENUINA: lo
    // que se prueba es que se rechaza *pese* a estar bien firmada. Esa era
    // exactamente la cookie eterna que describe el hallazgo.
    const vieja = Buffer.from(JSON.stringify(USUARIO), "utf8").toString("base64url");

    assert.equal(deserializarSesion(`${vieja}.${firmaDe(vieja)}`, T0), null);
  });

  it("rechaza una carga manipulada: el rol no se puede ascender editando la cookie", () => {
    const token = serializarSesion(USUARIO, T0);
    const [, firma] = token.split(".");
    const falsa = Buffer.from(
      JSON.stringify({ ...USUARIO, rol: "dueño", iat: 0, exp: 4102444800 }),
      "utf8",
    ).toString("base64url");

    assert.equal(deserializarSesion(`${falsa}.${firma}`, T0), null);
  });

  it("rechaza basura, cadenas vacías y formatos que no son token", () => {
    for (const valor of [undefined, "", ".", "a.b.c", "sinpunto", "aaa."]) {
      assert.equal(deserializarSesion(valor, T0), null, String(valor));
    }
  });

  it("un secreto distinto invalida lo emitido: rotarlo revoca todo de golpe", () => {
    const token = serializarSesion(USUARIO, T0);
    process.env.SESSION_SECRET = "OTRO-SECRETO-DE-FIXTURE";
    assert.equal(deserializarSesion(token, T0), null);
  });
});

describe("igualEnTiempoConstante", () => {
  it("no se rinde ante largos distintos: compara huellas, no valores (B-1)", () => {
    assert.equal(igualEnTiempoConstante("clave-de-fixture", "clave-de-fixture"), true);
    assert.equal(igualEnTiempoConstante("clave-de-fixture", "x"), false);
    assert.equal(igualEnTiempoConstante("", ""), true);
    assert.equal(igualEnTiempoConstante("a", "aa"), false);
  });
});

/**
 * Firma genuina, con el mismo algoritmo que el módulo. No se importa la interna
 * de `sesion-token.ts` a propósito: si el formato cambia, esta prueba tiene que
 * romperse en vez de seguirlo en silencio.
 */
function firmaDe(carga: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET as string)
    .update(carga)
    .digest()
    .toString("base64url");
}
