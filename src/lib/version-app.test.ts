/**
 * Pruebas de la identidad del build (regresión de INT-12 en producción).
 *
 * El caso que hay que fijar es el que ocurrió: en el deploy por CLI las
 * variables de Vercel **existen y están vacías**. Con `??` eso no es un valor
 * ausente, así que la versión terminó siendo `""` y todos los deploys
 * compartieron el caché `estacionamiento-shell-sin-version`.
 *
 * Se prueban las dos propiedades de las que depende la purga —nunca vacía,
 * distinta entre deploys— y no la fuente concreta: qué variable gana es una
 * decisión de trazabilidad, no la corrección.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolverVersionApp,
  sanearVersion,
  VERSION_DEGRADADA,
  versionDelCliente,
} from "./version-app.ts";

/** Lo que la corrección prohíbe que salga por la puerta, en cualquier camino. */
const INSERVIBLES = ["", " ", "v1", "sin-version", "degradado", "undefined", "null"];

describe("sanearVersion", () => {
  it("la cadena vacía no es una versión (el caso que causó la regresión)", () => {
    assert.equal(sanearVersion(""), null);
    assert.equal(sanearVersion("   "), null);
    assert.equal(sanearVersion(undefined), null);
    assert.equal(sanearVersion(null), null);
  });

  it("rechaza los valores que parecen versión y no lo son", () => {
    for (const valor of ["v1", "V1", "sin-version", "degradado", "undefined", "null"]) {
      assert.equal(sanearVersion(valor), null, valor);
    }
  });

  it("deja pasar un sha o un id de deploy, y los deja usables como nombre", () => {
    assert.equal(sanearVersion("a1b2c3d4e5f6"), "a1b2c3d4e5f6");
    assert.equal(sanearVersion("dpl_9xKq2"), "dpl_9xKq2");
    assert.equal(sanearVersion("proyecto-abc.vercel.app"), "proyecto-abc.vercel.app");
    // Lo que no sirve en un nombre de caché sí se reemplaza.
    assert.equal(sanearVersion("rama/feature 1"), "rama-feature-1");
    // Un BOM al borde ya rompió un deploy en este repo (ver `env.ts`).
    assert.equal(sanearVersion(`${String.fromCharCode(0xfeff)}a1b2c3`), "a1b2c3");
  });

  it("lo que devuelve nunca deja un nombre de caché ambiguo", () => {
    for (const crudo of ["   ", "---", "@@@", "..", "\t\n"]) {
      const version = sanearVersion(crudo);
      assert.equal(version, null, JSON.stringify(crudo));
    }
    assert.equal(sanearVersion("x".repeat(200))?.length, 40);
  });
});

describe("resolverVersionApp", () => {
  it("con las variables de Vercel VACÍAS igual devuelve una versión (la regresión)", () => {
    const version = resolverVersionApp({
      VERCEL_GIT_COMMIT_SHA: "",
      VERCEL_DEPLOYMENT_ID: "",
      VERCEL_URL: "",
    });

    assert.ok(!INSERVIBLES.includes(version), version);
    assert.equal(sanearVersion(version), version);
  });

  it("sin ninguna variable tampoco queda vacía", () => {
    const version = resolverVersionApp({});
    assert.ok(!INSERVIBLES.includes(version), version);
    assert.equal(sanearVersion(version), version);
  });

  it("dos deploys distintos dan versiones distintas: de eso depende la purga", () => {
    // Por commit.
    assert.notEqual(
      resolverVersionApp({ VERCEL_GIT_COMMIT_SHA: "aaaaaaaaaaaa1" }),
      resolverVersionApp({ VERCEL_GIT_COMMIT_SHA: "bbbbbbbbbbbb1" }),
    );

    // Por id de deploy, que es el caso del deploy por CLI sin repo conectado.
    assert.notEqual(
      resolverVersionApp({ VERCEL_GIT_COMMIT_SHA: "", VERCEL_DEPLOYMENT_ID: "dpl_uno" }),
      resolverVersionApp({ VERCEL_GIT_COMMIT_SHA: "", VERCEL_DEPLOYMENT_ID: "dpl_dos" }),
    );

    // Y sin nada de Vercel, por el instante del build: la garantía no depende
    // de que el proveedor exponga ninguna variable.
    assert.notEqual(resolverVersionApp({}, 1_000_000), resolverVersionApp({}, 2_000_000));
  });

  it("un mismo build resuelve siempre lo mismo: el nombre no puede bailar", () => {
    const entorno = { VERCEL_GIT_COMMIT_SHA: "", VERCEL_DEPLOYMENT_ID: "dpl_estable" };
    assert.equal(resolverVersionApp(entorno, 1), resolverVersionApp(entorno, 2));
  });

  it("prefiere el commit, y cae al id del deploy cuando el commit no vino", () => {
    assert.equal(
      resolverVersionApp({ VERCEL_GIT_COMMIT_SHA: "abcdef0123456789", VERCEL_DEPLOYMENT_ID: "dpl_x" }),
      "abcdef012345",
    );
    assert.equal(
      resolverVersionApp({ VERCEL_GIT_COMMIT_SHA: "  ", VERCEL_DEPLOYMENT_ID: "dpl_x" }),
      "dpl_x",
    );
  });
});

describe("versionDelCliente", () => {
  it("usa la versión inlineada cuando sirve", () => {
    assert.equal(versionDelCliente("a1b2c3d4e5f6"), "a1b2c3d4e5f6");
  });

  it("una versión vacía no se registra como si fuera válida", () => {
    // Es el caso exacto de producción: el bundle traía "" y el cliente pedía
    // `/sw.js?v=`. Ahora sale una marca que el verificador rechaza.
    for (const inservible of INSERVIBLES) {
      assert.equal(versionDelCliente(inservible), VERSION_DEGRADADA, JSON.stringify(inservible));
    }
    assert.equal(versionDelCliente(undefined), VERSION_DEGRADADA);
  });

  it("nunca devuelve vacío: sin worker no hay offline, y offline no es opcional", () => {
    for (const entrada of [...INSERVIBLES, undefined, null, "abc"]) {
      assert.ok(versionDelCliente(entrada).length > 0);
    }
  });
});
