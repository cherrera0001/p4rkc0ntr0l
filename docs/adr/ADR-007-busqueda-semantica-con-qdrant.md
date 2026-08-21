# ADR-007 — Búsqueda semántica con Qdrant

**Estado:** **ADJUDICADO por decisión humana el 2026-08-20 — se adopta.
BLOQUEADO en su ejecución por una pregunta abierta: qué se indexa.**

**Relacionados:** ADR-002 (stack) · ADR-003 (base en Railway) · ADR-006 (consola
de datos) · INT-7 (retención de patente, sin cerrar) ·
`docs/guia-2026-08-20-traduccion.md` §4.

---

## 1. La decisión

Se adopta Qdrant como motor de búsqueda semántica, con **Vercel conservado** para
Next.js. Viene de la guía traducida, donde la búsqueda del *journal* recupera
desde Qdrant los mismos posts que Directus publica.

Qdrant es un **servicio con estado en disco**: no corre en una función de Vercel.
Va donde ya vive la base —Railway— o en un Qdrant gestionado. Eso lleva el
despliegue de **un servicio a tres** (Next en Vercel, Directus y Qdrant fuera),
profundizando el costo que ADR-003 ya había asumido al romper «un proveedor, una
factura».

---

## 2. La restricción que decide todo lo demás

> **La patente es dato personal** (`CLAUDE.md` §4, Ley 21.719, vigencia plena el
> 1 de diciembre de 2026).

Indexar sesiones en Qdrant **replica dato personal en un segundo almacén, con su
propia retención**, mientras `{{PLAZO_RETENCION_PATENTE}}` y `{{BASE_LICITUD}}`
siguen sin resolver — INT-7 es el único hallazgo del informe integral que sigue
abierto.

**Regla, sin excepción por conveniencia:**

- **Qdrant no indexa `sesion_vehiculo`, ni `patente`, ni nada derivado.**
- **Un *embedding* no es anonimización.** Es una representación del texto de
  origen, y tratarlo como dato anónimo sería exactamente la clase de supuesto que
  `CLAUDE.md` §3 prohíbe.

Esto no es una restricción que Qdrant imponga: es que la guía de origen indexa
contenido editorial público, y este producto no tiene ninguno.

---

## 3. La pregunta que bloquea la ejecución

> **Si el índice no puede contener sesiones ni patentes, ¿qué contiene?**

Hoy, en este repo, la respuesta honesta es **nada**: no hay corpus. Candidatos
lícitos, **todos por decidir y ninguno existente**:

| Candidato | ¿Personal? | ¿Existe hoy? |
|---|---|---|
| Documentación de ayuda para el operador | no | **no.** Hay que escribirla |
| Texto de políticas y condiciones de tarifa | no | parcial: hay tarifas, no texto |
| `spec.md` / `LEDGER.md` como búsqueda interna | no | sí, pero **no es producto** |

**Adoptar Qdrant antes de tener corpus es desplegar infraestructura vacía.** No
contradice la decisión tomada: fija su secuencia. Primero el corpus, después el
índice.

---

## 4. Lo que se adopta desde ya, porque no depende del corpus

Dos ideas de la guía son **disciplina de verificación**, no stack, y se adoptan
tal cual cuando se implemente:

| Idea | Por qué encaja en este repo |
|---|---|
| *Seam* de embeddings con proveedor `local` determinista por defecto | el sistema corre **sin ninguna clave de API**. Mismo criterio que los fixtures que se ven como fixtures |
| Firma del proveedor guardada junto al índice, y **409 explícito** si índice y consulta no coinciden | *falla ruidosamente en vez de devolver vacío en silencio* — la misma regla que obligó a reescribir AC-SCOPE-1 y a retirar los `grep` con el pipe escapado. **Un criterio que siempre pasa es peor que no tener criterio** |

---

## 5. Criterios que esta adopción exige

Enunciados, **no implementados**, y ninguno se declara verificado:

| AC | Afirmación | Tipo |
|---|---|---|
| `AC-VECTOR-1` | ningún punto del índice contiene una patente ni un campo derivado de `sesion_vehiculo` | universal |
| `AC-VECTOR-2` | si la firma del proveedor de *embeddings* no coincide con la del índice, la búsqueda responde **409**, nunca vacío | existencial |

Ambos deben probarse **con el fallo plantado** antes de contar (`METAS.md` §7).

---

## 6. Condición de reversión

Si el corpus lícito nunca se define, **este ADR se revierte sin costo**: no hay
código que sacar, porque la secuencia impide escribirlo antes. Ése es el motivo
de ordenarla así y no al revés.
