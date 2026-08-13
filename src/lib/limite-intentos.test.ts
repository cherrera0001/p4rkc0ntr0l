/**
 * Pruebas del freno de fuerza bruta (hallazgo C-1).
 *
 * El reloj entra por parámetro, así que la ventana de 15 minutos y el retardo
 * creciente se prueban enteros sin esperar ni un segundo real.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  identificarCliente,
  LimitadorIntentos,
  OPCIONES_LOGIN,
  type OpcionesLimitador,
} from "./limite-intentos.ts";

const T0 = 1_776_000_000_000;

function limitador(cambios: Partial<OpcionesLimitador> = {}) {
  return new LimitadorIntentos({ ...OPCIONES_LOGIN, ...cambios });
}

describe("LimitadorIntentos", () => {
  it("deja pasar mientras no se pase del máximo", () => {
    const l = limitador();
    for (let i = 0; i < OPCIONES_LOGIN.maxIntentos; i++) {
      assert.equal(l.registrarFallo("1.2.3.4", T0 + i).permitido, true, `fallo ${i}`);
    }
  });

  it("bloquea al pasarse, y dice cuánto esperar", () => {
    const l = limitador();
    for (let i = 0; i <= OPCIONES_LOGIN.maxIntentos; i++) l.registrarFallo("1.2.3.4", T0 + i);

    const veredicto = l.consultar("1.2.3.4", T0 + 100);
    assert.equal(veredicto.permitido, false);
    assert.ok(veredicto.permitido === false && veredicto.esperaSegundos > 0);
  });

  it("la espera crece con cada fallo extra, hasta el techo", () => {
    const l = limitador({ esperaBaseMs: 1000, esperaMaximaMs: 8000 });
    const esperas: number[] = [];

    for (let i = 0; i < OPCIONES_LOGIN.maxIntentos + 5; i++) {
      const v = l.registrarFallo("1.2.3.4", T0);
      if (v.permitido === false) esperas.push(v.esperaSegundos);
    }

    // 1s, 2s, 4s, 8s y de ahí no sube más.
    assert.deepEqual(esperas, [1, 2, 4, 8, 8]);
  });

  it("cumplida la espera vuelve a dejar intentar", () => {
    const l = limitador({ esperaBaseMs: 1000, esperaMaximaMs: 1000 });
    for (let i = 0; i <= OPCIONES_LOGIN.maxIntentos; i++) l.registrarFallo("1.2.3.4", T0);

    assert.equal(l.consultar("1.2.3.4", T0 + 999).permitido, false);
    assert.equal(l.consultar("1.2.3.4", T0 + 1001).permitido, true);
  });

  it("los fallos viejos salen de la ventana y dejan de contar", () => {
    const l = limitador();
    for (let i = 0; i < OPCIONES_LOGIN.maxIntentos; i++) l.registrarFallo("1.2.3.4", T0);

    // Muy después: el historial caducó, así que este fallo es el primero.
    const despues = T0 + OPCIONES_LOGIN.ventanaMs + 1;
    assert.equal(l.registrarFallo("1.2.3.4", despues).permitido, true);
  });

  it("un login correcto limpia el historial: el operador que se equivocó no queda castigado", () => {
    const l = limitador();
    for (let i = 0; i < OPCIONES_LOGIN.maxIntentos; i++) l.registrarFallo("1.2.3.4", T0);

    l.registrarExito("1.2.3.4");
    for (let i = 0; i < OPCIONES_LOGIN.maxIntentos; i++) {
      assert.equal(l.registrarFallo("1.2.3.4", T0).permitido, true, `fallo ${i}`);
    }
  });

  it("bloquear una clave no bloquea a otra", () => {
    const l = limitador();
    for (let i = 0; i <= OPCIONES_LOGIN.maxIntentos; i++) l.registrarFallo("1.2.3.4", T0);

    assert.equal(l.consultar("1.2.3.4", T0).permitido, false);
    assert.equal(l.consultar("5.6.7.8", T0).permitido, true);
  });

  it("no crece sin límite: rotar la IP no es un vector de agotamiento de memoria", () => {
    const l = limitador({ maxClaves: 50 });
    for (let i = 0; i < 500; i++) l.registrarFallo(`ip-${i}`, T0);

    assert.ok(l.tamano <= 50, `tamaño ${l.tamano}`);
  });

  it("las claves muertas se podan solas al pasar la ventana", () => {
    const l = limitador();
    for (let i = 0; i < 100; i++) l.registrarFallo(`ip-${i}`, T0);

    l.registrarFallo("nueva", T0 + OPCIONES_LOGIN.ventanaMs + 1);
    assert.equal(l.tamano, 1);
  });
});

describe("identificarCliente", () => {
  it("toma la primera IP de x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" });
    assert.equal(identificarCliente(h), "203.0.113.7");
  });

  it("sin la cabecera cae a una clave fija, que igual frena la ráfaga", () => {
    assert.equal(identificarCliente(new Headers()), "sin-ip");
    assert.equal(identificarCliente(new Headers({ "x-forwarded-for": "  " })), "sin-ip");
  });
});
