# Selección priorizada para el prototipo

> Cierra el **Ítem 3** del Trabajo 01 (3/10 en la medición del 2026-08-15).
>
> Fecha: 2026-08-15 · Árbol: `2c396c4` + el entregable 3 (numeración y traza).
>
> Se seleccionan **tres historias** de las diez de
> `docs/data/historias-usuario.md`. Las siete descartadas también se puntúan: una
> priorización que solo muestra a los ganadores no es una priorización.

---

## 0. El criterio se fija antes de mirar la lista

Esto va primero a propósito. Una rúbrica escrita después de conocer al ganador es
una racionalización, y este documento sería el peor lugar del repo para hacer eso.

**El ancla es `spec.md` §1:** *«El sistema existe para probar o refutar dos
hipótesis, no para lograr paridad de producto. El riesgo central es **adopción, no
escala**»*.

De ahí salen tres reglas de desempate, en este orden:

1. **Gana lo que mueve una hipótesis.** H1 (velocidad) y H2 (disposición a pagar)
   son el propósito; todo lo demás es producto. Una historia que no mueve ninguna
   de las dos no entra al prototipo aunque sea barata.
2. **La complejidad alta no descarta cuando la complejidad *es* la hipótesis.**
   Es la regla contraintuitiva y la que decide el caso más importante. Si se
   eligiera por facilidad, el prototipo dejaría fuera lo único que puede refutar
   H1 — y quedaría una demo que se cae en la vía, que es exactamente el escenario
   que `spec.md` §3 llama *«si la app se cae sin señal, muere la adopción»*.
3. **El prototipo tiene que cerrar un ciclo completo**, no exhibir pantallas. Un
   ingreso sin salida no produce monto; sin monto el dueño no tiene nada que
   mirar y H2 no se puede ni plantear.

### La rúbrica

| Eje | Qué mide | Escala |
|---|---|---|
| **Velocidad** | esfuerzo hasta tener algo usable por una persona real, no una demo | ALTA = días · MEDIA = una a dos semanas · BAJA = más, o bloqueada |
| **Importancia** | cuánta hipótesis mueve. **No** cuánto se luce | ALTA = es H1 o H2 · MEDIA = habilita a una de las dos · BAJA = producto |
| **Complejidad** | riesgo técnico y de datos personales, no líneas de código | ALTA = concurrencia, offline o dato personal · MEDIA = lógica de negocio · BAJA = lectura y render |

Las tres son **valoraciones**, no mediciones. Se escriben con palabras y no con
números para que nadie las lea como si salieran de un comando.

---

## 1. Los tres seleccionados

### 1.1 · H-01 — Registrar un ingreso sin señal

`docs/data/historias-usuario.md:21` · caso `docs/data/casos-uso.md:104`

| Eje | Valor | Por qué |
|---|---|---|
| Velocidad | **BAJA** | service worker, IndexedDB, cola, idempotencia y reconciliación. Es la más cara de las diez |
| Importancia | **ALTA** | **es H1 literal.** `spec.md` §1: *«un operador registra entrada + salida más rápido que en el cuaderno»* |
| Complejidad | **ALTA** | offline-first + dato personal en el dispositivo |

**Entra a pesar de puntuar peor en dos ejes de tres, y ése es el punto.** La
regla 2 se escribió para este caso. El operador registra de pie, con
conectividad intermitente; una versión que exija señal mediría la paciencia del
operador, no la velocidad del sistema. `spec.md` §3 lo declara *«offline-first (no
opcional)»* y `spec.md` §11 prohíbe tratarlo como opcional.

Si se pudiera construir una sola historia, sería ésta.

**H-02 viaja adentro y no se contabiliza aparte.** El temporizador se renderiza en
la misma fila de la misma lista (`src/app/pantalla-operador.tsx:555`, con
`duracion()` en `src/app/pantalla-operador.tsx:75`): no es una decisión de
construcción separable, es una columna. Y el intervalo que la hace avanzar sola
(`src/app/pantalla-operador.tsx:268`) **ya lo necesita H-01** para el refetch
periódico y el reintento de la cola. Sacarla no ahorra trabajo.

> **Lo que entra con ella, y hay que decirlo:** H-02 **no tiene verificador**.
> `verificar:temporizador` está vetado y AC-OP-3 no existe
> (`docs/data/historias-usuario.md:65`). Meterla dentro de H-01 importa a la
> historia insignia del prototipo un requisito que ningún comando sostiene. Se
> acepta a propósito, no en silencio.

### 1.2 · H-03 — Registrar la salida y ver el monto a cobrar

`docs/data/historias-usuario.md:69` · caso `docs/data/casos-uso.md:215`

| Eje | Valor | Por qué |
|---|---|---|
| Velocidad | **MEDIA** | una ruta y una función pura de tarificación — más lo que la ruta realmente lleva: pertenencia (`src/app/api/sesiones/[id]/salida/route.ts:66`), idempotencia (`:79`) y el acotado del reloj del cliente (`:99`) |
| Importancia | **ALTA** | cierra el ciclo. Sin salida no hay `monto_calculado`, y sin eso H2 no tiene insumo |
| Complejidad | **ALTA** | **por la propia escala: toca dato personal.** La ruta devuelve la patente al cliente (`src/app/api/sesiones/[id]/salida/route.ts:31`) y la historia exige borrarla del dispositivo en el acto |

> **Corrección del ciclo 1 de auditoría, registrada acá y no escondida:** esta
> fila decía **MEDIA**, puntuando solo la aritmética de fracción y mínimo. Contra
> la escala de §1 —*dato personal → ALTA*— era insostenible: H-03 es la única de
> las tres seleccionadas que **devuelve una patente**. La selección no cambia; lo
> que cambia es el riesgo declarado, que era justamente el punto del eje.

Es la mitad que la regla 3 vuelve obligatoria. Y es donde el prototipo entrega su
valor visible más barato: **el operador deja de calcular de cabeza.** El cobro
sigue siendo en efectivo y fuera del sistema (ADR-001), así que lo que se
construye es *mostrar el monto*, no cobrarlo.

> **Se selecciona con una decisión abierta adentro, y hay que decirlo antes de
> construir:** el monto crece con la duración del corte de señal, porque
> `salida_at` se calcula en el servidor al reconectar (`spec.md` §5). **El
> conductor paga la falta de señal.** Elegir cuál instante es el facturable es
> decisión del decisor — `{{INSTANTE_FACTURABLE}}`
> (`docs/data/historias-usuario.md:372`). El prototipo puede exhibirse con este
> comportamiento; lo que no puede es exhibirse sin declararlo.

### 1.3 · H-05 — Ver cuántos vehículos hay adentro ahora

`docs/data/historias-usuario.md:135` · caso `docs/data/casos-uso.md:274`

| Eje | Valor | Por qué |
|---|---|---|
| Velocidad | **ALTA** | dos consultas agregadas sobre datos que las otras dos historias ya escriben |
| Importancia | **ALTA** | es la primera evidencia de H2: *«ver ingresos y ocupación que hoy no puede verificar»* (`spec.md` §1) |
| Complejidad | **BAJA** | lectura y render, sin escritura ni dato nuevo |

Es la única de las tres que puntúa bien en los tres ejes, y aun así entra
**tercera**: sin H-01 y H-03 el panel muestra ceros. El orden importa tanto como
la lista.

`spec.md` §6 lo confirma como decisión de diseño: *«se alimenta de datos ya
registrados; no requiere tabla adicional»*. Cero costo de modelo, cero superficie
nueva de dato personal.

---

## 2. Qué se construye funcionalmente

La rebanada es **vertical y completa**, no tres pantallas sueltas:

| Pieza | Qué hace | Historia |
|---|---|---|
| Pantalla del operador — alta | *Nuevo ingreso* → patente → confirmar, escribiendo **primero en disco local y después en la red** | H-01 |
| Pantalla del operador — lista | activas del estacionamiento, con la duración de cada una y la marca de *sin sincronizar* | H-01 (+H-02) |
| Cola local + sincronización | IndexedDB con `sync_estado`, `id` generado en el cliente, subida idempotente al reconectar | H-01 |
| `POST /api/sesiones` | crea la sesión; deriva operador y estacionamiento **del usuario autenticado**, no del cuerpo | H-01 |
| Acción *Salida* | cierra la sesión y devuelve el monto calculado con la tarifa vigente **de la base** | H-03 |
| `POST /api/sesiones/[id]/salida` | comprueba pertenencia, calcula, persiste, y es idempotente al reintentar | H-03 |
| Panel del dueño | ocupación actual, capacidad y lugares libres de **su** estacionamiento | H-05 |
| Auth mínima de dos roles | precondición de todo lo anterior: el operador no ve el panel y el dueño no opera | — |

**Y qué NO se construye, para que el recorte sea decisión y no olvido:**

- **Ninguna pasarela de pago.** El cobro es en efectivo, fuera del sistema
  (ADR-001, `spec.md` §2). El prototipo *muestra* el monto.
- **Ningún LPR, reserva, barrera ni multisitio** — misma tabla de exclusión.
- **Ninguna pantalla de administración**: ni tarifas (H-08), ni alta de clientes
  (H-09), ni baja de usuarios (H-10). El alta la sigue haciendo un humano con
  `DATABASE_URL` (`scripts/sembrar.mjs:130`).

**La auth aparece en la tabla y no es una de las tres historias seleccionadas.**
Es precondición, no capacidad: `spec.md` §5 arranca con el operador *«ya
autenticado»*. Es el mismo hueco que `docs/data/casos-uso.md:522` declara para
CU-01 — hay caso de uso y no hay historia, y escribirla sería autorar un
requisito.

---

## 3. Las siete descartadas, con su puntaje

| Historia | Vel. | Imp. | Compl. | Por qué queda fuera |
|---|---|---|---|---|
| **H-02** temporizador (`docs/data/historias-usuario.md:47`) | ALTA | MEDIA | BAJA | **No se descarta: viaja dentro de H-01.** No es separable — es una columna de la misma lista |
| **H-04** entregar el turno (`docs/data/historias-usuario.md:108`) | MEDIA | MEDIA | ALTA | Es exigencia de la Ley 21.719 en dispositivo compartido, no de una hipótesis. **Imprescindible para operar de verdad; no para probar H1.** Fuera del recorte mínimo — aunque **ya está construida**: ver §4 |
| **H-06** ingresos del día (`docs/data/historias-usuario.md:159`) | ALTA | MEDIA | BAJA | Es H-05 más una suma y un corte por zona horaria. Barata, pero **redundante como evidencia**: si el dueño ya reacciona a la ocupación, H2 ya se movió. **Ya está construida**: ver §4 |
| **H-07** descuadre (`docs/data/historias-usuario.md:184`) | ALTA | MEDIA | BAJA | Misma razón que H-06, y no otra: H-05 ya mueve H2 y el descuadre **no agrega evidencia nueva sobre la hipótesis**. **Ya está construida**: ver §4 |
| **H-08** cambiar tarifa (`docs/data/historias-usuario.md:213`) | MEDIA | BAJA | MEDIA | Producto, no hipótesis: el versionado ya existe (`src/lib/contexto.ts:53`), falta la pantalla. Además su maqueta **contradice AC-OP-2** (`docs/data/casos-uso.md:453`), así que construirla mal es peor que no construirla |
| **H-09** alta de un cliente (`docs/data/historias-usuario.md:247`) | BAJA | BAJA | ALTA | **Bloqueada por alcance**: ADR-004 excluye por nombre la entidad `tenant` y el rol `plataforma`. Requiere ADR-005. Y es escala, que es justo el riesgo que `spec.md` §1 declara *secundario* |
| **H-10** revocar acceso (`docs/data/historias-usuario.md:278`) | MEDIA | BAJA | MEDIA | Falta la columna de estado (`src/db/schema.ts:50`) y falta decidir a quién le toca el acto — `{{ACTOR_BAJA_USUARIO}}` |

**El patrón de los descartes no es el costo: es la hipótesis.** H-06 y H-07 son
tan baratas como H-05 y quedan fuera igual, porque no agregan evidencia que H-05 no
dé antes. H-01 es la más cara de las diez y entra primera.

> **Razón de descarte corregida tras el ciclo 1 de auditoría.** Acá decía que
> H-07 *«no se puede demostrar sin datos de varios días»*. **Es falso contra el
> árbol**, y el auditor lo refutó **leyendo dos archivos** —no corriéndolos, y la
> palabra importa en un documento que acaba de aprender esa diferencia—: el
> descuadre es una
> comparación puntual que no persiste nada (`src/app/dueno/descuadre.tsx:30`, y
> su encabezado en `src/app/dueno/descuadre.tsx:12` lo declara decisión de
> minimización), y `verificar-meas2` lo demuestra **desde tabla vacía** —limpia
> los fixtures al arrancar y después asevera la diferencia
> (`scripts/verificar-meas2.mjs:231`)—. Se reemplazó por la razón verdadera, que
> además ya estaba escrita una fila más arriba para H-06. Una razón inventada que
> llega a la misma conclusión sigue siendo inventada.

---

## 4. Estado medido: la rebanada ya está construida — y la conclusión que eso obliga

Esto no es una selección hipotética, y ocultarlo sería el defecto que este repo
persigue. **Siete de las diez historias están construidas** — no solo las tres
seleccionadas.

| Historia | ¿Construida? | Verificada por |
|---|---|---|
| H-01 ingreso sin señal | **sí** | `verificar:op1` |
| H-02 temporizador | **sí** | **ninguno** — `verificar:temporizador` vetado, AC-OP-3 no existe |
| H-03 salida y monto | **sí** | `verificar:salida`, `npm test` |
| H-04 entregar el turno | **sí** | **a medias** — solo se comprueba que el botón exista (`docs/data/casos-uso.md:348`) |
| H-05 ocupación ahora | **sí** | `verificar:meas2` |
| H-06 ingresos del día | **sí** | `verificar:meas2` |
| H-07 descuadre | **sí** | `verificar:meas2` |
| H-08 cambiar tarifa | no | — |
| H-09 alta de un cliente | no | — |
| H-10 revocar acceso | no | — |

**`verificar:meas2` cubre tres historias, no una.** Atribuirlo solo a H-05 —como
hacía la primera versión de esta sección— le regalaba la evidencia al
seleccionado y se la escondía a los descartados, que es la forma de sesgo más
barata que puede tener una priorización.

**La consecuencia honesta: §3 no descarta cosas por construir; descarta cosas ya
desplegadas.** El recorte es de *qué exhibe y qué mide el prototipo*, no de qué
existe. Tres de las siete construidas —H-04, H-06 y H-07— quedan fuera del
recorte mínimo; H-02 entra dentro de H-01. Y eso
sigue siendo una decisión defendible bajo la regla 1 — pero es una decisión
distinta de la que un lector entendería si esta tabla no estuviera.

Lo medido **hoy**, en esta corrida, sobre el árbol que incluye este archivo:

```
$ npm test
ℹ tests 122 · ℹ suites 30 · ℹ pass 122 · ℹ fail 0     exit=0
$ npm run verificar:citas
23/23 comprobaciones PASS · CITAS: PASS               exit=0
$ npm run verificar:alcance
9/9 comprobaciones PASS · ALCANCE: PASS               exit=0
```

> **Este bloque decía `21/21`, y era un número viejo.** El 21/21 es de la
> iteración anterior, **antes de que este archivo existiera**; al escanearse a sí
> mismo el documento agrega dos comprobaciones y el total es 23. Se copió del
> ledger y se lo presentó bajo un prompt `$` como transcripción de hoy — dentro
> de la misma sección que declara que *«un PASS viejo no es una medición de
> hoy»*. Lo encontró el auditor re-corriendo el comando. Queda escrito porque el
> defecto no es el número: es haber escrito una transcripción sin correrla.

Lo **registrado y no re-corrido hoy** —exigen la app levantada y base, y un PASS
viejo no es una medición de hoy (`STATE.md`)—: `verificar:op1` 11/11 para H-01,
`verificar:salida` 11/11 para H-03, `verificar:meas2` 10/10 para H-05, H-06 y
H-07 juntas.

### La consecuencia incómoda, que es el hallazgo de este entregable

**El prototipo está completo como producto y vacío como instrumento.** Las tres
historias funcionan; la hipótesis que justifican **nunca se midió**.

- `spec.md` §6 define la métrica de H1 como `tecleo_fin_at − tecleo_inicio_at`.
- El esquema la instrumenta (`src/db/schema.ts:123`) y `AC-MEAS-1` pasa.
- **Pero AC-MEAS-1 verifica que no haya nulos, no que haya datos**, y cada
  verificador de navegador limpia sus fixtures al iniciar
  (`scripts/lib/fixtures.mjs`), así que el numerador queda en cero.
- No hay consulta que calcule la mediana, ni pantalla, ni actor que la mire:
  **CU-10 no tiene ni siquiera historia** (`docs/data/casos-uso.md:406`).
- Y no hay umbral: `{{UMBRAL_H1_SEGUNDOS}}` y `{{LINEA_BASE_CUADERNO_SEGUNDOS}}`
  siguen abiertos, así que *«más rápido que el cuaderno»* no tiene contra qué
  compararse.

Bajo la regla 1 —gana lo que mueve una hipótesis— **el siguiente incremento no es
una historia de esta lista: es el instrumento que le falta a H-01.** Está
especificado en `docs/SPEC-D-medicion-de-H1.md`. No se selecciona acá porque no
existe como historia, y escribirla sin el actor que la use sería inventar el
eslabón que falta en vez de nombrarlo.

---

## 5. Lo que esta selección no resuelve

Ningún placeholder se rellena. Los que esta selección toca directamente:

| Placeholder | Qué bloquea de estas tres historias |
|---|---|
| `{{UMBRAL_H1_SEGUNDOS}}` · `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` | H-01 se puede construir y **no se puede evaluar**: sin umbral no hay «validado» |
| `{{BASE_LICITUD}}` · `{{PLAZO_RETENCION_PATENTE}}` | H-01 y H-03 solo aceptan patentes de prueba. `OPERACION_REAL_HABILITADA=false`, y encenderlo es decisión humana |
| `{{INSTANTE_FACTURABLE}}` — **propuesto**, no está en `spec.md` §12 | H-03: quién paga el corte de señal. La decisión sí está escrita (`spec.md` §5); lo que no existe es el placeholder con ese nombre |
| `{{PRECIO_SUSCRIPCION_UF}}` | H-05 alimenta H2, y sin precio no hay nada que cobrar |

**Las tres historias seleccionadas se pueden construir hoy: ninguna de las filas
de arriba bloquea la construcción. Las cuatro bloquean el encendido o la
conclusión**, que no es lo mismo. Es la distinción que el proyecto ya aplicó en
FASE E — se construye el mecanismo parametrizado, y se lo enciende con una
decisión.

*(Acá decía «dos de las cuatro filas». Era precisión falsa: si las tres historias
se construyen hoy, entonces ninguna de las cuatro bloquea construir. El número
sonaba más medido de lo que era.)*
