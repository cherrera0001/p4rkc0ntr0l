# STATE.md — cursor de reanudación

> Archivo **sobrescribible**, corto por diseño. Puntero O(1) para retomar sin
> releer `LEDGER.md` entero. El ledger es append-only y la verdad histórica:
> ante discrepancia, manda el ledger.

**Actualizado:** 2026-08-15

**URL viva: https://estacionamiento-three.vercel.app** — responde 200.

| | |
|---|---|
| **Último hito cerrado** | M5 — Endurecimiento (código y deploy) |
| **Hito en curso** | M6 · **FASE C** de la estrategia nueva (B cerrada) |
| **Bloqueo activo** | ninguno. El gate de evidencia quedó **FAIL, riesgo aceptado** (2026-08-14) |
| **INT-12** | riesgo aceptado por decisión humana (2026-08-14). Ya no detiene el hito |
| **Próximo paso** | **Llenar el banco de H1 tecleando en la app.** El instrumento existe y falla por falta de datos, que es lo que tiene que hacer |
| **FASE D** | **construida** (2026-08-16). `npm run verificar:h1` publica la mediana con su `n`, separa tres poblaciones y **falla con el banco vacío** |
| **El bloque de §0 ya NO está todo en verde** | `verificar:h1` sale **FAIL** a propósito. **No lo “arregles”**: mientras el banco esté vacío, ese FAIL *es* la medición |
| **Rama paralela de documentación** | T01 · **los cinco entregables cerrados** el 2026-08-15. ADR-005 queda **PROPUESTO**: adjudicarlo es decisión humana |
| **HALLAZGO ABIERTO · alcance** | **el gate no cubre `tenant` ni `plataforma`.** Reproducido: 9/9 PASS con los dos plantados. Ver abajo |
| **Harness (unificación de agentes)** | **FAIL, BoundedLoop agotado** (2026-08-16). Funciona y **no se declara verificado** — igual que INT-12. Reabrirlo es decisión humana |
| **spec-driven · huérfano declarado + tipo de AC** | cerrado en código el 2026-08-16, **SIN AUDITAR**. `verificar:ac` pasó de 5 a 9 comprobaciones |

## FASE D (2026-08-16) — «SIN DATOS» dejó de ser una frase y pasó a ser un FAIL

`npm run verificar:h1`. Hasta hoy *«H1 nunca se midió»* vivía en documentos; ahora
es un comando que falla. `AC-MEAS-1` **no podía** fallar por ausencia de datos —un
`count(*)` sobre un `WHERE` es vacuamente verdadero sobre el conjunto vacío—.
`AC-H1-1` es **existencial**: su salida es un número.

**Tres poblaciones que nunca se mezclan:** real (`NOT LIKE 'FIXT%'`, la única que
vale), banco (`LIKE 'FIXTB%'`), y efímero (el resto de `FIXT%`, que es **tecleo de
robot**). En su primera corrida el instrumento encontró 4 efímeras con mediana
**1,53 s** — un número plausible, reproducible y basura. Publicarlo habría sido el
`6,2 s` inventado otra vez.

**El banco sobrevive a la limpieza, y solo el cerrado.** `FIXTB…` sigue siendo
fixture para la barrera de A-3, así que `AC-PDP-1` no se tocó: cero migraciones,
cero campos. Una fila de banco **activa** se barre como cualquier fixture — dejarla
viva rompía `verificar:op1` (8/11) y `verificar:meas2` la cerraba clickeando a
ciegas, contaminando la muestra.

**Para vaciar el banco a propósito:** `npm run limpiar:fixtures -- --banco`.

**Lo que el instrumento NO puede saber, y por eso no lo afirma:** la procedencia.
Un `INSERT` con duraciones a mano entra al banco y da PASS. Está declarado en su
salida en vez de fingir una garantía.

**Cambio de semántica que conviene mirar:** `verificar-meas2.mjs` comparaba el
panel contra **la tabla entera**; ahora usa los filtros del panel. Sostengo que
recién ahora verifica lo que AC-MEAS-2 dice. Detalle en `LEDGER.md` (2026-08-16).

**Defectos del repo corregidos de paso:** `limpiar:fixtures` no tenía
`--env-file=.env` (nunca funcionó por su puerta documentada); y
`scripts/verificar-ac.mjs:95` filtraba `AC-[A-Z]+-\w+`, así que **`AC-H1-1`
desaparecía en silencio** — §9 declaraba 14 criterios y el guard contaba 13.

## Rama de documentación T01 (2026-08-15) — no toca código

**Ojo con el árbol: esta rama NO es `main`.** Es
`agents/medir-documentacion-historias-casos-uso` (`2c396c4`), que tiene a `main`
(`2c9e286`) por ancestro. `docs/data/actores.md` y `docs/data/historias-usuario.md`
**no existen en `main`**. Integrar la rama o dejarla paralela es decisión humana
pendiente.

`docs/data/actores.md` y `docs/data/historias-usuario.md` escritos. Ítem 2 del
Trabajo 01 pasa de **0/80 a 80/80** estimado; total **13/100 → 93/100**.

**Entregable 3 cerrado (I1, 2026-08-15).** `docs/data/casos-uso.md` reescrito:
nueve flujos numerados —ocho casos más el flujo de excepción **E1**, que es el ex
CU-08—, 55 pasos todos citados, traza CU ↔ historia en las dos direcciones y
**cinco huecos de traza declarados sin rellenar**. El más caro es **CU-10 (medir
H1): no le falta pantalla, le falta el actor.** Tres ciclos de auditoría, ocho
hallazgos; el ciclo 3 dio PASA. **Ítem 3 sigue en 3/10**: I1 no lo toca.

**Entregable 4 cerrado (I2, 2026-08-15).** `docs/data/seleccion-prototipo.md`:
se seleccionan **H-01, H-03 y H-05** contra tres ejes, ancladas a `spec.md` §1,
con las siete descartadas puntuadas. **Ítem 3 sube de 3/10 a 10/10 estimado; total
93/100 → 100/100 estimado** — estimación propia, no nota del evaluador.

**El hallazgo que produjo hacer la selección: el prototipo está completo como
producto y vacío como instrumento.** Siete de las diez historias están
construidas; la hipótesis que las justifica nunca se midió. Bajo la regla 1 del
propio documento, lo que sigue no es una historia de la lista: es el instrumento
que le falta a H-01, y **CU-10 no tiene actor**.

**Lección del ciclo, con nombre: U7.** *Toda afirmación sobre el repositorio es
verificable con un comando* — y su forma operativa, que es la que costó dos
ciclos: **no alcanza con medir antes de escribir; hay que buscar todas las
ocurrencias de lo que se acaba de refutar.** Un `grep` del claim, no del dato.
Dos veces un fix corrigió una mitad y dejó viva la otra.

**Y su corolario, que costó un veto en I2:** una transcripción con prompt `$` que
no se corrió es peor que no ponerla. El documento publicaba `21/21` como *«medido
hoy»* siendo un número de la iteración anterior — dentro de la sección que
declara que un PASS viejo no es una medición de hoy. El real era 23/23.

**Entregable 5 cerrado (I3, 2026-08-15).**
`docs/adr/ADR-005-modelo-de-tenant-y-panel-de-administracion.md` y
`docs/SPEC-005-panel-de-administracion.md`, los dos en **PROPUESTO**. Ponen sobre
la mesa la pregunta que ADR-004 nunca adjudicó —**multicliente** (N clientes, un
recinto cada uno) ≠ **multisitio** (un cliente, varios recintos)— con cuatro
alternativas, cada una con condición de reactivación falsable, consecuencias
negativas y verificación por estructura. **Se recomienda la alternativa 2 y NO se
adjudica.**

## HALLAZGO ABIERTO · el gate de alcance no cubre `tenant` ni `plataforma`

**Encontrado auditando I3, reproducido, y NO corregido.** `verificar-alcance.mjs`
no menciona `plataforma` ni una vez, y `tenant` no está en su lista de entidades
prohibidas (`scripts/verificar-alcance.mjs:91`). Con el rol, la entidad y una
pantalla de aprovisionamiento plantados en una copia aislada, el gate da
**`9/9 comprobaciones PASS · ALCANCE: PASS · exit=0`**.

**Un cambio que introduzca multisitio pasa el gate y puede reportar AC-SCOPE en
verde.** Es la familia de INT-12 y del gate de evidencia: la propiedad se
sostiene —en el árbol real no hay `tenant`—, el mecanismo que la vigila no.

**Corregirlo no es agregar `tenant` a una lista** —eso repite el defecto de la
enumeración—: es extender el gate **por exclusión**, como ya se hizo con las
pasarelas, y probarlo con el fallo plantado. Detalle y reproducible en
`LEDGER.md` (2026-08-15).

**Tres hallazgos que sobreviven a esta sesión y valen para el producto:**

1. **No hay `tenant` en el repo** — ni entidad, ni columna, ni rol `plataforma`
   (`src/db/schema.ts:31`, `src/lib/contexto.ts:16`). Lo que existe es aislamiento
   por `estacionamiento_id`.
2. **Ese aislamiento no tiene un solo control negativo.** Ningún verificador
   siembra un segundo estacionamiento: la separación se cumple por construcción
   **y por tener un cliente solo**. Es la casualidad que M-2 corrigió, en otro
   lugar.
3. **ADR-004 nunca adjudicó «N clientes, un recinto cada uno».** Rechazó
   *«multisitio bajo un tenant»* como paquete. La pregunta está **abierta**: no
   habilitada, tampoco resuelta. Es el insumo de **ADR-005**.

**Bug de guard registrado y NO corregido — pero HOY NO SE VE.**
`scripts/verificar-citas.mjs:77` exige `\n` tras la valla ```` ```mermaid ````.
Medido el 2026-08-15: `flujos.md` y `MER.md` están en el árbol de trabajo con
**LF**, no CRLF, así que `verificar:citas` da **21/21** y reporta 3 y 2 diagramas
— no el `PASS · 0 diagramas` del conjunto vacío.

**El defecto está dormido, no corregido.** Probado sobre una copia CRLF sin tocar
el guard: regex actual → **0 bloques**, regex `\r?\n` → 3. Con `core.autocrlf=true`
y sin `.gitattributes`, **un clon nuevo vuelve a CRLF y el guard vuelve a fallar**.
Detalle y medición en `LEDGER.md` (2026-08-15).

## DECISIÓN TOMADA (2026-08-14) · el segundo meta-gate que agota el BoundedLoop

**Resuelto: se acepta como riesgo, igual que INT-12, y se pivotea a FASE D.**
El gate de evidencia queda **FAIL registrado y no reabierto**. La salida técnica
que dejó el auditor —comparar también las filas `NO CORRIDO` contra su celda
esperada, que el generador ya conoce, y sacar la comprobación de marcadores
únicos de la rama `--actualizar`— queda **documentada y no implementada**, igual
que la de INT-12.

Fundamento de la asignación: el costo de oportunidad de seguir endureciendo el
instrumento que vigila instrumentos, contra un propósito —H1— que no tiene un
solo dato.

**Lo que hay que seguir sabiendo mientras el riesgo esté vivo:** el bloque §0 de
este archivo y de la matriz **se puede forjar en las filas que la corrida habitual
no mide** (todo el grupo `navegador`), y el gate saldría verde. Al leer un bloque,
mirar la línea de cobertura: lo que dice `NO CORRIDO` no fue medido hoy, y lo que
dice `PASS` en una fila de `navegador` solo vale si esa corrida usó `--todos`.

**Es el patrón, no el incidente.** INT-12 y el gate de evidencia son los dos
únicos hallazgos que agotaron sus tres ciclos, y los dos verifican **la
verificación misma** —uno la invalidación de caché del deploy, el otro el bloque
de evidencia—. Los dos caen por **falsificabilidad**: en INT-12 el historial se
podía forjar y borrar; acá el bloque se puede forjar **en las filas que la corrida
habitual no mide**.

No es casualidad. Un artefacto que *afirma* el resultado de una verificación se
puede reescribir, y protegerlo exige una raíz de confianza que el propio artefacto
no puede proveer. Cada vuelta de tuerca mueve la falsificación un nivel más arriba
en vez de eliminarla.

**Lo que ya está entregado y no depende de cerrar esto:**

| Verificado | Abierto |
|---|---|
| el bloque **se genera**, no se teclea | un bloque forjado en las filas no medidas pasa |
| `NO CORRIDO` no se lee como PASS | un segundo bloque agregado al archivo pasa invisible |
| un exit≠0 **no puede** rendir PASS | el sello prueba "es un commit", no "es *este* commit" |
| lo truncado se descarta, no se parsea | |
| procedencia desconocida ≠ árbol limpio | |

Respaldo: `evidencia:prueba` 23/23, y **nueve mutantes de un solo punto, cada uno
cazado** por al menos un caso.

**Recomendación (mía, explícita): aceptarlo como riesgo igual que INT-12 y
pivotear a FASE D.** El costo de oportunidad es medible: seguir endureciendo el
instrumento que vigila instrumentos, contra un propósito —H1— que **no tiene un
solo dato**. La alternativa está costeada y es chica (comparar también las filas
no corridas contra su celda esperada, que el generador ya conoce; y sacar la
comprobación de marcadores únicos de la rama `--actualizar`), pero **no la aplico
sin decisión**: la regla dice que un BoundedLoop agotado no se reabre.

**Defecto que esto ya cerró:** el bloque comiteado publicaba 19 filas contra un
catálogo de 21 —faltaba `verificar:temporizador` entero— y el gate no lo decía,
porque caía entre las filas saltadas. Al regenerar sobre `09fcf87` el bloque pasó
a publicar las 21. **Se cerró regenerando, no verificando:** el agujero que lo
permitió sigue abierto, y es el mismo riesgo aceptado de arriba.

## Base de evidencia — generada, no tecleada

<!-- EVIDENCIA:INICIO -->
<!-- Generado por `npm run evidencia`. No editar a mano: se regenera y se desfasa. -->

**Commit:** `0774c4c` · ⚠ **árbol sucio**: esta corrida no describe un estado reproducible · **corrido:** 2026-08-17 · **grupos:** estatico, base

| Comando | Resultado | Veredicto | Nota |
|---|---|---|---|
| `npm run test` | `exit=0` · 122/122 | PASS |  |
| `npm run verificar:alcance` | `exit=0` · 9/9 | PASS |  |
| `npm run verificar:alcance:prueba` | `exit=0` · 15/15 | PASS |  |
| `npm run evidencia:prueba` | `exit=0` · 23/23 | PASS |  |
| `npm run verificar:ac` | `exit=0` · 9/9 | PASS |  |
| `npm run verificar:citas` | `exit=0` · 23/23 | PASS |  |
| `npm run verificar:verificadores` | `exit=0` · 43/43 | PASS |  |
| `npm run verificar:agentes` | `exit=0` · 16/16 | PASS |  |
| `npm run verificar:esquema` | `exit=0` · 8/8 | PASS |  |
| `npm run verificar:invariantes` | `exit=0` · 8/8 | PASS |  |
| `npm run verificar:meas1` | `exit=0` · — | PASS |  |
| `npm run verificar:h1` | `exit=1` · — | FAIL | **se espera FAIL** mientras el banco esté vacío: es el entregable de FASE D, no una regresión. *«No pude medirlo» no es «está bien»* |
| `npm run build` | **NO CORRIDO** · grupo `build` | — |  |
| `npm run verificar:salida` | **NO CORRIDO** · grupo `servidor` | — |  |
| `npm run verificar:pwa` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:op1` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:a3` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:m4` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:meas2` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:temporizador` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:endurecimiento` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:ui` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:int12` | **NO CORRIDO** · grupo `navegador` | — | gate registrado **FAIL** (LEDGER 2026-08-13). Su PASS no es evidencia: el historial se puede forjar y borrar |

**Cobertura de esta corrida: 12 de 23 comandos.** Los 11 restantes dicen NO CORRIDO a propósito: un bloque que omite lo que no corrió se lee como si todo hubiera pasado.

**Excluidos del catálogo a propósito (1):** `npm run evidencia`. No están medidos acá y esta línea existe para que la cobertura no baje en silencio.
<!-- EVIDENCIA:FIN -->

Los grupos `build`, `servidor` y `navegador` exigen la app levantada. Para la
foto completa: `npm start` en otra consola y `npm run evidencia --todos`, o
`npm run evidencia --todos --url=https://estacionamiento-three.vercel.app`.

**Un `NO CORRIDO` no es un PASS viejo.** Es la ausencia de una medición de hoy.
El veredicto vigente de esos comandos está en `LEDGER.md`.

## La estrategia vigente (2026-08-14) — cinco fases, WIP=1

El diagnóstico que la ordena: el proyecto verifica **propiedades del artefacto**
(¿compila?, ¿existe el campo?, ¿el navegador computa 12px?) y lo hace muy bien
—33 aserciones vigilando a los propios verificadores, un gate probado con el
fallo plantado—. Lo que falta es verificar **propiedades del propósito**.

**AC-MEAS-1 da PASS con cero filas.** Verifica que no haya nulos, no que haya
datos. *Un criterio que pasa sobre el conjunto vacío no puede refutar nada.* H1 y
H2 necesitan verificadores que devuelvan **un número**, no un PASS.

| Fase | Qué | Estado |
|---|---|---|
| **B** | Reparar el registro: LEDGER, STATE, `npm run evidencia` | **cerrada**, con el gate en FAIL (arriba) |
| **C** | Anclar la verificación a la spec | **casi**: `AC-OP-4` y `AC-PDP-1` escritos; falta `AC-OP-3` |
| **D** | **H1: convertir "SIN DATOS" en un número** | **SPEC-D escrita** → `docs/SPEC-D-medicion-de-H1.md`. Es el próximo hito |
| **E** | INT-7: retención parametrizada | pendiente, y **va DESPUÉS de D** — ver abajo |
| **F** | INT-12 | resuelta: riesgo aceptado |

### FASE C — qué se ancló y qué se soltó, a propósito

Regla aplicada, fijada por un veto anterior: *¿el AC hace exigible una afirmación
que ya está en §1–§8, o introduce una nueva?* Lo primero es formalizar; lo segundo
es autorar requisitos, y eso va por ADR.

Suben tres: **AC-OP-3** (temporizador, §5), **AC-OP-4** (ciclo de salida contra la
API real + validación de frontera, §5+§7) y **AC-PDP-1** (barrera de datos reales,
§4+§7). Los dos últimos ya son fila de §9.

**No suben** `verificar:m4`, `verificar:int12`, `verificar:ui` ni
`verificar:endurecimiento`: verifican propiedades que §1–§8 **nunca enunció**.
Queda escrito para que la omisión sea decisión y no olvido.

Medido: `verificar:ac` pasó de **6 verificadores sin AC a 4**, con 13 AC.

### D antes que E — restricción encontrada midiendo, no razonando

El centinela de enmascarado de E **rompe la discriminación fixture/real** de la
que depende H1: `limpiar-fixtures.mjs:22` y `scripts/lib/fixtures.mjs:59` deciden
qué es fixture con un `LIKE 'FIXT%'` **sobre la patente**, así que una fila
enmascarada deja de reconocerse como fixture y **pasa a contar como "cerrada NO
fixture"** — el numerador exacto de H1. Si E corre antes que D, contamina la
métrica con ruido indistinguible de operación real, y el dato original ya no está.

**✅ DECIDIDO (2026-08-14): la retención excluye fixtures.** El mecanismo de INT-7
llevará `AND patente NOT LIKE 'FIXT%'`. No es el atajo barato: una patente
`FIXT01` **no es dato personal**, así que nunca estuvo en el alcance de la Ley
21.719 — y hay que escribir ese fundamento junto al `WHERE`, o el próximo lector
lo va a leer como filtro conveniente.

Con eso **§4 no se enmienda y `AC-DATA-1` no se toca**. La alternativa descartada
—columna `es_fixture` explícita— rompía `AC-DATA-1`, que desde `b933ccb` compara
los 27 campos *ni de más ni de menos*: exigía enmendar la fuente de verdad más
migración, contra el principio de minimización.

Riesgo aceptado y anotado: el discriminador sigue siendo una **convención sobre
el contenido de un campo**, sostenida por `src/lib/fixtures.ts`, que es regla de
aplicación y no del esquema. Moverlo al esquema sería enmienda de §4, por ADR.
Detalle y costeo en `docs/SPEC-D-medicion-de-H1.md` §2.

### Por qué FASE E se puede construir hoy

El VETO 1 de FASE 3 probó que **el esquema no bloquea el enmascaramiento**:
`patente` es `text NOT NULL` sin CHECK de formato, el único índice único es
parcial sobre `estado='activa'` (así que un centinela compartido en filas
cerradas no colisiona) y ninguna FK apunta a `sesion_vehiculo`. Un
`UPDATE … SET patente='XXXXXX' WHERE estado='cerrada' AND salida_at < $plazo`
cumple `spec.md:150` **sin migración**.

Tres documentos culpaban al esquema de un bloqueo que es de decisión. Construir
el mecanismo leyendo el plazo de una variable que **falla cerrado** si no está
definida hace que `{{PLAZO_RETENCION_PATENTE}}` deje de bloquear la
*construcción* y bloquee solo el *encendido*.

**La premisa se verificó empíricamente** (auditoría 2026-08-14, `UPDATE` corrido
en transacción revertida: 3 filas enmascaradas al mismo centinela, sin colisión).
Pero la misma auditoría encontró **cuatro cosas que hay que decidir antes de
escribir una línea de FASE E**:

1. **El centinela rompe la discriminación fixture/real de la que depende FASE D.**
   `limpiar-fixtures.mjs:22` y `scripts/lib/fixtures.mjs:59` borran por
   `patente LIKE 'FIXT%'`. Una fila enmascarada deja de ser reconocible como
   fixture: se vuelve imborrable **y pasa a contar como "sesión cerrada NO
   fixture"**, que es exactamente el numerador con el que hoy se afirma que H1
   está en cero. Enmascarar contaminaría la métrica de H1 con ruido
   indistinguible de operación real.
2. **Las sesiones `activa` vencidas nunca se enmascaran.** El `WHERE
   estado='cerrada'` las excluye por construcción, y **no existe mecanismo que
   las cierre**: no hay cron, no hay `vercel.json`, y `PERMANENCIA_MAXIMA_MS`
   (`src/lib/tiempo.ts:48`) solo satura el monto. Una patente en una sesión que
   quedó activa se retiene **indefinidamente** y `spec.md:150` no se cumple.
3. **Si el enmascarado se extendiera a `activa`, INT-15 lo rechaza**: dos activas
   con el mismo centinela violan `sesion_vehiculo_activa_unica`. Medido.
4. **`'XXXXXX'` no pasa `validarPatente`** (`src/lib/patente.ts:75` exige al menos
   un dígito). Sería un valor que el sistema rechaza en toda frontera de entrada
   y acepta en base. No rompe nada hoy, pero elegirlo tiene que ser a propósito.

## INT-12 — cerrado como riesgo aceptado (2026-08-14)

No se reabrió el BoundedLoop: se decidió. El fundamento, que sigue siendo el del
registro del 2026-08-13:

| | |
|---|---|
| La corrección en `src/lib/version-app.ts` | **sana** — el auditor la aprobó en los ciclos 2 y 3 |
| La propiedad en producción | **observada directamente**, sin depender del verificador |
| El gate `verificar-int12.mjs` | **no confiable** — el historial se puede forjar y borrar |

Evidencia de producción, que no depende del archivo de estado — dos deploys del
mismo commit con el árbol limpio dieron versiones distintas:

```
f77e331 -> dpl_3ZWvRFRhycVvN6wYo1sVm5pNFAKk -> sw.js?v=f77e331-o1sVm5pNFAKk
f77e331 -> dpl_BXaBdNxDgSFiivcbWzcRtmYaY2KP -> sw.js?v=f77e331-WzcRtmYaY2KP
```

**Priorización por riesgo real**, como ya se hizo en M5: un gate de invalidación
de caché pesa menos que H1, que es la razón de existir del proyecto. La salida
técnica que dejó el auditor —guardar la URL inmutable del deployment y
**re-derivar** `{artefacto, versión}` en cada corrida en vez de creerle al
archivo— queda documentada y **no implementada**. Si INT-12 vuelve a doler, ése
es el camino.

Mientras tanto: `npm run evidencia` marca ese comando con la nota de que su PASS
no es evidencia, para que nadie lo lea como verde.

## M6 — capa de presentación · SPEC-004 entregado

Tokens tomados de `_ds/…/colors_and_type.css` vía `DesignSync`. Ningún valor
inventado. Todo SPEC-004 se verifica con `npm run verificar:ui [url]` → 18/18,
local y contra producción.

Ese verificador nació de un defecto que los cuatro AC originales no veían: todo
`globals.css` estaba **sin `@layer`**, y una declaración sin capa le gana a
cualquier capa. `p { font-size: … }` derrotaba a `text-xs` en todos los `<p>`, y
`.cifra` derrotaba a `text-2xl`. **La mitad de las decisiones tipográficas de M6
no se aplicaba, con AC-UI-1/2/3/4 en verde** — tres miran el fuente y el cuarto
mira la CSP. Por eso `verificar-ui.mjs` mide el **estilo computado**.

Pantallas con el sistema aplicado: `login`, operador, panel del dueño, descuadre,
cerrar sesión. Faltan las 3 construibles: `1e` (tarifas), `1g` (reportes), `1l`
(ingreso a pantalla completa). `1l` y `1g` son parte de FASE D.

## Estado de hitos

- M0–M4 — **cerrados**. v1 desplegada y verificada punta a punta.
- M5 Endurecimiento — **cerrado en código y desplegado**. INT-12 como riesgo aceptado.
- M6 Presentación — **en curso**. SPEC-004 entregado; faltan 3 pantallas.
- M7 Plataforma — **bloqueado** por las precondiciones de ADR-004.

## ADR-004 — decidido (2026-08-13)

**Aceptado parcialmente: alternativa 2, enmienda mínima.** Se abre el cobro de
**suscripción** (dueño → C4A). **Multisitio sigue excluido**: `1d`, `1h`, `1k`,
`1m` siguen rechazadas por el gate. El cobro del estacionamiento al conductor
sigue en efectivo, fuera del sistema — esa línea no se movió.

`AC-SCOPE-1` **ya se reescribió** (FASE A, commit `f98a652`): pasó de una regex en
una celda de tabla —inejecutable, porque `\|` en regex .NET es un pipe literal y
el criterio reportaba PASS incondicionalmente— a `npm run verificar:alcance`, que
escanea **por exclusión** y está probado con el fallo plantado. La frontera
declarada es `src/lib/suscripcion/`, hoy vacía.

## BLOQUEOS HUMANOS (no los resuelve el loop)

1. **`{{BASE_LICITUD}}`** y **`{{PLAZO_RETENCION_PATENTE}}`** — sin ellos, cero
   vehículos reales. `OPERACION_REAL_HABILITADA=false`. FASE E construye el
   mecanismo parametrizado; **encenderlo sigue siendo decisión humana**.
2. **Repositorio público.** `cherrera0001/p4rkc0ntr0l` sigue **público**. El
   decisor eligió pasarlo a privado: dos clics en `Settings → General → Danger
   Zone`. Sin `gh` ni token en el entorno, no se puede hacer desde acá.
3. **H1 nunca se midió.** AC-MEAS-1 pasa, pero cada corrida de navegador limpia
   sus fixtures. El numerador de H1 está vacío. El `6,2 s` de las maquetas
   `1g`/`1k` es un valor **inventado**. Es FASE D.
4. **`{{PRECIO_SUSCRIPCION_UF}}`** — sin él no hay nada que cobrar, y sin cobro
   H2 no se puede medir.
5. **Redondeo del monto** — neutro (`Math.round`), pendiente de confirmación.
6. **Duración de sesión: 12 h** — decisión de operación, en `src/lib/sesion-token.ts`.
7. **Permanencia máxima facturable: 30 días** — techo técnico, en `src/lib/tiempo.ts`.
8. **El monto crece con la duración del corte de señal.** El cierre calcula
   `salida_at = ahora` en el servidor, así que una sesión que no se pudo cerrar
   durante veinte minutos sin señal se factura veinte minutos más cara.
   **El conductor paga la falta de señal.** Corregirlo exige elegir cuál instante
   es el facturable, y esa elección es del decisor. Declarado en `spec.md` §5.

## Cómo entrar a la app

`operador@fixture.invalid` o `duena@fixture.invalid`, con `CLAVE_ACCESO` de
`.env` — la misma para los dos. Patente de prueba: cualquiera que empiece con
`FIXT` y tenga al menos un dígito (`FIXT01`). La semilla no crea patentes: las
sesiones las crea el operador.

## Comandos

```
npm run evidencia                     # regenera los bloques de §0 (--todos, --url=, --actualizar)
npm test                              # 122 unitarias
npm run build · npm run lint
npm run sembrar

# Alcance y contrato
npm run verificar:alcance             # AC-SCOPE-1/2/3 (por exclusión)
npm run verificar:alcance:prueba      # el gate, con el fallo plantado
npm run verificar:ac                  # todo AC de §9 cita un comando que existe

# Datos
npm run verificar:esquema             # AC-DATA-1 (compara los 27 campos)
npm run verificar:invariantes         # AC-DATA-2 · INT-15/16/17
npm run verificar:meas1               # AC-MEAS-1

# Con la app levantada
npm run verificar:salida [url]        # ciclo ingreso/salida + control de acceso
npm run verificar:op1  [url]          # AC-OP-1 (offline real por CDP)
npm run verificar:meas2 [url]         # AC-MEAS-2 e2e
npm run verificar:pwa  [url]          # AC-PWA-1
npm run verificar:a3   [url]          # A-3: la patente real no toca el dispositivo
npm run verificar:m4   [url]          # M-4: purga de copias locales
npm run verificar:endurecimiento [url]# INT-2/4/8/11/12/14/15, A-1, C-1, B-2
npm run verificar:ui   [url]          # SPEC-004 por estilo computado
npm run verificar:int12 [url]         # riesgo aceptado: su PASS no es evidencia

# Guards del proceso (no van en §9, a propósito)
npm run verificar:citas               # las citas archivo:línea resuelven
npm run verificar:verificadores       # los verificadores no mueren en silencio
npm run limpiar:fixtures
```

Requieren `DATABASE_URL`, `CLAVE_ACCESO` y `SESSION_SECRET`. Sin `[url]` corren
contra `localhost:3000`. **Todos los scripts que tocan la base ya traen
`--env-file=.env`**.

**6 de los 9** verificadores de navegador llaman `limpiarFixtures()` **al
iniciar** (`a3`, `m4`, `meas2`, `op1`, `endurecimiento` y **`temporizador`**; no
`pwa`, `ui` ni `int12`) — mecanizado el 2026-08-12, porque era una precondición
que dependía de que alguien se acordara y produjo dos FAIL falsos.
`verificar-salida.mjs:10` declara que a propósito no limpia al inicio.

> **Acá decía «5 de los 8», y quedó viejo.** Re-medido el 2026-08-16: importan
> `puppeteer-core` **nueve** y llaman `limpiarFixtures()` **seis**. El que faltaba
> en las dos cuentas es `scripts/verificar-temporizador.mjs:208`, que entró
> después de aquella medición y hace las dos cosas. **No es un dígito: es un
> borrador de banco que no figuraba en ningún inventario**, y la FASE D se iba a
> diseñar contra esa lista. Lo encontró la auditoría de FASE D, ciclo 2.

**No confundir con "la base queda en cero".** Limpian al **iniciar**: cada tanda
borra las filas de la anterior y deja las suyas puestas. Hoy la base tiene 3
sesiones cerradas (`FIXT01/02/03`). Ninguna corrida acumula, que es lo que
impide medir H1 — pero el mecanismo no es el que la matriz describía hasta hoy.

Los scripts de navegador conviene espaciarlos unos segundos: en corridas seguidas
se observa contención entre instancias de Edge. Un FAIL aislado en una tanda
secuencial se re-corre solo antes de darlo por real.

Todo comando node/npm/npx/git necesita el prefijo de PATH de `CLAUDE.md` §7
mientras no se reinicie Claude Code.
