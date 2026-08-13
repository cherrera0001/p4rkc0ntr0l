/**
 * Pruebas del saneo de instantes (hallazgo INT-14).
 *
 * Los dos casos que se prueban son los dos fallos reales que el hallazgo
 * describe —reloj adelantado y reloj atrasado—, y la propiedad que los une: en
 * ningún caso el resultado puede dejar una sesión imposible de cerrar.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calcularDesfase,
  entradaFacturable,
  MONTO_MAXIMO,
  montoAlmacenable,
  PERMANENCIA_MAXIMA_MS,
  sanearIngreso,
} from "./tiempo.ts";

const SERVIDOR = new Date("2026-08-10T15:00:00.000Z");
const min = (n: number) => n * 60_000;
const dias = (n: number) => n * 24 * 60 * 60_000;

/** Ingreso medido por un reloj con `desfase` ms de error, hace `edad` ms. */
function ingresoDe(desfase: number, edad: number) {
  const entradaReal = SERVIDOR.getTime() - edad;
  return {
    instantes: {
      entradaAt: new Date(entradaReal + desfase),
      tecleoInicioAt: new Date(entradaReal + desfase - 4000),
      tecleoFinAt: new Date(entradaReal + desfase),
    },
    clienteAhora: new Date(SERVIDOR.getTime() + desfase),
  };
}

describe("calcularDesfase", () => {
  it("un desfase chico es latencia de red, no un reloj mal puesto", () => {
    assert.equal(calcularDesfase(new Date(SERVIDOR.getTime() + 800), SERVIDOR), 0);
  });

  it("detecta el reloj adelantado y el atrasado con signo", () => {
    assert.equal(calcularDesfase(new Date(SERVIDOR.getTime() + min(90)), SERVIDOR), min(90));
    assert.equal(calcularDesfase(new Date(SERVIDOR.getTime() - dias(3)), SERVIDOR), -dias(3));
  });

  it("sin 'ahora' del cliente —cola de una versión anterior— el desfase es cero", () => {
    assert.equal(calcularDesfase(null, SERVIDOR), 0);
  });
});

describe("sanearIngreso — reloj adelantado (el que dejaba la sesión incerrable)", () => {
  it("devuelve la entrada al pasado: deja de ser incerrable", () => {
    const { instantes, clienteAhora } = ingresoDe(dias(1), min(20));
    const saneado = sanearIngreso(instantes, clienteAhora, SERVIDOR);

    assert.ok(saneado.entradaAt <= SERVIDOR, saneado.entradaAt.toISOString());
    // Y conserva la antigüedad real del ingreso: 20 minutos, no un día.
    assert.equal(SERVIDOR.getTime() - saneado.entradaAt.getTime(), min(20));
  });

  it("sin el 'ahora' del cliente, igual la acota a no-futura", () => {
    const { instantes } = ingresoDe(dias(1), min(20));
    const saneado = sanearIngreso(instantes, null, SERVIDOR);

    assert.equal(saneado.entradaAt.getTime(), SERVIDOR.getTime());
    assert.equal(saneado.acotada, true);
  });
});

describe("sanearIngreso — reloj atrasado (el del monto arbitrario)", () => {
  it("no infla la permanencia: la antigüedad real se conserva", () => {
    const { instantes, clienteAhora } = ingresoDe(-dias(21), min(35));
    const saneado = sanearIngreso(instantes, clienteAhora, SERVIDOR);

    assert.equal(SERVIDOR.getTime() - saneado.entradaAt.getTime(), min(35));
    assert.equal(saneado.acotada, false);
  });

  it("sin el 'ahora' del cliente, la antigüedad queda acotada al techo", () => {
    const { instantes } = ingresoDe(-dias(400), min(35));
    const saneado = sanearIngreso(instantes, null, SERVIDOR);

    assert.equal(SERVIDOR.getTime() - saneado.entradaAt.getTime(), PERMANENCIA_MAXIMA_MS);
    assert.equal(saneado.acotada, true);
  });
});

describe("sanearIngreso — lo que no toca", () => {
  it("un reloj en hora pasa sin cambios", () => {
    const { instantes, clienteAhora } = ingresoDe(0, min(10));
    const saneado = sanearIngreso(instantes, clienteAhora, SERVIDOR);

    assert.equal(saneado.desfaseMs, 0);
    assert.equal(saneado.acotada, false);
    assert.equal(saneado.entradaAt.getTime(), instantes.entradaAt.getTime());
  });

  it("conserva la duración del tecleo, que es la métrica de H1", () => {
    // La corrección es una traslación: una duración no cambia al trasladarla.
    for (const desfase of [0, min(7), -dias(400), dias(1)]) {
      const { instantes, clienteAhora } = ingresoDe(desfase, min(10));
      const medida = instantes.tecleoFinAt.getTime() - instantes.tecleoInicioAt.getTime();
      const saneado = sanearIngreso(instantes, clienteAhora, SERVIDOR);

      assert.equal(
        saneado.tecleoFinAt.getTime() - saneado.tecleoInicioAt.getTime(),
        medida,
        `desfase ${desfase}`,
      );
    }
  });

  it("no acota los instantes de tecleo: son evidencia medida, no se fabrican", () => {
    const { instantes } = ingresoDe(dias(1), min(20));
    const saneado = sanearIngreso(instantes, null, SERVIDOR);

    // La entrada sí se recorta; el tecleo se guarda tal como se midió.
    assert.ok(saneado.tecleoFinAt > SERVIDOR);
  });
});

describe("entradaFacturable", () => {
  const salida = SERVIDOR;

  it("una entrada normal no se toca", () => {
    const entrada = new Date(salida.getTime() - min(90));
    assert.equal(entradaFacturable(entrada, salida).getTime(), entrada.getTime());
  });

  it("una entrada posterior a la salida deja de lanzar: la sesión se puede cerrar", () => {
    // Es la fila que ya quedó en la base antes de esta corrección.
    const entrada = new Date(salida.getTime() + dias(1));
    assert.equal(entradaFacturable(entrada, salida).getTime(), salida.getTime());
  });

  it("una entrada absurdamente vieja se recorta al techo facturable", () => {
    const entrada = new Date(salida.getTime() - dias(900));
    assert.equal(
      salida.getTime() - entradaFacturable(entrada, salida).getTime(),
      PERMANENCIA_MAXIMA_MS,
    );
  });
});

describe("montoAlmacenable", () => {
  it("deja pasar un monto normal, redondeado a entero", () => {
    assert.equal(montoAlmacenable(3450.4), 3450);
  });

  it("recorta lo que no entra en un integer de Postgres", () => {
    assert.equal(montoAlmacenable(9e12), MONTO_MAXIMO);
  });

  it("un valor imposible no se propaga a la base", () => {
    // Cero y no el techo: un monto que salió NaN o infinito es un error de
    // cálculo, y cobrar dos mil millones por un error de cálculo es peor que no
    // cobrar. El caso es inalcanzable hoy —`calcularMonto` valida sus entradas—;
    // esto es el último borde antes del `UPDATE`.
    assert.equal(montoAlmacenable(Number.NaN), 0);
    assert.equal(montoAlmacenable(-5), 0);
    assert.equal(montoAlmacenable(Number.POSITIVE_INFINITY), 0);
  });
});
