# SPEC-D · Medición de H1 — de «SIN DATOS» a un número

> **Propuesta. No se construye en este loop.** Queda lista para el siguiente.
> Ningún `{{placeholder}}` se rellena acá.
>
> Origen: `spec.md` §1 (H1), §6 (SPEC-003), `docs/data/matriz-trazabilidad.md` §5.

---

## 0. Por qué existe

El proyecto entero existe para probar o refutar **H1** —*un operador registra
entrada + salida más rápido que en el cuaderno*— y **H1 nunca se midió**.

La razón no es negligencia; es que el criterio que debía cuidarlo **no puede
fallar por ausencia de datos**. Verificado en el código y demostrado con un
`DELETE` dentro de una transacción revertida:

```
sesiones totales           : 0
cerradas con tecleo nulo   : 0
columnas de tecleo NOT NULL: 2/2
veredicto que imprimiria meas1: AC-MEAS-1: PASS
```

`verificar-meas1.mjs` tiene dos guardas: `nulos !== 0` —un `count(*)` sobre un
`WHERE`, **vacuamente verdadero sobre el conjunto vacío**— y `obligatorias !== 2`,
que se lee de `information_schema` y **no depende de las filas**.

> **Un criterio universal —"todo X cumple P"— es automáticamente verdadero si no
> hay ningún X.** Cuando lo que importa es que *existan* X, hace falta un
> criterio **existencial**, y su salida no es un PASS: es **un número**.

Ése es el salto de esta fase: de verificar **propiedades del artefacto**
(¿compila?, ¿existe el campo?) a verificar **propiedades del propósito** (¿el
sistema produce la evidencia por la que existe?).

---

## 1. Restricción de orden: **D antes que E**

No es preferencia. La auditoría del 2026-08-14 la encontró midiendo, y cambia el
plan que estaba escrito.

FASE E (retención, INT-7) enmascara la patente a un centinela. Medido en
transacción revertida:

```
1) UPDATE cerradas -> centinela: 3 filas, sin error
2) filas que limpiar-fixtures (LIKE FIXT%) aun reconoce: 0
```

`limpiar-fixtures.mjs:22` y `scripts/lib/fixtures.mjs:59` deciden qué es fixture
con un `LIKE 'FIXT%'` **sobre la patente**. Una fila enmascarada deja de
reconocerse como fixture: se vuelve imborrable por la limpieza y **pasa a contar
como "sesión cerrada NO fixture"** — que es exactamente el numerador con el que
hoy se afirma que H1 está en cero.

**Si E corre antes que D, contamina la métrica de D con ruido indistinguible de
operación real.** Y el daño no se deshace: el dato original ya no está.

---

## 2. La decisión que esto abre (es del decisor, no del loop)

El discriminador fixture/real tiene que sobrevivir al enmascarado. Dos caminos, y
el costo de cada uno está medido:

### Opción A — el mecanismo de retención **excluye fixtures**

```sql
UPDATE sesion_vehiculo SET patente = :centinela
WHERE estado = 'cerrada' AND salida_at < :plazo
  AND patente NOT LIKE 'FIXT%'
```

**Sostenible en el fondo, no solo conveniente:** una patente `FIXT01` **no es un
dato personal**, así que la retención de la Ley 21.719 no le aplica. Enmascararla
nunca fue el objetivo.

- Costo: **cero**. No toca `spec.md` §4, no toca `AC-DATA-1`, no hay migración.
- Riesgo: el discriminador sigue siendo una **convención sobre el contenido de un
  campo**. Si mañana entra una patente real que empiece con `FIXT`, se la trata
  como fixture. Hoy eso lo impide `src/lib/fixtures.ts`, pero es una regla de
  aplicación, no del esquema.

### Opción B — columna explícita `es_fixture`

- Ventaja: el discriminador deja de depender del contenido de un campo que **se
  va a sobrescribir por diseño**.
- Costo, y hay que decirlo entero: `AC-DATA-1` compara desde `b933ccb` **los 27
  campos exactos** de `spec.md` §4, *ni de más ni de menos*. Una columna nueva
  **rompe AC-DATA-1** hasta que se enmiende §4. O sea: exige **cambiar la fuente
  de verdad + migración**, y §4 está escrita bajo el principio de minimización
  (*"no agregar campos por si sirven"*).

> **Recomendación: A**, y no por barata: porque el argumento de fondo —un fixture
> no es dato personal, así que no entra en el alcance de la retención— hace que la
> exclusión sea *correcta*, no un rodeo. B se justifica solo si alguna vez se
> decide que el discriminador debe vivir en el esquema; eso es una enmienda de §4
> y va por ADR.

### ✅ DECIDIDO (2026-08-14): **Opción A — la retención excluye fixtures**

El mecanismo de INT-7 llevará `AND patente NOT LIKE 'FIXT%'`. Consecuencias que
quedan fijadas por esta decisión, y que quien construya E tiene que respetar:

1. **§4 no se enmienda y `AC-DATA-1` no se toca.** No hay columna nueva, no hay
   migración, y la minimización de §4 queda intacta.
2. **El discriminador de H1 sobrevive al enmascarado**, que era la razón de la
   restricción de orden.
3. **La exclusión hay que escribirla con su fundamento, no como filtro
   conveniente:** una patente de fixture no es dato personal, así que la retención
   de la Ley 21.719 no le aplica. Un lector futuro tiene que encontrar el porqué
   junto al `WHERE`, o va a leerlo como un atajo.
4. **Riesgo aceptado, y anotado para que no se descubra tarde:** el discriminador
   sigue siendo una **convención sobre el contenido de un campo**. Hoy lo sostiene
   `src/lib/fixtures.ts`, que es regla de aplicación y no del esquema. Si alguna
   vez se decide moverlo al esquema, es enmienda de §4 y va por ADR.

**FASE E ya puede escribirse — después de D.**

---

## 3. Qué construye FASE D

### 3.1 La consulta (hoy no existe)

Ningún script, pantalla ni endpoint calcula la métrica de H1. Es el núcleo de la
maqueta `1g`, no construida.

- **Métrica:** `tecleo_fin_at − tecleo_inicio_at`, por sesión.
- **Estadístico:** **mediana**, no promedio. Un operador que se distrae una vez
  corre el promedio y no la mediana.
- **Y siempre acompañada de `n`.** Una mediana sobre 3 sesiones no es evidencia
  de nada; publicarla sin su tamaño de muestra es el defecto que este proyecto ya
  cometió con el `6,2 s` **inventado** de las maquetas `1g`/`1k`.
- **Universo:** sesiones cerradas, con ambos timestamps, **separando fixture de
  operación real** — las dos poblaciones se reportan, nunca se mezclan.

### 3.2 El banco que acumula

Hoy **6 de los 9** verificadores de navegador llaman `limpiarFixtures()` **al
iniciar** (`a3`, `m4`, `meas2`, `op1`, `endurecimiento` y **`temporizador`**; no
`pwa`, `ui` ni `int12`). Limpian **al iniciar**, no al terminar: cada tanda borra
lo de la anterior y deja lo suyo. **Ninguna acumula.**

> **Corrección (2026-08-16).** Acá decía *«5 de los 8»*. Re-medido:
> `scripts/verificar-temporizador.mjs:208` llama `limpiarFixtures()` y no estaba
> en el inventario. **Importa más que el dígito:** esta sección es la fuente del
> diseño del banco, y se iba a diseñar contra una lista a la que le faltaba uno
> de los borradores.

El banco necesita un espacio que la limpieza no barra. Que no se decida por
descarte: es parte de la propuesta y de lo que hay que revisar antes de
construir.

### 3.3 `1l` — ingreso a pantalla completa

La traducción de diseño la llama *"la mejor expresión de H1 del set"*. Es la
pantalla que la hipótesis necesita para medirse en condiciones reales de uso.

---

## 4. El criterio: **AC-H1-1**, y por qué no se parece a los otros

Redacción propuesta —**no se escribe en `spec.md` §9 hasta que su comando
exista**, porque un AC que cita un comando inexistente es el defecto de AC-PWA-1
que `verificar:ac` existe para impedir—:

> **AC-H1-1.** `npm run verificar:h1` publica la **mediana del tiempo de tecleo**
> y el **tamaño de muestra**, separando banco de prueba de operación real.
> **Falla si no hay datos**: *"no pude medirlo"* no es *"está bien"*.

Tres propiedades que lo distinguen de todo lo que hay hoy en §9:

1. **Devuelve un número, no un veredicto.** El PASS es que el número exista y sea
   reproducible.
2. **Es existencial, no universal.** No puede pasar sobre el conjunto vacío. Es
   la corrección directa del defecto de AC-MEAS-1 descrito en §0.
3. **Declara su límite en la propia salida.** Medir el tecleo sobre fixtures mide
   **la interacción con la interfaz**, no la operación real. Es un dato legítimo y
   **no valida H1**. Confundirlos sería la versión numérica del `6,2 s` inventado.

### Lo que este AC **no** necesita

**Medir no requiere `{{UMBRAL_H1_SEGUNDOS}}` ni
`{{LINEA_BASE_CUADERNO_SEGUNDOS}}`. Comparar sí.** Por eso D entrega el número y
**no** el veredicto sobre H1: la validación de la hipótesis sigue bloqueada por
dos decisiones humanas, y esta fase no las suple ni las inventa.

---

## 5. Lo que D no destraba

`OPERACION_REAL_HABILITADA=false` sigue en pie, y debe seguir: sin
`{{BASE_LICITUD}}` ni `{{PLAZO_RETENCION_PATENTE}}` no entra un solo vehículo
real. **D construye el instrumento y lo prueba sobre el banco; el numerador de
operación real sigue en cero hasta que esas dos decisiones se tomen.**

Decirlo así es el punto: hoy no hay ni instrumento ni datos. Al terminar D habrá
instrumento, y la única cosa que faltará será la decisión humana — que es donde
tiene que estar el bloqueo.
