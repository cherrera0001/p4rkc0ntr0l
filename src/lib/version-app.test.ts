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
  huellaCorta,
  resolverVersionApp,
  sanearVersion,
  VAR_MEMO_VERSION,
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

  it("MISMO commit y deploys distintos: versiones distintas (el bypass del veto)", () => {
    // Es el caso que el primer intento no cubría y por el que fue vetado: la
    // versión salía del SHA, y un *Redeploy* del mismo commit —cambiar una
    // variable de entorno y re-buildear— publicaba artefacto nuevo con nombre
    // de caché viejo. `activate` no purgaba nada. INT-12 de vuelta.
    const commit = "ad63b7e12345";
    const versiones = ["dpl_uno111111", "dpl_dos222222", "dpl_tres33333"].map((id) =>
      resolverVersionApp({ VERCEL_GIT_COMMIT_SHA: commit, VERCEL_DEPLOYMENT_ID: id }),
    );

    assert.equal(new Set(versiones).size, 3, versiones.join(" | "));
    // Y el commit sigue siendo legible en las tres: trazabilidad sin unicidad.
    for (const version of versiones) assert.ok(version.startsWith("ad63b7e-"), version);
  });

  it("mismo commit y URL de deploy distinta: también distintas", () => {
    const comun = { VERCEL_GIT_COMMIT_SHA: "ad63b7e12345" };
    assert.notEqual(
      resolverVersionApp({ ...comun, VERCEL_URL: "p4rk-aaa111-scope.vercel.app" }),
      resolverVersionApp({ ...comun, VERCEL_URL: "p4rk-bbb222-scope.vercel.app" }),
    );
  });

  it("el commit no alcanza para dar identidad: sin nada más, manda el reloj", () => {
    const soloCommit = { VERCEL_GIT_COMMIT_SHA: "ad63b7e12345" };
    assert.notEqual(
      resolverVersionApp(soloCommit, 1_000_000),
      resolverVersionApp(soloCommit, 2_000_000),
    );
  });

  it("sin nada de Vercel, por el instante del build", () => {
    assert.notEqual(resolverVersionApp({}, 1_000_000), resolverVersionApp({}, 2_000_000));
  });

  it("un mismo deploy resuelve siempre lo mismo: el nombre no puede bailar", () => {
    const entorno = { VERCEL_GIT_COMMIT_SHA: "ad63b7e12345", VERCEL_DEPLOYMENT_ID: "dpl_estable" };
    // Reloj distinto en cada evaluación: si el resultado dependiera de él, el
    // manifiesto de servidor y el chunk del cliente quedarían con versiones
    // distintas del mismo build, que es lo que se midió y se corrigió.
    assert.equal(resolverVersionApp(entorno, 1), resolverVersionApp(entorno, 2));
  });

  it("la versión compuesta entra en un nombre de caché", () => {
    const version = resolverVersionApp({
      VERCEL_GIT_COMMIT_SHA: "ad63b7e1234567890abcdef",
      VERCEL_DEPLOYMENT_ID: "dpl_9xKq2mZaBcDeFgHiJkLmNoPq",
    });
    assert.ok(version.length <= 40, `${version} (${version.length})`);
    assert.equal(sanearVersion(version), version);
  });

  it("usa la traza del commit cuando la hay, y se arregla sin ella", () => {
    assert.ok(
      resolverVersionApp({
        VERCEL_GIT_COMMIT_SHA: "abcdef0123456789",
        VERCEL_DEPLOYMENT_ID: "dpl_x1y2z3",
      }).startsWith("abcdef0-"),
    );
    assert.equal(
      resolverVersionApp({ VERCEL_GIT_COMMIT_SHA: "  ", VERCEL_DEPLOYMENT_ID: "dpl_x1y2z3" }),
      "x1y2z3",
    );
  });
});

describe("identidad larga: comprimir sin recortar antes", () => {
  it("dos URLs de deploy que comparten los primeros 40 caracteres no colisionan", () => {
    // El corte a 40 caracteres se come justo la parte que distingue un deploy de
    // otro cuando el scope tiene nombre largo. Si se saneara antes de comprimir,
    // estas dos darían la misma versión y el caché no se renombraría nunca.
    const prefijo = "p4rkc0ntr0l-git-main-cherrera0001s-projects";
    assert.notEqual(
      resolverVersionApp({ VERCEL_URL: `${prefijo}-aaa111.vercel.app` }),
      resolverVersionApp({ VERCEL_URL: `${prefijo}-bbb222.vercel.app` }),
    );
  });

  it("dos identificadores de deploy largos con prefijo común tampoco colisionan", () => {
    const prefijo = "dpl_".padEnd(44, "Z");
    assert.notEqual(
      resolverVersionApp({ VERCEL_DEPLOYMENT_ID: `${prefijo}aaa111` }),
      resolverVersionApp({ VERCEL_DEPLOYMENT_ID: `${prefijo}bbb222` }),
    );
  });

  it("y el resultado sigue entrando en un nombre de caché", () => {
    const version = resolverVersionApp({
      VERCEL_GIT_COMMIT_SHA: "ad63b7e1234567890",
      VERCEL_URL: `${"x".repeat(120)}.vercel.app`,
    });
    assert.ok(version.length <= 40, `${version} (${version.length})`);
    assert.equal(sanearVersion(version), version);
  });
});

describe("memoria de la versión entre evaluaciones", () => {
  it("sin identidad de deploy, la memoria evita que el build se renombre a mitad", () => {
    // Es el caso real: `next.config.ts` se evalúa varias veces y la rama del
    // reloj daría una versión distinta en cada evaluación.
    const entorno = { [VAR_MEMO_VERSION]: "build-abc123" };
    assert.equal(resolverVersionApp(entorno, 1), "build-abc123");
    assert.equal(resolverVersionApp(entorno, 999_999), "build-abc123");
  });

  it("CON identidad de deploy la memoria se ignora: no se puede fijar desde afuera", () => {
    // El agujero: `NEXT_PRIVATE_VERSION_APP` es una variable de entorno, y una
    // variable de entorno la escribe cualquiera. Fijada como variable de
    // proyecto, congelaría el nombre del caché en todos los deploys —bien
    // formada, así que `sanearVersion` no la rechaza—. En un deploy real siempre
    // hay identidad, y esa rama no mira la memoria.
    const fijada = "version-fijada-a-mano";
    for (const identidad of [
      { VERCEL_DEPLOYMENT_ID: "dpl_abc123" },
      { VERCEL_URL: "p4rk-abc123-scope.vercel.app" },
    ]) {
      const version = resolverVersionApp({ [VAR_MEMO_VERSION]: fijada, ...identidad }, 1);
      assert.notEqual(version, fijada, JSON.stringify(identidad));
    }
  });

  it("dos deploys con la misma memoria inyectada siguen dando versiones distintas", () => {
    const fijada = "version-fijada-a-mano";
    assert.notEqual(
      resolverVersionApp({ [VAR_MEMO_VERSION]: fijada, VERCEL_DEPLOYMENT_ID: "dpl_uno111" }),
      resolverVersionApp({ [VAR_MEMO_VERSION]: fijada, VERCEL_DEPLOYMENT_ID: "dpl_dos222" }),
    );
  });

  it("una memoria inservible no se hereda: se resuelve de nuevo", () => {
    for (const basura of INSERVIBLES) {
      const version = resolverVersionApp({ [VAR_MEMO_VERSION]: basura }, 1);
      assert.ok(version.startsWith("build-"), `${JSON.stringify(basura)} → ${version}`);
    }
  });
});

describe("huellaCorta", () => {
  it("es determinista y distingue entradas parecidas", () => {
    assert.equal(huellaCorta("p4rk-aaa111.vercel.app"), huellaCorta("p4rk-aaa111.vercel.app"));
    assert.notEqual(huellaCorta("p4rk-aaa111.vercel.app"), huellaCorta("p4rk-aaa112.vercel.app"));
  });

  it("cabe en un nombre de caché y sobrevive al saneo", () => {
    const huella = huellaCorta("x".repeat(5000));
    assert.ok(huella.length <= 8, huella);
    assert.equal(sanearVersion(huella), huella);
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
