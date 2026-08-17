# Prompt para Claude Code — FASE D · convertir «SIN DATOS» en un número

> Pegar entero como primer mensaje en el repo `Estacionamiento`.
> Está escrito contra el árbol leído el 2026-08-16. Todo lo que afirma sobre el
> repo se puede refutar con un comando: **si algo de acá no reproduce, decilo y
> pará** — no lo acomodes.

---

## 0. Antes de escribir una línea

Leé, en este orden: `CLAUDE.md`, `STATE.md`, `docs/SPEC-D-medicion-de-H1.md`,
`spec.md` §6 y §9.

**Verificá la premisa de arranque antes de aceptarla.** Los artefactos de T01
(`docs/data/historias-usuario.md`, `docs/data/actores.md`,
`docs/data/seleccion-prototipo.md`, `docs/adr/ADR-005-*.md`) **no están en
`main`**: viven en `agents/medir-documentacion-historias-casos-uso`. Corré
`git branch --show-current` y `git log --oneline -3` y **reportá en qué árbol
estás trabajando** antes de tocar nada. Si la rama de trabajo no tiene esos
archivos, decilo: cambia qué se puede citar.

Recordá el prefijo de PATH de `CLAUDE.md` §7 para todo comando node/npm/git.

---

## 1. Qué hay que hacer, y por qué es esto y no otra cosa

**FASE D.** El proyecto entero existe para probar o refutar H1 —*un operador
registra entrada + salida más rápido que en el cuaderno*— y **H1 nunca se
midió**. `docs/data/seleccion-prototipo.md` lo dice sin anestesia: *el prototipo
está completo como producto y vacío como instrumento.* Siete de las diez
historias están construidas; la hipótesis que las justifica no tiene un solo
dato.

La causa no es negligencia: `AC-MEAS-1` **no puede fallar por ausencia de
datos**. `scripts/verificar-meas1.mjs:53` guarda `nulos !== 0` —un `count(*)`
sobre un `WHERE`, vacuamente verdadero sobre el conjunto vacío— y
`scripts/verificar-meas1.mjs:57` lee `information_schema`, que no depende de las
filas. **Un criterio universal es automáticamente verdadero si no hay ningún X.**

FASE D construye el criterio **existencial** que falta: uno cuya salida no es un
PASS sino **un número**.

---

## 2. Restricciones que no se negocian

Salen de `CLAUDE.md`. Si una tarea parece exigir algo de acá: **parar y decirlo.**

1. **No inventar datos.** Ni patentes, ni montos, ni duraciones de tecleo. Este
   repo ya pagó ese modo de falla con el `6,2 s` inventado de las maquetas
   `1g`/`1k`. **Está explícitamente prohibido poblar el banco de medición con
   filas generadas por SQL con duraciones sintéticas.** Una mediana calculada
   sobre timestamps que escribió un script no es evidencia de nada: es el `6,2 s`
   otra vez, con más decimales.
2. **No rellenar `{{placeholders}}`.** `{{UMBRAL_H1_SEGUNDOS}}` y
   `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` siguen abiertos. Por eso **D entrega el
   número y NO el veredicto sobre H1**.
3. **Gate de alcance intacto.** Nada de `tenant`, `plataforma`, pasarelas ni
   multisitio. ADR-005 está PROPUESTO y no adjudicado: no se construye ni una
   versión chica.
4. **Minimización (§4).** **Ninguna tabla ni columna nueva.** `AC-DATA-1` compara
   los 27 campos exactos, *ni de más ni de menos* (`npm run verificar:esquema`).
   Si tu diseño necesita una columna, el diseño está mal.
5. **WIP = 1.** Una iteración a la vez, auditada, antes de abrir la siguiente.
6. **Reportar la salida real de los comandos.** Nunca una transcripción con
   prompt `$` que no corriste. Este repo ya se vetó a sí mismo por eso: publicó
   `21/21` como *«medido hoy»* siendo un número de la iteración anterior — dentro
   de la sección que declaraba que un PASS viejo no es una medición de hoy.

---

## 3. Iteración 1 — `scripts/verificar-h1.mjs`

Construir el instrumento. **No toca `src/`.**

### 3.1 Las tres poblaciones, que nunca se mezclan

Es lo más importante del diseño, y es lo que distingue un instrumento honesto de
un número bonito:

| Población | Filtro | Qué es | Vale como evidencia de H1 |
|---|---|---|---|
| **real** | `patente NOT LIKE 'FIXT%'` | operación real | **sí, es la única** |
| **banco** | `patente LIKE 'FIXTB%'` | una persona tecleando en la interfaz, con patente de prueba | **no** — mide la interacción con la interfaz, no la operación |
| **efímero** | `LIKE 'FIXT%' AND NOT LIKE 'FIXTB%'` | lo que dejan los verificadores | **no, y es lo más importante que digas** |

**La población efímera hay que reportarla y hay que desacreditarla en la misma
línea.** Esas filas las teclea Puppeteer por CDP o las inserta la API directo:
su `tecleo_fin_at − tecleo_inicio_at` es la latencia de un robot. Publicarla sin
esa marca sería peor que no medir — daría un número plausible y falso, que es
exactamente la forma del `6,2 s`.

### 3.2 Qué calcula

- **Métrica:** `EXTRACT(EPOCH FROM (tecleo_fin_at - tecleo_inicio_at))`, en
  segundos, por sesión.
- **Universo:** `estado = 'cerrada'` con ambos timestamps presentes —seguí
  `docs/SPEC-D-medicion-de-H1.md` §3.1—. **Y reportá cuántas `activa` quedaron
  fuera por esa elección**: el límite del instrumento se declara en su propia
  salida, no en un comentario.
- **Estadístico: mediana**, con `percentile_cont(0.5) WITHIN GROUP (ORDER BY …)`.
  No promedio: un operador que se distrae una vez corre el promedio y no la
  mediana.
- **Siempre con `n`, mínimo y máximo.** *Publicar una mediana sin su tamaño de
  muestra está prohibido en este script.* Que sea imposible por construcción, no
  por disciplina.
- **Ningún umbral hardcodeado.** «Una mediana sobre 3 sesiones no es evidencia de
  nada» es cierto, pero el corte es una decisión humana: **proponé
  `{{N_MINIMO_H1}}` como placeholder nuevo en `spec.md` §12 y no lo rellenes.**
- **Ningún veredicto sobre H1.** Medir no requiere umbral; comparar sí. El script
  dice el número y dice, explícitamente, que no puede concluir.

### 3.3 Semántica de falla — esto es el entregable

```
FAIL  si  n(banco) == 0  Y  n(real) == 0
```

*«No pude medirlo» no es «está bien».* El script **tiene que fallar hoy**, y eso
no es una regresión: es la primera vez que la ausencia de datos de H1 se vuelve
visible en un comando en vez de esconderse detrás de un PASS vacuo.

`n(real) == 0` por sí solo **no es falla del script**: está bloqueado por
`{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}`, que son decisión humana.
Reportalo como bloqueo, no como defecto.

### 3.4 Guards del repo que este script tiene que pasar

- `scripts/verificar-verificadores.mjs:71` exige un veredicto final que matchee
  `/comprobaciones PASS|:\s*\$\{?.*PASS|: PASS/`. **Escribí las dos ramas
  literales** —`console.log("\nAC-H1-1: PASS")` y
  `console.log("\nAC-H1-1: FAIL · …")`—; un `${veredicto}` interpolado **no
  matchea** y el guard te va a rechazar.
- Nada de `.json()` crudo (acá no hay HTTP, pero el guard escanea igual).
- Consultas parametrizadas con `postgres` template tags, nunca concatenación.

---

## 4. Iteración 2 — el banco que acumula (`SPEC-D` §3.2)

Hoy **ninguna corrida acumula**: 5 de los 8 verificadores de navegador llaman
`limpiarFixtures()` **al iniciar**, y ese borrado es
`DELETE … WHERE patente LIKE 'FIXT%'` (`scripts/lib/fixtures.mjs:59` y
`scripts/limpiar-fixtures.mjs:22`). Cada tanda borra la anterior. Por eso el
numerador de H1 está vacío.

### 4.1 El diseño propuesto — evalualo, no lo apliques a ciegas

**Sub-prefijo reservado `FIXTB`.** La propiedad que lo hace funcionar:
`esPatenteFixture()` (`src/lib/fixtures.ts:15`) es
`patenteNormalizada.startsWith("FIXT")`, así que `FIXTB1` **sigue siendo fixture
para la barrera A-3** — la app la acepta y `AC-PDP-1` no se toca. Y pasa
`validarPatente` (`src/lib/patente.ts:53`): 6 caracteres, entre 4 y 8, con al
menos un dígito.

El cambio es acotar el borrado en los dos lugares donde vive:

```sql
DELETE FROM sesion_vehiculo
WHERE patente LIKE 'FIXT%' AND patente NOT LIKE 'FIXTB%'
```

**Escribí el fundamento junto al `WHERE`**, no en el commit: es la misma regla
que `docs/SPEC-D-medicion-de-H1.md` §2 punto 3 fijó para FASE E, y por la misma
razón —un lector futuro lo va a leer como filtro conveniente si no encuentra el
porqué al lado.

**Antes de aplicarlo, refutalo.** Preguntas abiertas de verdad, no retóricas:
¿`FIXTB` es un prefijo o hace falta que el discriminador viva en otro lado?
¿Qué pasa si alguien teclea `FIXTB1` esperando una sesión efímera? Si encontrás
un diseño mejor, proponelo con su costo — este está costeado en cero migraciones
y cero campos nuevos, ése es el piso a batir.

### 4.2 El banco se llena tecleando, no insertando

Repetido porque es la regla que más fácil se rompe: **el banco lo llena una
persona usando la app.** Ninguna fila del banco puede nacer de un `INSERT` con
`tecleo_inicio_at` y `tecleo_fin_at` elegidos por vos.

Lo que sí podés construir: **un procedimiento escrito** —cuántas sesiones, con
qué operador, en qué condiciones— para que quien llene el banco lo haga de forma
comparable. Eso es método, no dato inventado.

### 4.3 La interferencia hay que medirla, no argumentarla

Filas del banco que sobreviven a la limpieza pueden ensuciar otros verificadores.
La hipótesis es que **no**, si el banco son sesiones **cerradas y con `salida_at`
en el pasado**: `verificar:meas2` corta los ingresos al inicio del día en la zona
del estacionamiento (`src/app/dueno/page.tsx:23`) y la ocupación cuenta
`estado='activa'`. **Comprobalo corriendo la regresión con el banco puesto**, y
si algo se rompe, decilo antes de seguir.

### 4.4 El control negativo que hoy no existe

Agregá al script una comprobación que hoy nadie hace: **tras `limpiarFixtures()`,
las filas `FIXTB%` siguen y las `FIXT01` no.** Sin eso, el banco «funciona» por
casualidad hasta el día que alguien toque el `DELETE`.

---

## 5. Iteración 3 — cableado

En este orden, y **recién ahora** que el comando existe:

1. **`package.json`** →
   `"verificar:h1": "node --env-file=.env scripts/verificar-h1.mjs"`
2. **`scripts/evidencia.mjs:138`**, en `CATALOGO` →
   `{ script: "verificar:h1", grupo: "base" }`.
   **No es opcional:** `scripts/evidencia.mjs:317` falla si existe un
   `verificar:*` que no esté ni en `CATALOGO` ni en `FUERA_DEL_CATALOGO`.
3. **`spec.md` §6**, después de `AC-MEAS-1` (línea 224).
4. **`spec.md` §9**, fila nueva en la tabla. Redacción base —ajustala a lo que el
   comando realmente hace, no al revés:

   > **AC-H1-1.** `npm run verificar:h1` publica la **mediana del tiempo de
   > tecleo** y el **tamaño de muestra**, separando banco de prueba de operación
   > real. **Falla si no hay datos**: *«no pude medirlo»* no es *«está bien»*.

   El AC se escribe **después** de que el comando exista, no antes: un AC que
   cita un comando inexistente es el defecto de AC-PWA-1 que `verificar:ac`
   existe para impedir.

**Consecuencia que hay que decir en voz alta, no descubrir después:** al entrar
al catálogo, `npm run evidencia` va a publicar `verificar:h1` en **FAIL**. El
bloque de evidencia de `STATE.md` deja de estar todo en verde. **Eso es el
entregable, no una regresión** — y tiene que quedar escrito así en el LEDGER, o
el próximo lector lo va a «arreglar».

---

## 6. Iteración 4 — registro

- **`LEDGER.md`** (append-only): qué se construyó, los hallazgos de cada ciclo de
  auditoría con su cita, y **la salida real de los comandos en una sola corrida**.
- **`STATE.md`**: FASE D, el nuevo estado del bloque de evidencia y por qué hay
  un FAIL a propósito.
- **`LEARNINGS.md`**: la lección de fondo —*un criterio universal no puede
  refutar nada sobre el conjunto vacío; cuando importa que existan datos, el
  criterio tiene que ser existencial y su salida un número*.

---

## 7. Cómo trabajar

- **WIP=1, con auditoría adversarial por iteración**, máximo 3 ciclos. Si el
  tercero no pasa: HALT y reportar, no forzar.
- **Verificá las afirmaciones del auditor antes de aceptarlas**, y decí cuáles
  reprodujiste y cuáles no.
- **Regla U7, que este repo aprendió a los golpes:** *toda afirmación sobre el
  repositorio es verificable con un comando* — y su forma operativa, que costó
  dos vetos: **no alcanza con medir antes de escribir; hay que buscar todas las
  ocurrencias de lo que acabás de refutar.** Un `grep` del claim, no del dato.
  Dos veces un fix corrigió una mitad y dejó viva la otra.
- **Las citas `archivo:línea` tienen que decir lo que afirmás**, no solo existir.
  `verificar:citas` comprueba que la línea exista; que *diga* lo que citás es
  trabajo tuyo. El peor defecto de la iteración anterior fue una cita que
  resolvía y apuntaba al lugar equivocado — y era la del tecleo, la métrica de H1.

### Regresión antes de dar nada por cerrado

```
npm test
npm run verificar:esquema        # AC-DATA-1 — 27 campos, ni de más ni de menos
npm run verificar:invariantes
npm run verificar:meas1
npm run verificar:h1             # el nuevo — se espera FAIL con el banco vacío
npm run verificar:ac
npm run verificar:verificadores
npm run verificar:citas
npm run verificar:alcance
npm run evidencia
```

Y con la app levantada, para probar 4.3: `verificar:meas2`, `verificar:op1`,
`verificar:m4`, `verificar:a3`.

---

## 8. Lo que NO se toca en este trabajo

| Fuera de alcance | Por qué |
|---|---|
| **FASE E** (retención / INT-7) | va **después** de D: el centinela rompe la discriminación fixture/real de la que D depende (`SPEC-D` §1) |
| **ADR-005**, `tenant`, `plataforma` | PROPUESTO, no adjudicado. Adjudicarlo es decisión humana |
| **El hueco del gate de alcance** | hallazgo abierto y registrado. Es trabajo aparte y toca tooling |
| **El guard de citas dormido por CRLF** | ídem |
| **Las pantallas `1e`/`1g`/`1l`** | `1g` y `1l` dependen de que D exista primero |
| **Los documentos de T01** | cerrados y auditados |

---

## 9. Definición de terminado

1. `npm run verificar:h1` corre, imprime **n + mediana + mín + máx por
   población**, y **falla con el banco vacío**.
2. Las tres poblaciones nunca se mezclan, y la efímera sale marcada como *no
   evidencia*.
3. El banco sobrevive a `limpiarFixtures()` y hay un control negativo que lo
   prueba.
4. `AC-H1-1` está en `spec.md` §9 y `verificar:ac` pasa.
5. `npm run evidencia` incluye `verificar:h1` y el FAIL está explicado en el
   LEDGER como intencional.
6. Ni una fila de banco generada por SQL con duraciones inventadas.
7. `git diff --stat` sobre `src/`: **debería estar vacío**. Si no lo está,
   justificá cada línea.
