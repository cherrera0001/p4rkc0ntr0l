# Casos de uso

> Derivados del código real y de `spec.md` §5–§6. **Un caso sin AC que lo
> verifique se marca como BRECHA, no como cerrado.**
>
> Fecha: 2026-08-13 · Árbol: commit `8c28d9a`

---

## Actores

| Actor | Qué puede hacer | Cómo se distingue |
|---|---|---|
| **Operador** | registrar ingreso, registrar salida, ver activas, cerrar sesión | `rol = 'operador'` en la cookie firmada (`src/lib/auth.ts:104`) |
| **Dueño** | ver ocupación e ingresos, comparar el descuadre, cerrar sesión | `rol = 'dueño'` |
| **Sistema (sincronización)** | subir la cola local, reconciliar activas, purgar el dispositivo | no es un usuario: corre en el cliente (`src/lib/cola-local.ts:201`) |

**El dueño no opera y el operador no observa.** Verificado en las dos
direcciones: el `GET /api/sesiones` exige rol operador (`src/app/api/sesiones/route.ts:43`)
y el panel del dueño redirige a quien no lo sea (`src/app/dueno/page.tsx:41`).

---

## CU-01 · Iniciar sesión

| | |
|---|---|
| **Actor** | operador o dueño |
| **Precondición** | el usuario existe en `usuario`; conoce `CLAVE_ACCESO` |
| **Flujo** | envía email + clave → el servidor compara en tiempo constante (`src/lib/auth.ts:113`) → emite cookie firmada con `exp` (`src/lib/sesion-token.ts:76`) → responde con el destino según rol |
| **Postcondición** | cookie `sesion` válida por 12 h (`src/lib/sesion-token.ts:30`) |
| **Implementación** | `src/app/api/login/route.ts:47` |
| **Verificado por** | `verificar:endurecimiento` (A-1: cookie con `exp`, carga manipulada y vencida rechazadas; C-1: ráfaga → 429) |

Nota de diseño: el login responde igual ante email inexistente y ante clave
incorrecta, para no filtrar qué emails existen. Y las comparaciones son por
huella HMAC, no por valor, para no filtrar el largo (hallazgo B-1).

---

## CU-02 · Registrar ingreso **sin conexión**

| | |
|---|---|
| **Actor** | operador |
| **Precondición** | sesión iniciada; la app cargada (con o sin red) |
| **Flujo** | toca *Nuevo ingreso* → se marca `tecleo_inicio_at` → teclea la patente → al confirmar se marca `tecleo_fin_at`, **se valida la patente** y **se evalúa la barrera de fixtures antes de escribir nada** (`src/app/pantalla-operador.tsx:310`) → se guarda en IndexedDB con `sync_estado='local'` → recién entonces se intenta la red |
| **Postcondición** | la sesión existe en el dispositivo aunque no haya red; aparece en la lista con su temporizador |
| **Implementación** | `src/app/pantalla-operador.tsx:294`, `src/lib/cola-local.ts:92` |
| **Verificado por** | `verificar:op1` (offline real por CDP), `verificar:a3` |

**El orden es el caso de uso.** Primero disco local, después red: eso es lo que
hace que el registro no dependa de la señal, y es lo que sostiene H1.

---

## CU-03 · Sincronizar al reconectar

| | |
|---|---|
| **Actor** | sistema |
| **Precondición** | hay sesiones con `sync_estado='local'` en el dispositivo |
| **Flujo** | evento `online` o tic de 30 s → se sube la cola de a una → el servidor resuelve por `id` (idempotente) → `sync_estado` pasa a `sincronizada` → se reconcilia la lista de activas |
| **Postcondición** | lo registrado sin red está en la base; nada se duplicó |
| **Implementación** | `src/app/pantalla-operador.tsx:218`, `src/lib/cola-local.ts:201` |
| **Verificado por** | `verificar:op1` (*"sincronizar de nuevo no duplica la sesión"*) |

Guarda de concurrencia: una sincronización a la vez, con repetición al final si
llega otro pedido (`src/app/pantalla-operador.tsx:218`). Sin ella, cada ingreso
lanzaba su propia sincronización y la cola entera se re-posteaba.

---

## CU-04 · Registrar salida y cobrar

| | |
|---|---|
| **Actor** | operador |
| **Precondición** | la sesión está `activa` **y pertenece al estacionamiento del operador**; **hay conexión** |
| **Flujo** | toca *Salida* → el servidor comprueba pertenencia (`src/app/api/sesiones/[id]/salida/route.ts:66`) → toma la tarifa vigente (`src/lib/contexto.ts:57`) → calcula el monto → cierra la sesión → el dispositivo **borra la patente en el acto** (`src/app/pantalla-operador.tsx:360`) |
| **Postcondición** | `estado='cerrada'`, `salida_at` y `monto_calculado` escritos; el operador ve el monto para cobrar **en efectivo, fuera del sistema** |
| **Implementación** | `src/app/api/sesiones/[id]/salida/route.ts:38` |
| **Verificado por** | `verificar:salida` (11/11), `verificar:m4` |

**Restricción declarada: la salida requiere red.** El monto se calcula en el
servidor con la tarifa vigente, porque un cliente que estuvo sin señal puede
tener una tarifa vieja y mostrar un monto equivocado al cobrar en efectivo es
peor que pedir señal un momento.

> **BRECHA DE ESPECIFICACIÓN.** Esta asimetría —ingreso offline sí, salida
> offline no— es una restricción de producto y **no está en `spec.md` §5**. Vive
> en `LEDGER.md` y en AC-UX-3 de la traducción del diseño. Una restricción que
> solo existe en un ledger es una restricción que el próximo lector no encuentra.

Cerrar dos veces devuelve lo mismo sin recalcular
(`src/app/api/sesiones/[id]/salida/route.ts:79`): el operador puede tocar
*Salida* de nuevo tras una reconexión sin que el monto cambie.

---

## CU-05 · Ver ocupación e ingresos del día

| | |
|---|---|
| **Actor** | dueño |
| **Precondición** | sesión iniciada con rol dueño |
| **Flujo** | abre `/dueno` → se cuenta `estado='activa'` de **su** estacionamiento → se suman los `monto_calculado` de las cerradas desde el inicio del día **en la zona del estacionamiento** (`src/app/dueno/page.tsx:23`) |
| **Postcondición** | ninguna: es lectura |
| **Implementación** | `src/app/dueno/page.tsx:38` |
| **Verificado por** | `verificar:meas2` (AC-MEAS-2, 10/10 end-to-end) |

---

## CU-06 · Hacer visible el descuadre

| | |
|---|---|
| **Actor** | dueño |
| **Precondición** | está en el panel |
| **Flujo** | cuenta los vehículos con los ojos → teclea el número → la app muestra la diferencia contra lo registrado |
| **Postcondición** | **ninguna: el conteo no se persiste** (`src/app/dueno/descuadre.tsx:26`) |
| **Implementación** | `src/app/dueno/descuadre.tsx:21` |
| **Verificado por** | `verificar:meas2` (*"el descuadre expone la diferencia entre lo contado y lo registrado"*) |

`spec.md` §6 dice que el panel no requiere tabla adicional. El panel **hace
visible** la diferencia y **no la impide**: registrar la sospecha como un hecho
sería inventar evidencia sobre una persona.

---

## CU-07 · Cerrar sesión en un dispositivo compartido

| | |
|---|---|
| **Actor** | operador o dueño |
| **Precondición** | sesión iniciada |
| **Flujo** | toca *Cerrar sesión* → **si quedan ingresos sin sincronizar, se niega y explica por qué** (`src/app/cerrar-sesion.tsx:36`) → si no, borra la cookie en el servidor y **vacía IndexedDB** (`src/app/cerrar-sesion.tsx:52`) → recarga completa |
| **Postcondición** | ni cookie ni patentes en el dispositivo |
| **Implementación** | `src/app/cerrar-sesion.tsx:31` |
| **Verificado por** | `verificar:endurecimiento` (INT-8: las dos pantallas tienen cierre de sesión) |

El turno entrante no hereda dato personal del saliente. Y la negativa cuando hay
pendientes protege AC-OP-1: ese registro existe **solo** ahí hasta que sube.

---

## CU-08 · Rechazar una patente real durante el piloto

| | |
|---|---|
| **Actor** | operador (intento) |
| **Precondición** | `OPERACION_REAL_HABILITADA=false` |
| **Flujo** | teclea una patente sin prefijo `FIXT` → **se rechaza en el cliente, antes de escribir en IndexedDB** (`src/app/pantalla-operador.tsx:310`) → el campo se limpia → el servidor mantiene la segunda barrera (`src/app/api/sesiones/route.ts:104`) |
| **Postcondición** | el dato **no se recolectó**: ni en el dispositivo ni en la base |
| **Implementación** | `src/lib/fixtures.ts:15` |
| **Verificado por** | `verificar:a3` (11/11 — verifica una **ausencia**) |

Bajo la Ley 21.719 recolectar y almacenar localmente ya es tratamiento. Rechazar
antes de persistir es la diferencia entre no tratar el dato y tratarlo mal.

---

## CU-09 · Purgar el dispositivo de lo que ya no está adentro

| | |
|---|---|
| **Actor** | sistema |
| **Precondición** | la app se abre, o se cierra una salida |
| **Flujo** | al abrir: purga las patentes reales atascadas de versiones anteriores (`src/lib/cola-local.ts:135`) y las no-activas (`src/lib/cola-local.ts:163`) → al cerrar una salida, borra esa sesión en el acto |
| **Postcondición** | el dispositivo conserva **solo** lo que está adentro del estacionamiento más lo pendiente de subir |
| **Implementación** | `src/app/pantalla-operador.tsx:248` |
| **Verificado por** | `verificar:m4` (29/29) |

---

## CU-10 · Medir H1 · **BRECHA**

| | |
|---|---|
| **Actor** | analista del piloto (**no existe en el sistema**) |
| **Precondición** | hay sesiones cerradas de operación real |
| **Flujo** | *no existe*. No hay consulta, ni pantalla, ni script que calcule la mediana de `tecleo_fin_at − tecleo_inicio_at` |
| **Postcondición** | — |
| **Implementación** | **NO CONSTRUIDO** |
| **Verificado por** | `verificar:meas1` comprueba que no haya **nulos**, no que haya **datos** |

> **BRECHA, y es la de fondo.** `spec.md` §6 define la métrica de H1 como
> `tecleo_fin_at − tecleo_inicio_at`, y el esquema la instrumenta correctamente
> (`src/db/schema.ts:123`). Pero:
>
> 1. **no hay consulta que la calcule** — la traducción del diseño lo anota como
>    *"derivable: falta la consulta, no el dato"*;
> 2. **no hay dato**: cada verificador de navegador limpia los fixtures al
>    iniciar (`scripts/lib/fixtures.mjs`), así que toda tanda termina en cero;
> 3. **no hay umbral**: `{{UMBRAL_H1_SEGUNDOS}}` y
>    `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` siguen sin definir.
>
> Estado: **ESPECIFICADO · INSTRUMENTADO · SIN DATOS**. El proyecto entero existe
> para probar o refutar H1 (`spec.md` §1) y H1 nunca se midió.

---

## CU-11 · Cargar o cambiar una tarifa · **BRECHA**

| | |
|---|---|
| **Actor** | dueño |
| **Precondición** | — |
| **Flujo** | *no existe en producto*. Hoy la tarifa se siembra por script (`scripts/sembrar.mjs`) |
| **Implementación** | **NO CONSTRUIDO** — es la maqueta `1e` |
| **Verificado por** | — |

> **BRECHA.** `spec.md` §4 modela `tarifa` con `vigente_desde`, y
> `obtenerTarifaVigente()` (`src/lib/contexto.ts:57`) resuelve el versionado. La
> mecánica existe; **la pantalla para usarla, no**. Un dueño no puede cambiar su
> propia tarifa sin que alguien corra un script.
>
> Agravante registrado: la maqueta `1e` que resolvería esto **contradice
> AC-OP-2** — su simulador calcula `18.667` donde el sistema cobra `19.000`,
> porque prorratea sin aplicar la fracción.

---

## CU-12 · Dar de baja a un operador · **BRECHA**

| | |
|---|---|
| **Actor** | dueño |
| **Flujo** | *no existe*. `usuario` no tiene estado (`src/db/schema.ts:50`) y borrar la fila lo impide la FK `sesion_vehiculo.operador_id` (`src/db/schema.ts:112`) |
| **Implementación** | **NO CONSTRUIDO** — maqueta `1f` |

> **BRECHA operativa real.** En un piloto donde los turnos comparten equipo, no
> hay forma de revocar el acceso de una persona. Es el candidato `usuario.estado`
> del `MER.md` §5.

---

## Resumen

| Caso | Estado |
|---|---|
| CU-01 … CU-09 | **construido y verificado con comando** |
| CU-04 | construido y verificado, con **brecha de especificación** (la asimetría offline no está en `spec.md`) |
| CU-10 medir H1 | **BRECHA** — especificado, instrumentado, sin datos ni consulta ni umbral |
| CU-11 tarifas | **BRECHA** — modelo listo, pantalla no |
| CU-12 baja de operador | **BRECHA** — falta modelo y pantalla |
