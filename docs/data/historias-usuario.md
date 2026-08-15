# Historias de usuario

> **Derivadas, no inventadas.** Cada historia cita el fragmento de `spec.md` o
> del código del que sale. Ninguna introduce una necesidad que el proyecto no
> haya declarado antes: eso sería autorar requisitos, y eso lo decide el humano
> por ADR.
>
> Cierra el Ítem 2 del Trabajo 01 (0/80 en la medición del 2026-08-15).
>
> Fecha: 2026-08-15 · Árbol: `2c9e286`

**Formato:** `Como [rol], quiero [acción], para [fin]` + condición de
satisfacción comprobable anclada a un componente concreto. Una historia que no
pasa C1, C2 y C3 no se entrega: no existe *aprobada con reservas*.

**Alcance:** H-01 a H-08 están dentro de la v1. **H-09 y H-10 están fuera**, y se
escriben igual porque nombrar la brecha es el objetivo — ver §4.

---

## H-01 · Operador · Registrar un ingreso sin señal

> **Como** operador, **quiero** registrar la patente de un vehículo que entra
> aunque el teléfono no tenga señal, **para** no tener que volver al cuaderno de
> papel cada vez que se corta la conexión.

**Condición de satisfacción**

- **Dado** que estoy autenticado como operador y la app está cargada,
- **y** el dispositivo está sin red,
- **Cuando** toco *Nuevo ingreso*, tecleo una patente válida y confirmo,
- **Entonces** la sesión se escribe en IndexedDB con `syncEstado: "local"`
  **antes** de cualquier intento de red (`src/app/pantalla-operador.tsx:337`,
  `src/lib/cola-local.ts:92`),
- **y** el vehículo aparece en la lista sin esperar respuesta del servidor
  (`src/app/pantalla-operador.tsx:341`),
- **y** al recuperar la señal el registro sube y su `sync_estado` pasa a
  `sincronizada` sin duplicarse, porque el `uuid` lo genera el cliente
  (`src/app/pantalla-operador.tsx:324`).

**Componente:** pantalla del operador + `cola-local`.
**Origen:** `spec.md` §5 «Ingreso», pasos 1–4.
**Verificación existente:** `npm run verificar:op1` (AC-OP-1).

---

## H-02 · Operador · Ver cuánto lleva adentro cada vehículo

> **Como** operador, **quiero** ver el tiempo transcurrido de cada vehículo que
> está adentro, **para** saber cuánto lleva sin mirar la hora de entrada y restar
> de cabeza.

**Condición de satisfacción**

- **Dado** que hay al menos una sesión activa,
- **Cuando** miro la lista de la pantalla del operador,
- **Entonces** cada fila muestra la duración desde `entrada_at`
  (`src/app/pantalla-operador.tsx:75`, renderizada en
  `src/app/pantalla-operador.tsx:555`),
- **y** esa duración avanza mientras la pantalla sigue abierta, sin recargar.

**Componente:** función `duracion()` + lista de activas.
**Origen:** `spec.md` §5 «Permanencia» — *«El temporizador muestra el tiempo
transcurrido por cada sesión activa»*.
**Verificación:** ninguna vigente — `verificar:temporizador` está **vetado** y AC-OP-3 **no existe** (`docs/data/matriz-trazabilidad.md:96`).

---

## H-03 · Operador · Registrar la salida y ver el monto a cobrar

> **Como** operador, **quiero** registrar la salida de un vehículo y ver en
> pantalla el monto que tengo que cobrar, **para** cobrar en efectivo el valor
> correcto sin calcularlo yo.

**Condición de satisfacción**

- **Dado** un vehículo con sesión activa en mi estacionamiento **y hay
  conexión**,
- **Cuando** toco *Salida* sobre esa fila,
- **Entonces** el servidor comprueba que la sesión es de mi estacionamiento
  (`src/app/api/sesiones/[id]/salida/route.ts:66`), toma la tarifa vigente de la
  base (`src/app/api/sesiones/[id]/salida/route.ts:84`) y calcula el monto con
  `valor_hora`, `fraccion_minutos` y `monto_minimo`,
- **y** la pantalla me muestra ese monto para cobrarlo **en efectivo, fuera del
  sistema** (`src/app/pantalla-operador.tsx:361`),
- **y** el dispositivo borra la patente en el acto
  (`src/app/pantalla-operador.tsx:360`),
- **y** si vuelvo a tocar *Salida* sobre una sesión ya cerrada, el monto que veo
  es el mismo (`src/app/api/sesiones/[id]/salida/route.ts:79`),
- **y** sin conexión la salida **no** se registra: el vehículo queda `activa` y
  la app me dice que necesita red
  (`src/app/pantalla-operador.tsx:374`).

**Componente:** `POST /api/sesiones/[id]/salida` + pantalla del operador.
**Origen:** `spec.md` §5 «Salida y cálculo», pasos 1–3 y su nota de asimetría.
**Verificación existente:** `npm run verificar:salida` (AC-OP-4), `npm test`
(AC-OP-2).

> **Decisión humana abierta, declarada por `spec.md` §5 y no resuelta acá.** Si
> la señal se corta veinte minutos, el monto crece veinte minutos porque
> `salida_at` se calcula en el servidor al reconectar: **el conductor paga la
> falta de señal.** Corregirlo exige elegir cuál es el instante facturable, y esa
> elección es del decisor. Placeholder propuesto: `{{INSTANTE_FACTURABLE}}`.
> Esta historia describe el comportamiento **construido**, no el deseable.

---

## H-04 · Operador · Entregar el turno sin dejar patentes en el teléfono

> **Como** operador, **quiero** que al cerrar mi turno el dispositivo no conserve
> ninguna patente, **para** que quien toma el turno siguiente no vea los
> vehículos que registré yo.

**Condición de satisfacción**

- **Dado** que estoy autenticado en un dispositivo compartido,
- **Cuando** toco *Cerrar sesión* (`src/app/cerrar-sesion.tsx:27`),
- **Entonces**, si quedan ingresos sin sincronizar, **la sesión no se cierra** y
  se me explica por qué (`src/app/cerrar-sesion.tsx:36`),
- **y** si no quedan, se borra la cookie en el servidor y se vacía IndexedDB
  (`src/app/cerrar-sesion.tsx:52`),
- **y** la app recarga completa, de modo que las últimas salidas cobradas
  tampoco quedan en pantalla (`src/app/cerrar-sesion.tsx:58`).

**Componente:** `CerrarSesion` + `borrarTodo()` (`src/lib/cola-local.ts:121`).
**Origen:** `spec.md` §7 (minimización) y CU-07 (`docs/data/casos-uso.md:339`).

> **Brecha de verificación conocida, no de construcción.** Ningún comando asevera
> las tres partes: `verificar:endurecimiento` solo comprueba que el botón exista
> (`docs/data/casos-uso.md:348`). El código está y se lee bien; **nadie lo
> prueba.**

---

## H-05 · Dueño · Ver cuántos vehículos hay adentro ahora

> **Como** dueño, **quiero** ver en cualquier momento cuántos vehículos hay
> adentro y cuántos lugares quedan libres, **para** saber el estado de mi
> estacionamiento sin llamar al operador.

**Condición de satisfacción**

- **Dado** que tengo sesión con rol dueño,
- **Cuando** abro `/dueno`,
- **Entonces** veo el conteo de sesiones `activa` **de mi estacionamiento**, no
  de otro (`src/app/dueno/page.tsx:49`),
- **y** veo la capacidad total y los lugares libres
  (`src/app/dueno/page.tsx:76`),
- **y** quien no tiene rol dueño no llega a esta pantalla
  (`src/app/dueno/page.tsx:41`),
- **y** la visita no persiste nada.

**Componente:** panel del dueño, tarjeta *Ocupación ahora*.
**Origen:** `spec.md` §6 — *«Ocupación actual = sesiones `activa`»*.
**Verificación existente:** `npm run verificar:meas2` (AC-MEAS-2).

---

## H-06 · Dueño · Ver los ingresos observados del día

> **Como** dueño, **quiero** ver la suma de los montos calculados en las salidas
> de hoy, **para** tener una cifra contra la cual comparar la caja.

**Condición de satisfacción**

- **Dado** que tengo sesión con rol dueño,
- **Cuando** abro `/dueno`,
- **Entonces** veo la suma de `monto_calculado` de las sesiones cerradas desde la
  medianoche **en la zona horaria de mi estacionamiento**, no la del servidor
  (`src/app/dueno/page.tsx:23`, aplicada en `src/app/dueno/page.tsx:47`),
- **y** veo cuántas salidas componen esa cifra
  (`src/app/dueno/page.tsx:110`),
- **y** la pantalla dice explícitamente que son ingresos **observados**, no
  recaudados, porque el cobro es en efectivo y fuera del sistema
  (`src/app/dueno/page.tsx:117`).

**Componente:** panel del dueño, tarjeta *Ingresos observados hoy*.
**Origen:** `spec.md` §6 — *«Ingresos observados del período = suma de
`monto_calculado` de sesiones cerradas»*.
**Verificación existente:** `npm run verificar:meas2` (AC-MEAS-2).

---

## H-07 · Dueño · Comparar lo que cuento con lo que el sistema registró

> **Como** dueño, **quiero** teclear cuántos vehículos cuento en el patio y ver
> la diferencia contra lo registrado, **para** que un vehículo cobrado por fuera
> se me vuelva visible.

**Condición de satisfacción**

- **Dado** que estoy en el panel,
- **Cuando** escribo un entero mayor o igual a cero en el campo de conteo
  (`src/app/dueno/descuadre.tsx:43`),
- **Entonces** veo la diferencia `observada − registrada`, con mensaje distinto
  según sea cero, positiva o negativa (`src/app/dueno/descuadre.tsx:62`),
- **y** ni el conteo ni la diferencia se guardan en ninguna parte: viven en
  memoria mientras la pantalla está abierta
  (`src/app/dueno/descuadre.tsx:26`).

**Componente:** componente `Descuadre` del panel.
**Origen:** `spec.md` §6 — *«Descuadre visible: hace visible, sin impedirlo, que
un vehículo se cobre por fuera»*.
**Verificación existente:** `npm run verificar:meas2` (AC-MEAS-2).

> **La última condición es la historia, no un detalle.** Un descuadre persistido
> es una acusación con historia sobre una persona identificable —el operador de
> turno—. La no-persistencia es criterio de minimización bajo la Ley 21.719, no
> una omisión (`docs/data/flujos.md:189`).

---

## H-08 · Dueño · Cambiar la tarifa sin depender de un script — **BRECHA**

> **Como** dueño, **quiero** cargar una tarifa nueva con su fecha de vigencia
> desde el panel, **para** cambiar mis precios sin que alguien corra un script
> contra la base de datos.

**Condición de satisfacción**

- **Dado** que tengo sesión con rol dueño,
- **Cuando** cargo `valor_hora`, `fraccion_minutos`, `monto_minimo` y
  `vigente_desde` en la pantalla de tarifas,
- **Entonces** la tarifa anterior **no se pisa**: se conserva, para poder
  recalcular una salida vieja con la tarifa que regía entonces
  (`src/lib/contexto.ts:52`),
- **y** una salida registrada después de `vigente_desde` usa la nueva
  (`src/lib/contexto.ts:57`),
- **y** la base rechaza una `fraccion_minutos` de cero o un `valor_hora` negativo
  aunque la pantalla los deje pasar (`src/db/schema.ts:86`),
- **y** si la pantalla incluye un simulador, su resultado coincide **exactamente**
  con el que el sistema cobra.

**Componente:** pantalla de tarifas — **no construida**.
**Origen:** `src/db/schema.ts:65` — *«datos de operación que carga el dueño, NO
constantes de negocio»*.
**Estado:** CU-11 (`docs/data/casos-uso.md:430`). El modelo y el versionado
existen; la pantalla, no.

> **Riesgo ya medido, por eso la última condición es explícita:** la maqueta `1e`
> que resolvería esta historia calcula `18.667` donde el sistema cobra `19.000`
> (`docs/data/casos-uso.md:453`). Construirla sin esa condición metería en el
> producto una cifra que contradice AC-OP-2.

---

## H-09 · Administrador de plataforma · Dar de alta un estacionamiento cliente — **FUERA DE ALCANCE**

> **Como** administrador de plataforma de C4A, **quiero** dar de alta un
> estacionamiento cliente con su capacidad, su zona horaria, su tarifa inicial y
> sus usuarios, **para** que un negocio nuevo empiece a operar sin que nadie con
> credenciales de base de datos corra un script.

**Condición de satisfacción**

- **Dado** que soy un usuario con rol de plataforma —**rol que hoy no existe**:
  el enum tiene dos valores (`src/db/schema.ts:31`)—,
- **Cuando** completo el alta en la pantalla de aprovisionamiento,
- **Entonces** quedan creados el `estacionamiento` con `capacidad_total > 0` y
  `zona_horaria`, su primera `tarifa`, y al menos un usuario `dueño` y un
  `operador`,
- **y** los campos que se capturan del cliente se limitan a los que el producto
  usa: ninguno «por si sirve» (`spec.md` §4),
- **y** ningún dato de un cliente resulta legible desde otro,
- **y** existe un control **negativo** que lo prueba: un usuario del cliente A
  pidiendo un recurso del cliente B no lo obtiene. Hoy **ese control no existe**
  para ningún camino (ver `docs/data/actores.md` §3).

**Componente:** pantalla de aprovisionamiento — **no construida**.
**Quién lo hace hoy:** `scripts/sembrar.mjs:130`, `scripts/sembrar.mjs:151`,
`scripts/sembrar.mjs:176`, ejecutados a mano.
**Estado de alcance:** **BLOQUEADA.** `docs/adr/ADR-004-multisitio-y-suscripcion.md:35`
excluye por nombre la entidad `tenant` y el rol `plataforma`. Requiere un ADR
nuevo, que es el entregable siguiente.

---

## H-10 · Administrador de plataforma · Revocar el acceso de una persona — **FUERA DE ALCANCE**

> **Como** administrador de plataforma, **quiero** revocar el acceso de un
> operador que dejó de trabajar en un estacionamiento, **para** que su cuenta
> deje de entrar sin perder las sesiones que registró.

**Condición de satisfacción**

- **Dado** un operador con sesiones ya registradas a su nombre,
- **Cuando** lo doy de baja,
- **Entonces** su siguiente petición no autentica, porque el rol y el
  estacionamiento se releen de la base en cada petición
  (`src/lib/auth.ts:28`) — **el mecanismo de corte ya existe**,
- **y** sus sesiones históricas se conservan: la baja es un cambio de estado y no
  un borrado, porque la FK `sesion_vehiculo.operador_id`
  (`src/db/schema.ts:112`) impide eliminar la fila,
- **y** la baja no requiere tocar la base a mano.

**Componente:** administración de usuarios — **no construida**.
**Estado:** CU-12 (`docs/data/casos-uso.md:457`). Falta la columna de estado:
`usuario` no la tiene (`src/db/schema.ts:50`).
**Decisión abierta:** CU-12 le asigna el acto al **dueño**; esta historia lo
asigna a plataforma. A quién corresponde es decisión humana —
`{{ACTOR_BAJA_USUARIO}}`.

---

## 2. Autovalidación C1–C5

Rúbrica de la medición del 2026-08-15. **C1, C2 y C3 son vetantes.** C4 marca lo
que no cumple INVEST sin vetar. C5 exige función, no rendimiento.

| ID | C1 1.ª persona | C2 condición comprobable | C3 anclaje material | C4 INVEST — no cumple | C5 función | Veredicto |
|---|---|---|---|---|---|---|
| H-01 | PASA | PASA | PASA | — | PASA | **ACEPTADA** |
| H-02 | PASA | PASA | PASA | **Independiente** — necesita datos de H-01 | PASA | **ACEPTADA** |
| H-03 | PASA | PASA | PASA | **Independiente** — necesita datos de H-01 | PASA | **ACEPTADA** |
| H-04 | PASA | PASA | PASA | — (testeable, hoy sin test) | PASA | **ACEPTADA** |
| H-05 | PASA | PASA | PASA | **Independiente** — necesita datos de H-01 | PASA | **ACEPTADA** |
| H-06 | PASA | PASA | PASA | **Independiente** — necesita datos de H-03 | PASA | **ACEPTADA** |
| H-07 | PASA | PASA | PASA | **Independiente** — consume la ocupación de H-05 | PASA | **ACEPTADA** |
| H-08 | PASA | PASA | PASA | — | PASA | **ACEPTADA** |
| H-09 | PASA | PASA | PASA | **Pequeña**, **Estimable** — arrastra modelo de aislamiento y aprovisionamiento; es épica, no historia | PASA | **ACEPTADA, con marca** |
| H-10 | PASA | PASA | PASA | **Independiente** — depende del rol que crea H-09 | PASA | **ACEPTADA** |

**10 aceptadas · 0 vetadas.** Ninguna condición de satisfacción menciona tiempo,
carga ni volumen: los umbrales de H1 son `{{UMBRAL_H1_SEGUNDOS}}` y
`{{LINEA_BASE_CUADERNO_SEGUNDOS}}`, siguen sin resolver y **no se inventan acá**.

---

## 3. Cobertura contra `spec.md`

| Fuente | Historia |
|---|---|
| §5 Ingreso (pasos 1–4) | H-01 |
| §5 Permanencia | H-02 |
| §5 Salida y cálculo | H-03 |
| §6 Ocupación actual | H-05 |
| §6 Ingresos observados | H-06 |
| §6 Descuadre visible | H-07 |
| §7 Minimización en dispositivo compartido | H-04 |
| §4 `tarifa` con `vigente_desde` | H-08 |
| — **sin fuente en `spec.md`** | **H-09, H-10** |

**Las dos últimas filas son el hallazgo.** No tienen origen en `spec.md` porque
el actor que las necesita nunca se documentó. No es que falte la pantalla: falta
el eslabón entero —historia, spec y código— y por eso el remedio es un ADR, no un
sprint.

---

## 4. Dos brechas distintas, dos remedios distintos

Conviene no confundirlas, porque cuestan cosas diferentes:

| Tipo | Cuáles | Qué falta | Remedio |
|---|---|---|---|
| **Deuda documental** — construido y verificado, sin historia detrás | H-01, H-03, H-05, H-06, H-07 | solo la historia | **saldada**, y los CU quedaron trazados en `docs/data/casos-uso.md:483` |
| **Deuda documental con verificación incompleta** | H-04, **H-02** | la historia (saldada) **y** el comando que la pruebe | H-04: escribir el verificador de CU-07. **H-02: `verificar:temporizador` está vetado y AC-OP-3 no existe** — ver la línea 65 |
| **Deuda de producto, dentro de alcance** | H-08 | la pantalla; el modelo ya está | construible sin ADR nuevo |
| **Vacío real, fuera de alcance** | H-09, H-10 | historia (saldada), ADR, spec y código | ADR-005 → SPEC del panel → recién ahí construir |

---

## 5. Placeholders abiertos que estas historias tocan

Ninguno se rellena. Tres ya existían; dos se proponen nuevos.

| Placeholder | Estado | Qué bloquea acá |
|---|---|---|
| `{{BASE_LICITUD}}` | abierto, `spec.md` §12 | operar con patentes reales — toda H-01/H-03 |
| `{{PLAZO_RETENCION_PATENTE}}` | abierto, `spec.md` §12 | INT-7; se multiplica por cliente si se construye H-09 |
| `{{UMBRAL_H1_SEGUNDOS}}` | abierto, `spec.md` §12 | ninguna condición de satisfacción de acá, a propósito |
| `{{INSTANTE_FACTURABLE}}` | **propuesto** | H-03: quién paga el corte de señal. `spec.md` §5 declara la decisión, sin nombre de placeholder |
| `{{ACTOR_BAJA_USUARIO}}` | **propuesto** | H-10: CU-12 dice dueño, la historia dice plataforma |
| `{{PLAZO_RETENCION_USUARIO}}` | **propuesto** | `usuario.email` es dato personal y no tiene plazo declarado (ver `docs/data/actores.md` §5) |
