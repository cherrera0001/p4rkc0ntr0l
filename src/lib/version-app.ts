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
 * en cinco líneas. Esa copia no se sostiene con buena voluntad:
 * `scripts/verificar-int12.mjs` extrae la función del worker, la ejecuta contra
 * esta y compara las dos salidas sobre un corpus de entradas. Si divergen, falla.
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
 * Hash corto y determinista (FNV-1a de 32 bits, en base 36).
 *
 * Sirve para meter un valor largo —una URL de deploy, la lista de assets de un
 * build— en algo que quepa en un nombre de caché sin recortarlo por la mitad,
 * que es como se pierden justo los caracteres que distinguen un deploy de otro.
 */
export function huellaCorta(texto: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Variable donde el build memoriza la versión ya resuelta.
 *
 * `next.config.ts` se evalúa **más de una vez por build** —se midió: el manifiesto
 * de servidor quedó con `build-msqzwpfk` y el chunk del cliente del mismo build
 * con `build-msqzwpva`, 566 ms después—. Con el reloj como último recurso, cada
 * evaluación inventaba su propia versión, así que "el instante del build" era en
 * realidad "el instante de la evaluación que te toque leer". Memorizada en el
 * entorno, las evaluaciones siguientes del mismo proceso y los procesos hijos
 * del build heredan el valor.
 *
 * No lleva prefijo `NEXT_PUBLIC_`: no tiene por qué viajar al cliente, y así no
 * se confunde con la variable que sí se inlinea.
 *
 * **Y no puede usarse para fijar la versión desde afuera.** Una variable de
 * entorno la puede escribir cualquiera —copiada de un log de build, puesta como
 * variable de proyecto, arrastrada en un `.env`—, y una versión fijada e igual
 * en todos los deploys es INT-12 otra vez, con un valor bien formado que
 * `sanearVersion` no tiene por qué rechazar. Por eso `resolverVersionApp` solo
 * la lee cuando **no** hay identidad de deploy, que es la única rama que sin
 * memo sería no determinista. Donde el valor podría hacer daño —un deploy real,
 * que siempre trae identidad— ni se mira.
 */
export const VAR_MEMO_VERSION = "NEXT_PRIVATE_VERSION_APP";

/**
 * Identidad del deploy: lo que cambia entre un deploy y otro, aunque el commit
 * sea el mismo.
 *
 * **Se sanea al final, nunca al principio.** `sanearVersion` recorta a 40
 * caracteres, así que sanear primero y comprimir después significa comprimir un
 * valor al que ya le cortaron la cola —justo donde vive lo que distingue un
 * deploy de otro—. Con un scope de nombre largo, `p4rk-<hash>-<scope>.vercel.app`
 * pasa de 40 caracteres y dos deploys distintos comparten prefijo: mismo
 * `unico`, mismo nombre de caché, INT-12 de vuelta y en silencio. Por eso se
 * toma la cola cruda del identificador, o el hash de la URL cruda, y recién
 * entonces se sanea.
 */
function identidadDeDeploy(entorno: Record<string, string | undefined>): string | null {
  const id = entorno.VERCEL_DEPLOYMENT_ID?.trim().replace(/^dpl[_-]/i, "");
  if (id) return sanearVersion(id.slice(-12));

  const url = entorno.VERCEL_URL?.trim();
  if (url) return sanearVersion(huellaCorta(url));

  return null;
}

/**
 * Versión del build, resuelta en `next.config.ts`.
 *
 * Recibe el entorno como argumento —en vez de leer `process.env` adentro— para
 * que los casos que ya fallaron, variables presentes y vacías, se puedan probar
 * sin ensuciar el proceso.
 *
 * Se compone de dos partes con roles distintos, y esa separación es la
 * corrección: **la trazabilidad nunca decide la unicidad**.
 *
 *  - `unico`: identificador del deploy, o el hash de su URL, o el instante del
 *    build. Cualquiera de los tres cambia entre deploys distintos, incluso si el
 *    commit es el mismo. Ninguno se repite en un *Redeploy*.
 *  - `traza`: los primeros 7 caracteres del commit, para poder mirar
 *    `estacionamiento-shell-ad63b7e-9xKq2mZ` y saber qué código hay adentro. Es
 *    decoración: si falta, la versión sigue siendo correcta; si está, no aporta
 *    unicidad y no puede volver a apropiársela.
 */
export function resolverVersionApp(
  entorno: Record<string, string | undefined>,
  ahora: number = Date.now(),
): string {
  const identidad = identidadDeDeploy(entorno);

  // El memo se consulta SOLO cuando no hay identidad de deploy, que es el único
  // caso en que la resolución no es determinista (cae al reloj). Con identidad,
  // todas las evaluaciones del build ya coinciden por construcción y el memo no
  // hace falta: se ignora, y con él se ignora cualquier valor que alguien haya
  // puesto en el entorno. Un `NEXT_PRIVATE_VERSION_APP` metido como variable de
  // proyecto en Vercel no puede congelar el nombre del caché, porque en Vercel
  // siempre hay `VERCEL_DEPLOYMENT_ID` o `VERCEL_URL` y esa rama gana.
  if (!identidad) {
    const memorizada = sanearVersion(entorno[VAR_MEMO_VERSION]);
    if (memorizada) return memorizada;
  }

  const unico = identidad ?? `build-${ahora.toString(36)}`;
  const traza = sanearVersion(entorno.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 7));

  return sanearVersion(traza ? `${traza}-${unico}` : unico) ?? unico;
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
