/**
 * Pruebas del saneo de errores (hallazgo INT-1).
 *
 * La propiedad que se prueba es una sola y es la que importa: nada de lo que
 * este módulo devuelve puede contener la contraseña de Postgres. Se prueba con
 * la forma exacta del error que ya ocurrió una vez en producción —el
 * `ERR_INVALID_URL` con la cadena completa en `message` y en `input`, registrado
 * en `LEDGER.md`— y no con un caso inventado.
 *
 * La clave usada acá es de fixture y se ve como tal: no se parece a una real.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  describirParaLog,
  ErrorBaseDatos,
  ErrorConfiguracion,
  redactarSecretos,
} from "./errores.ts";

const CLAVE_FIXTURE = "CLAVE-DE-FIXTURE-NO-REAL";
const CADENA = `postgresql://usuario_fixture:${CLAVE_FIXTURE}@proxy.fixture.invalid:55464/railway?sslmode=require`;

let previa: string | undefined;

beforeEach(() => {
  previa = process.env.DATABASE_URL;
  process.env.DATABASE_URL = CADENA;
});

afterEach(() => {
  if (previa === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previa;
});

describe("redactarSecretos", () => {
  it("saca la credencial de una URI aunque no coincida con ninguna variable", () => {
    const otra = "postgresql://otro:OTRA-CLAVE-DE-FIXTURE@host.invalid:5432/db";
    const salida = redactarSecretos(`falló al conectar a ${otra}`);

    assert.ok(!salida.includes("OTRA-CLAVE-DE-FIXTURE"), salida);
    assert.ok(!salida.includes("otro:"), salida);
    // El host se conserva: es lo único que sirve para diagnosticar.
    assert.ok(salida.includes("host.invalid:5432"), salida);
  });

  it("saca la contraseña suelta, sin el resto de la URI alrededor", () => {
    const salida = redactarSecretos(`password authentication failed: ${CLAVE_FIXTURE}`);
    assert.ok(!salida.includes(CLAVE_FIXTURE), salida);
  });

  it("no redacta un valor demasiado corto: mutilaría el mensaje sin proteger nada", () => {
    process.env.CLAVE_ACCESO = "abc";
    try {
      assert.equal(redactarSecretos("abcdefg"), "abcdefg");
    } finally {
      delete process.env.CLAVE_ACCESO;
    }
  });

  it("deja intacto un texto sin secretos", () => {
    assert.equal(redactarSecretos("connect ETIMEDOUT"), "connect ETIMEDOUT");
  });
});

describe("ErrorBaseDatos.desde", () => {
  it("no arrastra la cadena de conexión del ERR_INVALID_URL que ya ocurrió", () => {
    // Reproduce el error real: mensaje con la cadena y propiedad `input`, que es
    // donde `new URL()` la guarda y donde `console.error(objeto)` la imprimiría.
    const original = new TypeError(`Invalid URL: ${CADENA}`) as TypeError & {
      code: string;
      input: string;
    };
    original.code = "ERR_INVALID_URL";
    original.input = CADENA;

    const saneado = ErrorBaseDatos.desde(original);

    assert.ok(saneado instanceof ErrorBaseDatos);
    assert.equal(saneado.codigo, "ERR_INVALID_URL");
    assert.ok(!saneado.message.includes(CLAVE_FIXTURE), saneado.message);

    // Ni el mensaje ni ninguna propiedad propia, ni la cadena de causas: el
    // error se reconstruye entero, no se decora.
    const serializado = JSON.stringify({
      mensaje: saneado.message,
      propias: Object.getOwnPropertyNames(saneado).map((p) =>
        String((saneado as unknown as Record<string, unknown>)[p]),
      ),
    });
    assert.ok(!serializado.includes(CLAVE_FIXTURE), serializado);
    assert.equal((saneado as { input?: string }).input, undefined);
    assert.equal(saneado.cause, undefined);
  });

  it("conserva el código del driver para poder diagnosticar", () => {
    const original = Object.assign(new Error("password authentication failed"), {
      code: "28P01",
    });
    const saneado = ErrorBaseDatos.desde(original);

    assert.ok(saneado instanceof ErrorBaseDatos);
    assert.equal(saneado.codigo, "28P01");
  });

  it("un fallo de configuración no se disfraza de fallo de servicio (INT-20)", () => {
    const original = new ErrorConfiguracion("Falta CLAVE_ACCESO.");
    assert.equal(ErrorBaseDatos.desde(original), original);
  });

  it("encuentra el código del driver aunque drizzle lo envuelva", () => {
    // Forma real: `DrizzleQueryError` con la consulta en el mensaje y el
    // `PostgresError` como `cause`. Sin mirar la cadena, un 23505 —la patente
    // ya está adentro, INT-15— quedaba como `desconocido` e indistinguible de
    // una caída de Railway.
    const driver = Object.assign(
      new Error('duplicate key value violates unique constraint "sesion_vehiculo_activa_unica"'),
      { code: "23505" },
    );
    const envoltorio = new Error(
      "Failed query: insert into sesion_vehiculo ... params: FIXT93,2026-08-10",
      { cause: driver },
    );

    const saneado = ErrorBaseDatos.desde(envoltorio);
    assert.ok(saneado instanceof ErrorBaseDatos);
    assert.equal(saneado.codigo, "23505");
  });

  it("no arrastra los parámetros de la consulta: ahí viajan las patentes", () => {
    const driver = Object.assign(new Error("duplicate key value"), { code: "23505" });
    const envoltorio = new Error("Failed query: insert ... params: FIXT93", { cause: driver });

    assert.ok(!ErrorBaseDatos.desde(envoltorio).message.includes("FIXT93"));
  });

  it("no se cuelga con una cadena de causas circular", () => {
    const a = new Error("a") as Error & { cause?: unknown };
    const b = new Error("b", { cause: a });
    a.cause = b;

    const saneado = ErrorBaseDatos.desde(b);
    assert.ok(saneado instanceof ErrorBaseDatos);
  });

  it("una ErrorConfiguracion envuelta sigue siendo de configuración", () => {
    const raiz = new ErrorConfiguracion("Falta SESSION_SECRET.");
    const saneado = ErrorBaseDatos.desde(new Error("Failed query", { cause: raiz }));

    assert.equal(saneado, raiz);
  });

  it("sobrevive a que le tiren algo que no es un Error", () => {
    const saneado = ErrorBaseDatos.desde(CADENA);
    assert.ok(saneado instanceof ErrorBaseDatos);
    assert.equal(saneado.codigo, "desconocido");
    assert.ok(!saneado.message.includes(CLAVE_FIXTURE), saneado.message);
  });
});

describe("ErrorConfiguracion", () => {
  it("redacta también su propio mensaje", () => {
    const e = new ErrorConfiguracion(`DATABASE_URL inválida: ${CADENA}`);
    assert.ok(!e.message.includes(CLAVE_FIXTURE), e.message);
  });
});

describe("describirParaLog", () => {
  it("nunca devuelve la credencial, venga el error de donde venga", () => {
    const casos: unknown[] = [
      Object.assign(new TypeError(`Invalid URL: ${CADENA}`), { input: CADENA }),
      ErrorBaseDatos.desde(new Error(CADENA)),
      new ErrorConfiguracion(CADENA),
      CADENA,
    ];

    for (const caso of casos) {
      const linea = describirParaLog("POST /api/sesiones", caso);
      assert.ok(!linea.includes(CLAVE_FIXTURE), linea);
      assert.ok(linea.startsWith("POST /api/sesiones"), linea);
    }
  });
});
