/**
 * Pruebas de la frontera de entrada de la patente (spec.md §5, §7).
 *
 * Las patentes de estas pruebas son fixtures deliberados: combinaciones
 * genéricas que respetan el formato pero no corresponden a ningún vehículo
 * (spec.md §11). No se usan patentes reales en ninguna parte del proyecto.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatoPatente, normalizarPatente, validarPatente } from "./patente.ts";

describe("normalizarPatente", () => {
  it("pasa a mayúsculas", () => {
    assert.equal(normalizarPatente("abcd12"), "ABCD12");
  });

  it("quita guiones, puntos y espacios", () => {
    assert.equal(normalizarPatente("ab.cd-12"), "ABCD12");
    assert.equal(normalizarPatente("  AB CD 12  "), "ABCD12");
  });

  it("distintas escrituras de la misma patente colapsan en una sola", () => {
    const formas = ["abcd12", "AB.CD-12", "ab cd 12", "A B C D 1 2"];
    const normalizadas = new Set(formas.map(normalizarPatente));
    assert.equal(normalizadas.size, 1);
  });

  it("descarta cualquier símbolo que no sea alfanumérico", () => {
    assert.equal(normalizarPatente("AB#CD$12!"), "ABCD12");
  });
});

describe("formatoPatente", () => {
  it("reconoce el formato antiguo de 2 letras y 4 dígitos", () => {
    assert.equal(formatoPatente("AB1234"), "antiguo");
  });

  it("reconoce el formato nuevo de 4 letras y 2 dígitos", () => {
    assert.equal(formatoPatente("ABCD12"), "nuevo");
  });

  it("cualquier otra combinación válida cae en 'otro'", () => {
    assert.equal(formatoPatente("A1B2C3"), "otro");
  });
});

describe("validarPatente — acepta", () => {
  it("acepta el formato antiguo", () => {
    const r = validarPatente("ab1234");
    assert.equal(r.valida, true);
    if (r.valida) {
      assert.equal(r.patente, "AB1234");
      assert.equal(r.formato, "antiguo");
    }
  });

  it("acepta el formato nuevo", () => {
    const r = validarPatente("ABCD12");
    assert.equal(r.valida, true);
    if (r.valida) assert.equal(r.formato, "nuevo");
  });

  it("acepta formatos no estándar para no frenar al operador", () => {
    // Motos, vehículos extranjeros, placas especiales. Rechazarlas rompería H1.
    const r = validarPatente("XY99");
    assert.equal(r.valida, true);
    if (r.valida) assert.equal(r.formato, "otro");
  });
});

describe("validarPatente — rechaza", () => {
  it("rechaza lo que no es texto", () => {
    assert.equal(validarPatente(1234).valida, false);
    assert.equal(validarPatente(null).valida, false);
    assert.equal(validarPatente(undefined).valida, false);
    assert.equal(validarPatente({}).valida, false);
  });

  it("rechaza la cadena vacía", () => {
    const r = validarPatente("");
    assert.equal(r.valida, false);
    if (!r.valida) assert.match(r.motivo, /vacía/);
  });

  it("rechaza una entrada que solo tiene símbolos", () => {
    const r = validarPatente("---...");
    assert.equal(r.valida, false);
  });

  it("rechaza patentes demasiado cortas", () => {
    const r = validarPatente("A1");
    assert.equal(r.valida, false);
    if (!r.valida) assert.match(r.motivo, /corta/);
  });

  it("rechaza patentes demasiado largas", () => {
    const r = validarPatente("ABCD123456");
    assert.equal(r.valida, false);
    if (!r.valida) assert.match(r.motivo, /larga/);
  });

  it("rechaza una entrada sin ningún dígito", () => {
    const r = validarPatente("ABCDEF");
    assert.equal(r.valida, false);
    if (!r.valida) assert.match(r.motivo, /dígito/);
  });

  it("no deja pasar intentos de inyección: quedan sin dígitos o sin largo", () => {
    for (const hostil of ["'; DROP TABLE sesion_vehiculo; --", "<script>x</script>"]) {
      assert.equal(validarPatente(hostil).valida, false);
    }
  });
});
