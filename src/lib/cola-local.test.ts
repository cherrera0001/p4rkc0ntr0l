/**
 * Pruebas de la regla que decide si un rechazo del servidor borra el ingreso
 * del dispositivo (AC-OP-1, hallazgo M-4).
 *
 * Esta es la aserción que protege contra pérdida de datos: el ingreso que el
 * operador registró sin red vive solo en su dispositivo hasta que sube, así que
 * borrarlo por un error transitorio es perderlo. Se prueba acá y no en el
 * navegador porque es una decisión pura sobre un número, y la tabla completa de
 * códigos entra en una prueba unitaria sin necesidad de provocar cada uno.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { esRechazoDefinitivo } from "./cola-local.ts";

describe("esRechazoDefinitivo", () => {
  it("400 es definitivo: el cuerpo es inválido y reintentarlo no lo arregla", () => {
    assert.equal(esRechazoDefinitivo(400), true);
  });

  it("403 es definitivo: la barrera de datos reales no va a cambiar de opinión", () => {
    assert.equal(esRechazoDefinitivo(403), true);
  });

  it("401 es recuperable: la cookie caducó, el ingreso sigue siendo válido", () => {
    assert.equal(esRechazoDefinitivo(401), false);
  });

  it("429 es recuperable: el límite de intentos (C-1) no puede vaciar la cola", () => {
    assert.equal(esRechazoDefinitivo(429), false);
  });

  it("408 y 409 son recuperables", () => {
    assert.equal(esRechazoDefinitivo(408), false);
    assert.equal(esRechazoDefinitivo(409), false);
  });

  it("un 4xx que no sabemos clasificar se trata como recuperable", () => {
    // Ante la duda no se borra: conservar de más cuesta una fila; borrar de más
    // cuesta el ingreso que el operador ya dio por registrado.
    for (const status of [402, 405, 418, 422, 423, 425, 428, 451, 499]) {
      assert.equal(esRechazoDefinitivo(status), false, `HTTP ${status}`);
    }
  });

  it("los 5xx tampoco borran nada", () => {
    for (const status of [500, 502, 503, 504]) {
      assert.equal(esRechazoDefinitivo(status), false, `HTTP ${status}`);
    }
  });

  it("ningún 2xx/3xx cae en la rama de borrado", () => {
    for (const status of [200, 201, 204, 301, 304]) {
      assert.equal(esRechazoDefinitivo(status), false, `HTTP ${status}`);
    }
  });
});
