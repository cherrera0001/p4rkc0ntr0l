/**
 * Lectura defensiva de respuestas HTTP para los verificadores.
 *
 * Por qué existe: el 2026-08-12, `verificar-endurecimiento.mjs` murió con
 * `SyntaxError: Unexpected end of JSON input` al recibir un 500 con cuerpo vacío
 * desde producción. El script abortó a mitad de camino y las 15 comprobaciones
 * siguientes nunca corrieron. El informe decía "10 FAIL"; el número real era 19.
 *
 * La regla que se deriva: **un verificador que se muere oculta justo lo que
 * tenía que exponer**, y lo oculta hacia el lado optimista. Una respuesta
 * ilegible es un FAIL de esa comprobación, nunca el fin de la corrida.
 *
 * `scripts/verificar-verificadores.mjs` comprueba que ningún verificador vuelva
 * a llamar `.json()` directo sobre una respuesta.
 */

/**
 * Lee el cuerpo como JSON sin lanzar. Si no es JSON, devuelve un objeto con el
 * comienzo del texto crudo, para que la comprobación falle *con evidencia* en
 * vez de fallar con un stack trace.
 *
 * @param {Response} r
 * @returns {Promise<Record<string, unknown>>}
 */
export async function leerJson(r) {
  const texto = await r.text().catch(() => "");
  try {
    return JSON.parse(texto);
  } catch {
    return { __cuerpoNoJson: texto.slice(0, 120) };
  }
}
