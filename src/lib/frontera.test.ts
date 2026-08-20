/**
 * Pruebas de las guardas de frontera (`src/lib/frontera.ts`).
 *
 * ## Por qué estas pruebas existen, y por qué son unitarias
 *
 * `verificar:frontera` es un verificador de caja negra excelente para lo que
 * alcanza, pero **hay código de frontera que no alcanza**: manda el mismo valor
 * degenerado en **todos** los campos a la vez, así que la primera guarda que
 * rechaza —`validarPatente`— corta la petición y todo lo que está aguas abajo
 * queda sin ejercitar. Medido: con la cota de rango de fecha quitada del
 * producto, ese verificador seguía reportando **5/5 PASS**.
 *
 * Ese es el hueco que estas pruebas cubren: son deterministas, no necesitan
 * servidor ni base, y llegan a la función directamente.
 *
 * Los casos de fecha no son inventados: son los que produjeron un **503 real**
 * contra la API, con `[22009] time zone displacement out of range` en el log.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  enteroDeFrontera,
  esIdValido,
  esTextoAlmacenable,
  fechaDeFrontera,
  RANGO_FECHA_MS,
} from "./frontera.ts";

describe("fechaDeFrontera", () => {
  it("acepta una fecha ISO normal", () => {
    const d = fechaDeFrontera("2026-08-19T12:00:00.000Z");
    assert.ok(d instanceof Date);
    assert.equal(d.toISOString(), "2026-08-19T12:00:00.000Z");
  });

  it("rechaza lo que no es texto", () => {
    for (const v of [null, undefined, 12345, {}, [], true]) {
      assert.equal(fechaDeFrontera(v), null, `debería rechazar ${JSON.stringify(v)}`);
    }
  });

  it("rechaza texto que no es una fecha", () => {
    assert.equal(fechaDeFrontera(""), null);
    assert.equal(fechaDeFrontera("no soy una fecha"), null);
    assert.equal(fechaDeFrontera("9999-99-99T99:99:99.999Z"), null);
  });

  /**
   * **El caso que produjo el 503.** Postgres no admite este año: el valor
   * atravesaba la frontera, reventaba en el driver como `22009`, salía 503, y la
   * cola local lo reintentaba para siempre cortando el lote del turno.
   */
  it("rechaza el año fuera del rango de Postgres que producía 503", () => {
    assert.equal(fechaDeFrontera("-010000-01-01T00:00:00.000Z"), null);
  });

  it("rechaza los bordes representables de Date, que desbordan al corregir el reloj", () => {
    assert.equal(fechaDeFrontera("+275760-09-13T00:00:00.000Z"), null);
    assert.equal(fechaDeFrontera("-271821-04-20T00:00:00.000Z"), null);
  });

  it("acepta justo dentro de la cota y rechaza justo fuera", () => {
    const dentro = new Date(Date.now() + RANGO_FECHA_MS - 60_000);
    const fuera = new Date(Date.now() + RANGO_FECHA_MS + 60_000);
    assert.ok(fechaDeFrontera(dentro.toISOString()) instanceof Date);
    assert.equal(fechaDeFrontera(fuera.toISOString()), null);
  });

  /**
   * Piso del criterio: una cota que rechazara el presente sería peor que no
   * tenerla — dejaría al operador sin poder registrar nada.
   */
  it("no rechaza el presente (piso: una cota que rompe el uso normal no sirve)", () => {
    assert.ok(fechaDeFrontera(new Date().toISOString()) instanceof Date);
  });
});

describe("enteroDeFrontera", () => {
  it("acepta el entero como número y como texto exactamente entero", () => {
    assert.equal(enteroDeFrontera(10, 0, 100), 10);
    assert.equal(enteroDeFrontera("10", 0, 100), 10);
  });

  it("rechaza lo que no es un entero", () => {
    for (const v of ["10.5", "1,000", "", "  ", "diez", null, undefined, {}, [], NaN, Infinity, 10.5]) {
      assert.equal(enteroDeFrontera(v, 0, 100), null, `debería rechazar ${JSON.stringify(v)}`);
    }
  });

  it("hace cumplir el rango en los dos extremos, inclusive", () => {
    assert.equal(enteroDeFrontera(0, 0, 100), 0);
    assert.equal(enteroDeFrontera(100, 0, 100), 100);
    assert.equal(enteroDeFrontera(-1, 0, 100), null);
    assert.equal(enteroDeFrontera(101, 0, 100), null);
  });
});

describe("esIdValido", () => {
  it("acepta un uuid y rechaza los 36 guiones que produjeron el 22P02", () => {
    assert.equal(esIdValido("f4b8cc6e-1111-4222-8333-444455556666"), true);
    assert.equal(esIdValido("------------------------------------"), false);
    assert.equal(esIdValido("zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"), false);
    assert.equal(esIdValido(12345), false);
  });
});

describe("esTextoAlmacenable", () => {
  it("rechaza el byte NUL y acepta el texto legítimo", () => {
    assert.equal(esTextoAlmacenable(`a${String.fromCharCode(0)}b`), false);
    assert.equal(esTextoAlmacenable("a\n b"), true);
    assert.equal(esTextoAlmacenable("ñandú"), true);
    assert.equal(esTextoAlmacenable(12345), false);
  });
});
