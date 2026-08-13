/**
 * Identidad del build: de dónde sale la versión que nombra los cachés del
 * service worker (hallazgo INT-12, y su regresión en producción del 2026-08-12).
 *
 * **Qué pasó.** INT-12 se corrigió sacando el literal `"v1"` del nombre del
 * caché y poniendo en su lugar el commit desplegado:
 *
 *     process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? `local-...`
 *
 * En local daba `local-<algo>` y el hallazgo se dio por cerrado. En producción
 * volvió intacto: el deploy corría por CLI de Vercel sin repo conectado, así que
 * `VERCEL_GIT_COMMIT_SHA` llegaba como **cadena vacía**, no como `undefined`.
 * `""` no es nullish: `?.slice()` devuelve `""`, `??` no dispara, y la versión
 * quedó vacía. Todos los deploys pasaron a compartir el caché
 * `estacionamiento-shell-sin-version`, que es exactamente el defecto que INT-12
 * había corregido: `activate` no tiene nada que purgar y el shell viejo —con su
 * bundle, anterior a la barrera de datos reales de A-3— queda vigente para
 * siempre en un dispositivo sin red (INT-3).
 *
 * Es el mismo error que ya motivó `leerEnv()` en `env.ts`: un valor de entorno
 * presente-pero-vacío no es un valor ausente para `??`, y sí lo es para todo lo
 * demás. Acá se resuelve por validación explícita, no por operador.
 *
 * **La propiedad que hay que sostener** no es "la versión sale del commit", es:
 *
 *   1. nunca vacía ni degenerada, en cualquier entorno; y
 *   2. distinta entre deploys distintos: de eso, y solo de eso, depende que
 *      `activate` tenga algo que purgar.
 *
 * **Y el commit no cumple (2).** La primera corrección devolvía el primer
 * candidato disponible y ese candidato era el SHA. Dos deploys del mismo commit
 * —lo que hace un *Redeploy*, que es la forma normal de re-buildear tras cambiar
 * una variable de entorno: encender `OPERACION_REAL_HABILITADA`, rotar un
 * secreto— publican artefactos distintos con versión idéntica. Mismo nombre de
 * caché, misma URL de `/sw.js`, ningún worker nuevo, `activate` que no corre:
 * INT-12 textual, con mejor cara. Con el repo ya conectado a GitHub
 * (`origin p4rkc0ntr0l`) ese candidato deja de ser el excepcional y pasa a ser
 * el habitual.
 *
 * Por eso la versión **se compone** en vez de elegirse:
 *
 *     <sha corto>-<algo único por deploy>
 *
 * El SHA es solo trazabilidad —mirar un caché y saber qué commit lo escribió— y
 * nunca aporta unicidad. La unicidad la aporta el identificador del deploy y, si
 * no lo hay, el instante del build; ninguno de los dos se repite entre deploys.
 * La garantía no depende de que Vercel exponga ninguna variable.
 *
 * Sin dependencias a propósito: lo importan `next.config.ts` (build),
 * `registrar-sw.tsx` (cliente) y el verificador. `public/sw.js` no puede
 * importarlo —es un script clásico servido estático— y repite `sanearVersion`
 * en cinco líneas; el verificador comprueba que las dos copias coincidan en lo
 * observable.
 */

/** Lo que puede viajar en una query y en un nombre de caché sin sorpresas. */
const NO_ADMITIDO = /[^A-Za-z0-9._-]+/g;

/** Un nombre de caché no gana nada por ser largo. */
const LARGO_MAXIMO = 40;

/**
 * Valores que parecen una versión y no lo son. Cada uno ya ocurrió o está a un
 * error de distancia: `v1` era el literal original de INT-12; `sin-version` fue
 * el resultado de la regresión; `degradado` es la marca de esta corrección;
 * `undefined` y `null` son el clásico de interpolar una variable ausente.
 */
const DEGENERADAS = new Set(["v1", "sin-version", "degradado", "undefined", "null"]);

/** Marca explícita de "no hay versión de build". Nunca es una versión válida. */
export const VERSION_DEGRADADA = "degradado";

/**
 * Devuelve una versión utilizable, o `null` si el valor no sirve como tal.
 *
 * Trata vacío, en blanco y degenerado como lo mismo: **no hay versión**. Que
 * devuelva `null` y no una cadena es deliberado: obliga a quien llama a decidir
 * qué hace sin versión, en vez de heredar un `""` que se ve como un valor.
 */
export function sanearVersion(valor: string | null | undefined): string | null {
  if (typeof valor !== "string") return null;

  const limpio = valor
    .trim()
    .replace(NO_ADMITIDO, "-")
    .slice(0, LARGO_MAXIMO)
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "");

  if (limpio.length === 0) return null;
  return DEGENERADAS.has(limpio.toLowerCase()) ? null : limpio;
}

/**
 * Versión del build, resuelta en `next.config.ts`.
 *
 * Recibe el entorno como argumento —en vez de leer `process.env` adentro— para
 * que el caso que causó la regresión, variables presentes y vacías, se pueda
 * probar sin ensuciar el proceso.
 *
 * Orden: commit desplegado (lo más informativo), identificador del deploy
 * (existe también en los deploys por CLI, que es donde falló esto), URL del
 * deploy, y como último recurso el instante del build. Ese último recurso es el
 * que hace que la garantía no dependa de Vercel.
 */
export function resolverVersionApp(
  entorno: Record<string, string | undefined>,
  ahora: number = Date.now(),
): string {
  const candidatos = [
    entorno.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 12),
    entorno.VERCEL_DEPLOYMENT_ID,
    entorno.VERCEL_URL,
  ];

  for (const candidato of candidatos) {
    const version = sanearVersion(candidato);
    if (version) return version;
  }

  return `build-${ahora.toString(36)}`;
}

/**
 * Versión con la que el cliente registra el worker.
 *
 * Nunca devuelve vacío. Si la versión inlineada no sirve, devuelve
 * `VERSION_DEGRADADA`: una marca reconocible, que el verificador rechaza y que
 * nadie puede confundir con una versión legítima —a diferencia de
 * `"sin-version"`, que pasó por buena durante dos días.
 *
 * **Por qué no hay una segunda fuente acá.** Se probó derivarla de los chunks
 * del documento. No sirve: con Turbopack los chunks de este build se llaman
 * `08ttfj81-47mu.js`, sin los nombres estables (`main-app`, `webpack`) que ese
 * enfoque necesita, y el CSS del layout —que sí está en toda pantalla— no
 * cambia cuando cambia solo el JS. Habría quedado un mecanismo que se ve bien y
 * no dispara nunca, que es exactamente la forma del defecto que estamos
 * corrigiendo. La segunda barrera está donde sí puede fallar ruidosamente: el
 * build no termina si no puede identificarse (`next.config.ts`).
 *
 * Tampoco se inventa un valor por carga: borraría el shell en cada apertura y
 * dejaría al operador sin copia local justo cuando no hay red.
 */
export function versionDelCliente(inlineada: string | null | undefined): string {
  return sanearVersion(inlineada) ?? VERSION_DEGRADADA;
}
