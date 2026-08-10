/**
 * Prueba unitaria de AC-OP-2 (spec.md §5, §9).
 *
 * "Dada una tarifa y una duración conocidas, el monto_calculado coincide con el
 * valor esperado, incluido el monto_minimo y el redondeo por fraccion_minutos."
 *
 * Los números son fixtures deliberadamente redondos. No pretenden parecerse a
 * una tarifa real de ningún estacionamiento (spec.md §11).
 *
 * Ejecutar: npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calcularMonto, minutosCobrados } from "./tarificacion.ts";

/** Fixture: 1000/hora, fracción de 15 min, mínimo 500. */
const TARIFA = { valorHora: 1000, fraccionMinutos: 15, montoMinimo: 500 };

const BASE = new Date("2026-01-01T12:00:00.000Z");
const tras = (minutos: number) =>
  new Date(BASE.getTime() + minutos * 60_000);

const permanencia = (minutos: number) => ({
  entradaAt: BASE,
  salidaAt: tras(minutos),
});

describe("minutosCobrados — redondeo por fracción", () => {
  it("una permanencia exacta en la fracción no se redondea", () => {
    assert.equal(minutosCobrados(permanencia(30), 15), 30);
  });

  it("un solo minuto dentro de la fracción consume la fracción entera", () => {
    assert.equal(minutosCobrados(permanencia(16), 15), 30);
  });

  it("un segundo por encima ya salta a la fracción siguiente", () => {
    const p = { entradaAt: BASE, salidaAt: new Date(BASE.getTime() + 15 * 60_000 + 1000) };
    assert.equal(minutosCobrados(p, 15), 30);
  });

  it("permanencia de cero minutos cobra cero minutos", () => {
    assert.equal(minutosCobrados(permanencia(0), 15), 0);
  });

  it("una fracción de 1 minuto redondea al minuto", () => {
    assert.equal(minutosCobrados(permanencia(61), 1), 61);
  });
});

describe("calcularMonto — tarifa completa", () => {
  it("una hora exacta cobra el valor de la hora", () => {
    assert.equal(calcularMonto(permanencia(60), TARIFA), 1000);
  });

  it("dos horas exactas cobran el doble", () => {
    assert.equal(calcularMonto(permanencia(120), TARIFA), 2000);
  });

  it("90 minutos cobran hora y media", () => {
    assert.equal(calcularMonto(permanencia(90), TARIFA), 1500);
  });

  it("46 minutos se redondean a 60 y cobran la hora completa", () => {
    // 46 min -> fracción de 15 -> 60 min -> 1000
    assert.equal(calcularMonto(permanencia(46), TARIFA), 1000);
  });

  it("31 minutos se redondean a 45 y cobran tres cuartos de hora", () => {
    // 45/60 * 1000 = 750
    assert.equal(calcularMonto(permanencia(31), TARIFA), 750);
  });
});

describe("calcularMonto — el monto mínimo es un piso", () => {
  it("una permanencia corta cobra el mínimo, no el proporcional", () => {
    // 15 min -> 15/60 * 1000 = 250, por debajo del mínimo de 500
    assert.equal(calcularMonto(permanencia(10), TARIFA), 500);
  });

  it("una permanencia de cero minutos igual cobra el mínimo", () => {
    assert.equal(calcularMonto(permanencia(0), TARIFA), 500);
  });

  it("justo en el umbral del mínimo cobra el mínimo", () => {
    // 30 min -> 30/60 * 1000 = 500, exactamente el mínimo
    assert.equal(calcularMonto(permanencia(30), TARIFA), 500);
  });

  it("por encima del umbral cobra el proporcional", () => {
    // 45 min -> 750 > 500
    assert.equal(calcularMonto(permanencia(45), TARIFA), 750);
  });

  it("un mínimo en cero no interfiere", () => {
    const sinMinimo = { ...TARIFA, montoMinimo: 0 };
    assert.equal(calcularMonto(permanencia(15), sinMinimo), 250);
  });
});

describe("calcularMonto — redondeo a peso entero", () => {
  it("devuelve siempre un entero", () => {
    // 20 min a 999/hora con fracción de 20: 20/60 * 999 = 333
    const t = { valorHora: 999, fraccionMinutos: 20, montoMinimo: 0 };
    const monto = calcularMonto(permanencia(20), t);
    assert.equal(Number.isInteger(monto), true);
    assert.equal(monto, 333);
  });

  it("redondea al entero más cercano, no hacia arriba", () => {
    // 10 min a 1000/hora con fracción de 10: 10/60 * 1000 = 166.67 -> 167
    const t = { valorHora: 1000, fraccionMinutos: 10, montoMinimo: 0 };
    assert.equal(calcularMonto(permanencia(10), t), 167);
  });
});

describe("calcularMonto — entradas inválidas", () => {
  it("rechaza una salida anterior a la entrada", () => {
    const p = { entradaAt: BASE, salidaAt: tras(-10) };
    assert.throws(() => calcularMonto(p, TARIFA), /anterior a entradaAt/);
  });

  it("rechaza una fracción de cero minutos", () => {
    const t = { ...TARIFA, fraccionMinutos: 0 };
    assert.throws(() => calcularMonto(permanencia(30), t), /fraccionMinutos/);
  });

  it("rechaza una fracción negativa", () => {
    const t = { ...TARIFA, fraccionMinutos: -15 };
    assert.throws(() => calcularMonto(permanencia(30), t), /fraccionMinutos/);
  });

  it("rechaza un valor por hora negativo", () => {
    const t = { ...TARIFA, valorHora: -1000 };
    assert.throws(() => calcularMonto(permanencia(30), t), /valorHora/);
  });

  it("rechaza fechas inválidas", () => {
    const p = { entradaAt: BASE, salidaAt: new Date("no es fecha") };
    assert.throws(() => calcularMonto(p, TARIFA), /fechas válidas/);
  });
});
