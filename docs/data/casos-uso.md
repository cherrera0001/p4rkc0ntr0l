# Casos de uso

> Derivados del código real y de `spec.md` §5–§6. **Un caso sin AC que lo
> verifique se marca como BRECHA, no como cerrado.**
>
> Fecha: 2026-08-15 · Árbol: commit `2c396c4`
>
> Revisión de esta fecha: los flujos se numeran con la forma de `spec.md` §5,
> cada caso traza a su historia de `docs/data/historias-usuario.md`, y CU-08 pasa
> a ser el flujo de excepción de CU-02. La primera versión (2026-08-13, árbol
> `8c28d9a`) describía los flujos en prosa corrida: se podía leer, no se podía
> citar un paso.

---

## 0. Qué entrega este documento

**Nueve flujos numerados** (§2) y **tres brechas que no se numeran** (§3).

| | Cuáles | Por qué |
|---|---|---|
| **Numerados** | CU-01 · CU-02 (con su excepción **E1**, ex CU-08) · CU-03 · CU-04 · CU-05 · CU-06 · CU-07 · CU-09 | están construidos: cada paso cita el `archivo:línea` que lo ejecuta |
| **No numerados** | CU-10 · CU-11 · CU-12 | **no hay flujo que numerar.** Numerar los pasos de algo no construido es escribir el deseo con forma de descripción |

**La cuenta, dicha una sola vez y sin ambigüedad: ocho casos numerados —CU-01,
CU-02, CU-03, CU-04, CU-05, CU-06, CU-07, CU-09— más el flujo de excepción E1 de
CU-02 = nueve flujos numerados.** §2 tiene ocho subsecciones porque E1 vive
adentro de CU-02, que es donde el contrato pide que viva. Se dice el número
explícitamente porque la cuenta cambió y la diferencia importa: eran doce
entradas de igual jerarquía, y tres de ellas no tenían nada que describir.

**CU-08 dejó de ser un caso aparte.** Rechazar una patente real no es un objetivo
que el operador persiga: es la excepción que corta el ingreso de CU-02 **antes de
persistir**. Como caso independiente sugería un flujo alternativo que el operador
elige, y no lo es. Su identificador se conserva en §2.2 como puntero **por
legibilidad del historial, no porque otro documento lo cite** — está medido ahí.

Regla de numeración, tomada de `spec.md` §5 *«Ingreso»*: **un paso es un acto
discreto y citable.** Sin saltos en la secuencia, y sin pasos que el código no
ejecute.

**Lo que este documento no hace:** no introduce comportamiento. Cada paso
numerado describe algo que ya está en el árbol o algo cuya ausencia se declara
como brecha. Autorar requisitos va por ADR (`spec.md` §9).

---

## 1. Actores

| Actor | Qué puede hacer | Cómo se distingue |
|---|---|---|
| **Operador** | registrar ingreso, registrar salida, ver activas, cerrar sesión | `rol = 'operador'`, **releído de la base en cada petición** y no creído de la cookie (`src/lib/auth.ts:95`) |
| **Dueño** | ver ocupación e ingresos, comparar el descuadre, cerrar sesión | `rol = 'dueño'` |
| **Sistema (sincronización)** | subir la cola local, reconciliar activas, purgar el dispositivo | no es un usuario: corre en el cliente (`src/lib/cola-local.ts:201`) |

**El dueño no opera y el operador no observa.** Verificado en las dos
direcciones: el `GET /api/sesiones` exige rol operador (`src/app/api/sesiones/route.ts:43`)
y el panel del dueño redirige a quien no lo sea (`src/app/dueno/page.tsx:41`).

El inventario completo —incluido **el actor que no existe**, quien aprovisiona un
estacionamiento cliente— está en `docs/data/actores.md`, con su prueba de
ausencia.

---

## 2. Los nueve flujos numerados — ocho casos y una excepción

### 2.1 · CU-01 · Iniciar sesión

| | |
|---|---|
| **Actor** | operador o dueño |
| **Precondición** | el usuario existe en `usuario`; conoce `CLAVE_ACCESO` |
| **Historia(s)** | **ninguna.** Ver la brecha de traza en §4.2 |
| **Postcondición** | cookie `sesion` válida por 12 h (`src/lib/sesion-token.ts:30`) |
| **Implementación** | `src/app/api/login/route.ts:47` |
| **Verificado por** | `verificar:endurecimiento` (A-1: cookie con `exp`, carga manipulada y vencida rechazadas; C-1: ráfaga → 429) |

**Flujo**

1. El usuario envía email y clave al `POST /api/login` (`src/app/api/login/route.ts:47`).
2. El servidor consulta el limitador de intentos **antes** de tocar la base y de
   comparar la clave, para que un intento frenado no cueste una consulta ni dé
   señal de temporización (`src/app/api/login/route.ts:71`).
3. Compara la clave compartida del piloto en tiempo constante (`src/lib/auth.ts:113`).
4. Busca la fila del usuario por email normalizado (`src/app/api/login/route.ts:79`).
5. Si falta cualquiera de las dos —fila o clave— responde lo mismo, `401`, y
   registra el fallo en el limitador (`src/app/api/login/route.ts:84`).
6. Si las dos están, limpia el historial de intentos del que acaba de entrar
   (`src/app/api/login/route.ts:97`) y emite la cookie firmada con `iat`/`exp`
   (`src/lib/sesion-token.ts:76`).
7. Responde con el destino según el rol: `/dueno` o `/`
   (`src/app/api/login/route.ts:108`).

Nota de diseño: el login responde igual ante email inexistente y ante clave
incorrecta, para no filtrar qué emails existen. Y las comparaciones son por
huella HMAC, no por valor, para no filtrar el largo (hallazgo B-1).

En cada petición posterior el rol y el estacionamiento **se releen de la base**,
no se creen de la cookie (`src/lib/auth.ts:88`).

---

### 2.2 · CU-02 · Registrar ingreso **sin conexión**

| | |
|---|---|
| **Actor** | operador |
| **Precondición** | sesión iniciada; la app cargada (con o sin red) |
| **Historia(s)** | **H-01** (`docs/data/historias-usuario.md:21`) |
| **Postcondición** | la sesión existe en el dispositivo aunque no haya red; aparece en la lista con su temporizador |
| **Implementación** | `src/app/pantalla-operador.tsx:294`, `src/lib/cola-local.ts:92` |
| **Verificado por** | `verificar:op1` (offline real por CDP), `verificar:a3` |

**Flujo principal**

1. El operador toca *Nuevo ingreso*: se marca `tecleo_inicio_at` en el cliente,
   **en ese acto y no al confirmar** (`src/app/pantalla-operador.tsx:280`).
2. Teclea la patente y confirma (`src/app/pantalla-operador.tsx:294`).
3. Se valida y normaliza la patente; si no es válida, el flujo termina acá con el
   motivo en pantalla (`src/app/pantalla-operador.tsx:297`).
4. **Se evalúa la barrera de fixtures antes de escribir nada.** Si la patente no
   es de prueba y el piloto no habilitó operación real, se va al flujo de
   excepción **E1** (`src/app/pantalla-operador.tsx:310`).
5. Se arma la sesión con `id` generado en el cliente, `tecleo_fin_at`,
   `estado='activa'` y `sync_estado='local'` (`src/app/pantalla-operador.tsx:323`).
6. Se guarda en IndexedDB (`src/lib/cola-local.ts:92`), invocado en
   `src/app/pantalla-operador.tsx:337`.
7. La fila aparece en la lista con lo local, sin esperar al servidor
   (`src/app/pantalla-operador.tsx:341`).
8. **Recién entonces** se intenta la red, sin bloquear la pantalla
   (`src/app/pantalla-operador.tsx:343`). Sigue en CU-03.

**El orden es el caso de uso.** Primero disco local, después red: eso es lo que
hace que el registro no dependa de la señal, y es lo que sostiene H1. El `id` lo
genera el cliente (paso 5) porque sin eso una reconexión inestable duplica
sesiones en cada reintento.

#### Flujo de excepción **E1** — patente real durante el piloto *(ex CU-08)*

| | |
|---|---|
| **Actor** | operador (intento) |
| **Dispara en** | paso 4 del flujo principal |
| **Precondición** | `OPERACION_REAL_HABILITADA=false` |
| **Historia(s)** | **ninguna.** Ver §4.2 |
| **Criterio que lo exige** | AC-PDP-1 (`spec.md` §9) |
| **Postcondición** | el dato **no se recolectó**: ni en el dispositivo ni en la base |
| **Implementación** | `src/lib/fixtures.ts:15` |
| **Verificado por** | `verificar:a3` (11/11 — verifica una **ausencia**) |

1. La patente normalizada no empieza con el prefijo de fixture
   (`src/lib/fixtures.ts:15`).
2. El cliente corta **antes** de `guardar()`: nada llega a IndexedDB
   (`src/app/pantalla-operador.tsx:310`).
3. Se muestra el motivo y **se limpia el campo**: si era una patente real,
   tampoco tiene por qué quedar a la vista (`src/app/pantalla-operador.tsx:317`).
4. Si la petición llegara igual al servidor —cliente eludido—, la segunda barrera
   responde `403` (`src/app/api/sesiones/route.ts:104`).

Bajo la Ley 21.719 recolectar y almacenar localmente ya es tratamiento. Rechazar
antes de persistir es la diferencia entre no tratar el dato y tratarlo mal. Por
eso la barrera del cliente no es redundante con la del servidor: la del servidor
llega tarde.

> **CU-08 vive acá.** Como caso independiente sugería un camino que el operador
> elige, y es lo contrario: es el camino que el sistema le impone.
>
> El identificador se conserva como puntero por legibilidad del historial, **no
> porque otros documentos lo citen**. Medido antes de escribirlo, que es lo que
> faltó en la primera versión de esta nota:
>
> ```
> $ git grep -l "CU-08" HEAD
> HEAD:docs/data/casos-uso.md        <- un archivo, y es éste mismo
> ```

---

### 2.3 · CU-03 · Sincronizar al reconectar

| | |
|---|---|
| **Actor** | sistema |
| **Precondición** | hay sesiones con `sync_estado='local'` en el dispositivo |
| **Historia(s)** | **H-01**, última condición de satisfacción (`docs/data/historias-usuario.md:37`) |
| **Postcondición** | lo registrado sin red está en la base; nada se duplicó |
| **Implementación** | `src/app/pantalla-operador.tsx:218`, `src/lib/cola-local.ts:201` |
| **Verificado por** | `verificar:op1` (*"sincronizar de nuevo no duplica la sesión"*) |

**Flujo**

1. Dispara el evento `online`, el tic periódico, o el ingreso recién guardado
   (`src/app/pantalla-operador.tsx:343`).
2. La guarda de concurrencia deja pasar **una sola** sincronización; si llega
   otro pedido mientras hay una en curso, se repite al final en vez de correr en
   paralelo (`src/app/pantalla-operador.tsx:219`).
3. Se sube la cola local y el servidor resuelve por `id`, de forma idempotente
   (`src/app/pantalla-operador.tsx:227`).
4. Lo que el servidor rechaza se borra del dispositivo y se avisa: hay que
   registrarlo de nuevo (`src/app/pantalla-operador.tsx:228`).
5. `sync_estado` pasa a `sincronizada` y se reconcilia la lista de activas contra
   el servidor (`src/lib/cola-local.ts:201`).

Sin la guarda del paso 2, cada ingreso lanzaba su propia sincronización y la cola
entera se re-posteaba: una patente llegó a postearse cuatro veces
(`src/app/pantalla-operador.tsx:214`).

La reconciliación del paso 5 **no escribe patentes reales en el dispositivo ni
viniendo del servidor**: la barrera de A-3 vale también para esa puerta
(`src/lib/cola-local.ts:206`).

---

### 2.4 · CU-04 · Registrar salida y cobrar

| | |
|---|---|
| **Actor** | operador |
| **Precondición** | la sesión está `activa` **y pertenece al estacionamiento del operador**; **hay conexión** |
| **Historia(s)** | **H-03** (`docs/data/historias-usuario.md:69`) |
| **Postcondición** | `estado='cerrada'`, `salida_at` y `monto_calculado` escritos; el operador ve el monto para cobrar **en efectivo, fuera del sistema** |
| **Implementación** | `src/app/api/sesiones/[id]/salida/route.ts:38` |
| **Verificado por** | `verificar:salida` (11/11), `verificar:m4` |

**Flujo**

1. El operador toca *Salida* sobre una fila activa; el cliente postea a
   `/api/sesiones/[id]/salida` (`src/app/api/sesiones/[id]/salida/route.ts:38`).
2. El servidor exige rol operador y valida la forma del `id`
   (`src/app/api/sesiones/[id]/salida/route.ts:49`).
3. **Comprueba pertenencia**: busca la sesión por `id` **y** por
   `estacionamiento_id` del usuario autenticado
   (`src/app/api/sesiones/[id]/salida/route.ts:66`). Un id de otro
   estacionamiento responde `404`, igual que uno inexistente
   (`src/app/api/sesiones/[id]/salida/route.ts:73`).
4. Si la sesión ya estaba cerrada, devuelve lo mismo sin recalcular
   (`src/app/api/sesiones/[id]/salida/route.ts:79`).
5. Fija `salida_at = ahora` y toma la **tarifa vigente de la base**
   (`src/app/api/sesiones/[id]/salida/route.ts:84`).
6. Acota la entrada al rango facturable antes de calcular, para que un teléfono
   con el reloj adelantado no deje la sesión sin forma de cerrarse (INT-14)
   (`src/app/api/sesiones/[id]/salida/route.ts:99`).
7. Calcula el monto y escribe en una sola sentencia `salida_at`,
   `monto_calculado`, `estado='cerrada'` **y `sync_estado='sincronizada'`**
   —este último no está en la postcondición de arriba y sí en el `UPDATE`—,
   acotando otra vez por pertenencia, y responde con la fila cerrada
   (`src/app/api/sesiones/[id]/salida/route.ts:112`).
8. El dispositivo anota el cierre y **borra la patente en el acto**
   (`src/app/pantalla-operador.tsx:360`).
9. La pantalla muestra el monto para cobrar en efectivo, **en memoria y no en el
   dispositivo** (`src/app/pantalla-operador.tsx:361`).
10. Sin conexión, el paso 1 falla y el vehículo **queda activo** con el aviso de
    que la salida necesita red (`src/app/pantalla-operador.tsx:374`).

**Restricción declarada: la salida requiere red.** El monto se calcula en el
servidor con la tarifa vigente, porque un cliente que estuvo sin señal puede
tener una tarifa vieja y mostrar un monto equivocado al cobrar en efectivo es
peor que pedir señal un momento. Desde el 2026-08-14 esta asimetría **sí** está
en `spec.md` §5, junto con su consecuencia: el paso 5 calcula `salida_at = ahora`
en el servidor, así que **el monto crece con la duración del corte de señal y el
conductor paga la falta de señal**. Es decisión abierta, no defecto de
implementación — `{{INSTANTE_FACTURABLE}}` en `docs/data/historias-usuario.md:372`.

La idempotencia del paso 4 cubre otro caso: volver a tocar *Salida* sobre una
sesión **ya cerrada**, cuando la respuesta se perdió.

> **Brecha de verificación que sobrevive.** Ningún comando ejercita el paso 10:
> `verificar:salida` es puramente en línea y `verificar:op1` no toca la salida.
> La degradación sin red está descrita y no está probada.

---

### 2.5 · CU-05 · Ver ocupación e ingresos del día

| | |
|---|---|
| **Actor** | dueño |
| **Precondición** | sesión iniciada con rol dueño |
| **Historia(s)** | **H-05** (`docs/data/historias-usuario.md:135`) y **H-06** (`docs/data/historias-usuario.md:159`) |
| **Postcondición** | ninguna: es lectura, y no persiste nada |
| **Implementación** | `src/app/dueno/page.tsx:38` |
| **Verificado por** | `verificar:meas2` (AC-MEAS-2, 10/10 end-to-end) |

**Flujo**

1. El dueño abre `/dueno`; quien no tenga ese rol es redirigido
   (`src/app/dueno/page.tsx:41`).
2. Se resuelve **su** estacionamiento a partir del usuario autenticado, no la
   primera fila de la tabla (hallazgo M-2) (`src/app/dueno/page.tsx:46`).
3. Se calcula el inicio del día **en la zona horaria del estacionamiento**, no la
   del servidor (`src/app/dueno/page.tsx:23`).
4. Se cuentan las sesiones `activa` de ese estacionamiento
   (`src/app/dueno/page.tsx:49`).
5. Se suman los `monto_calculado` de las cerradas desde ese corte, con su conteo
   de salidas (`src/app/dueno/page.tsx:61`).
6. Se muestran ocupación, capacidad y lugares libres
   (`src/app/dueno/page.tsx:76`), la cifra de ingresos
   (`src/app/dueno/page.tsx:106`) y cuántas salidas la componen
   (`src/app/dueno/page.tsx:110`).
7. La pantalla dice explícitamente que son ingresos **observados**, no
   recaudados, porque el cobro ocurre fuera del sistema
   (`src/app/dueno/page.tsx:117`).

---

### 2.6 · CU-06 · Hacer visible el descuadre

| | |
|---|---|
| **Actor** | dueño |
| **Precondición** | está en el panel |
| **Historia(s)** | **H-07** (`docs/data/historias-usuario.md:184`) |
| **Postcondición** | **ninguna: el conteo no se persiste** (`src/app/dueno/descuadre.tsx:26`) |
| **Implementación** | `src/app/dueno/descuadre.tsx:21` |
| **Verificado por** | `verificar:meas2` (*"el descuadre expone la diferencia entre lo contado y lo registrado"*) |

**Flujo**

1. El panel le pasa al componente la ocupación **registrada**
   (`src/app/dueno/page.tsx:115`).
2. El dueño cuenta los vehículos con los ojos y teclea el número
   (`src/app/dueno/descuadre.tsx:43`).
3. Se acepta solo un entero mayor o igual a cero
   (`src/app/dueno/descuadre.tsx:29`).
4. Se muestra la diferencia `observada − registrada`, con mensaje distinto según
   sea cero, positiva o negativa (`src/app/dueno/descuadre.tsx:62`).
5. Ni el conteo ni la diferencia se guardan: viven en memoria mientras la
   pantalla está abierta (`src/app/dueno/descuadre.tsx:26`).

`spec.md` §6 dice que el panel no requiere tabla adicional. El panel **hace
visible** la diferencia y **no la impide**: el paso 5 es el caso de uso, no un
detalle de implementación. Un descuadre persistido es una acusación con historia
sobre una persona identificable —el operador de turno—, y eso sería inventar
evidencia sobre una persona.

---

### 2.7 · CU-07 · Cerrar sesión en un dispositivo compartido

| | |
|---|---|
| **Actor** | operador o dueño |
| **Precondición** | sesión iniciada |
| **Historia(s)** | **H-04** (`docs/data/historias-usuario.md:108`) |
| **Postcondición** | ni cookie ni patentes en el dispositivo |
| **Implementación** | `src/app/cerrar-sesion.tsx:31` |
| **Verificado por** | **PARCIALMENTE.** `verificar:endurecimiento` (INT-8) comprueba solo que el botón exista en las dos pantallas |

**Flujo**

1. El usuario toca *Cerrar sesión* (`src/app/cerrar-sesion.tsx:31`).
2. Se consulta si quedan ingresos sin sincronizar
   (`src/app/cerrar-sesion.tsx:35`).
3. **Si quedan, la sesión no se cierra** y se explica por qué: ese registro
   existe solo en el dispositivo hasta que sube (`src/app/cerrar-sesion.tsx:36`).
4. Si no quedan, se borra la cookie en el servidor con `DELETE /api/login`
   (`src/app/cerrar-sesion.tsx:44`).
5. **Después** de que el servidor confirma —no antes— se vacía IndexedDB
   (`src/app/cerrar-sesion.tsx:52`).
6. Se recarga completo con `location.assign`, no con navegación de cliente,
   porque en el estado en memoria de React viven las últimas salidas cobradas con
   sus patentes (`src/app/cerrar-sesion.tsx:58`).

**Brecha de verificación, no de construcción.** Ningún comando asevera los pasos
3, 5 ni 6. El código está y se lee bien; **nadie lo prueba**. El paso 3 protege
AC-OP-1 y el paso 6 es el que impide que el turno entrante herede dato personal
del saliente.

---

### 2.8 · CU-09 · Purgar el dispositivo de lo que ya no está adentro

| | |
|---|---|
| **Actor** | sistema |
| **Precondición** | la app se abre, o se cierra una salida |
| **Historia(s)** | **H-03**, parcial — solo el borrado al cerrar la salida (`docs/data/historias-usuario.md:86`). La purga al abrir **no tiene historia**: ver §4.2 |
| **Postcondición** | el dispositivo conserva **solo** lo que está adentro del estacionamiento más lo pendiente de subir |
| **Implementación** | `src/app/pantalla-operador.tsx:248` |
| **Verificado por** | `verificar:m4` (29/29) |

**Flujo**

1. Al abrir la app, si el piloto no habilitó operación real, se borran las
   patentes reales atascadas de versiones anteriores
   (`src/app/pantalla-operador.tsx:251`, `src/lib/cola-local.ts:135`).
2. Se purgan las sesiones ya sincronizadas que **no** están activas
   (`src/app/pantalla-operador.tsx:254`, `src/lib/cola-local.ts:163`).
3. La purga del paso 2 es **dirigida**: no toca la cola de pendientes —eso no
   existe en ningún otro lado— ni las sesiones activas, que el operador necesita
   para trabajar sin red (`src/lib/cola-local.ts:156`).
4. Al cerrar una salida, esa sesión se borra del dispositivo en el acto
   (`src/app/pantalla-operador.tsx:360`).
5. Al cerrar sesión, se vacía todo (`src/lib/cola-local.ts:121`) — es el paso 5
   de CU-07.

---

## 3. Las tres brechas — no se numeran, y por qué

Los tres tienen actor y necesidad reales. Ninguno tiene flujo: **no hay pasos que
citar.** Se dejan con su fragmento de evidencia, que es lo que sí se puede
verificar hoy.

### 3.1 · CU-10 · Medir H1 · **BRECHA**

| | |
|---|---|
| **Actor** | analista del piloto (**no existe en el sistema**, y tampoco en `docs/data/actores.md`) |
| **Precondición** | hay sesiones cerradas de operación real |
| **Historia(s)** | **ninguna.** Es la brecha de traza más grave del proyecto — §4.2 |
| **Flujo** | *no existe*. No hay consulta, ni pantalla, ni script que calcule la mediana de `tecleo_fin_at − tecleo_inicio_at` |
| **Implementación** | **NO CONSTRUIDO** |
| **Verificado por** | `verificar:meas1` comprueba que no haya **nulos**, no que haya **datos** |

Fragmento que sostiene la brecha:

```
src/db/schema.ts:123   la métrica está instrumentada en el esquema
spec.md §6             la define: tecleo_fin_at − tecleo_inicio_at
scripts/lib/fixtures.mjs  cada verificador de navegador limpia al iniciar
{{UMBRAL_H1_SEGUNDOS}} · {{LINEA_BASE_CUADERNO_SEGUNDOS}}  sin resolver
```

> **BRECHA, y es la de fondo.** Estado: **ESPECIFICADO · INSTRUMENTADO · SIN
> DATOS**. El proyecto entero existe para probar o refutar H1 (`spec.md` §1) y H1
> nunca se midió. Es el objeto de `docs/SPEC-D-medicion-de-H1.md`.

### 3.2 · CU-11 · Cargar o cambiar una tarifa · **BRECHA**

| | |
|---|---|
| **Actor** | dueño |
| **Historia(s)** | **H-08** (`docs/data/historias-usuario.md:213`) — la historia existe, la pantalla no |
| **Flujo** | *no existe en producto*. Hoy la tarifa se siembra por script (`scripts/sembrar.mjs:151`) |
| **Implementación** | **NO CONSTRUIDO** — es la maqueta `1e` |
| **Verificado por** | — |

Fragmento que sostiene la brecha:

```
src/db/schema.ts:65    tarifa: "datos de operación que carga el dueño"
src/lib/contexto.ts:52 el versionado por vigente_desde existe
src/lib/contexto.ts:57 obtenerTarifaVigente resuelve la tarifa del momento
scripts/sembrar.mjs:151  quién la carga hoy: un humano con DATABASE_URL
```

> **BRECHA.** La mecánica existe; **la pantalla para usarla, no**. Un dueño no
> puede cambiar su propia tarifa sin que alguien corra un script.
>
> Agravante registrado: la maqueta `1e` que resolvería esto **contradice
> AC-OP-2** — su simulador calcula `18.667` donde el sistema cobra `19.000`,
> porque prorratea sin aplicar la fracción. Por eso H-08 exige coincidencia
> exacta como condición de satisfacción.

### 3.3 · CU-12 · Dar de baja a un operador · **BRECHA**

| | |
|---|---|
| **Actor** | dueño *(o plataforma — sin decidir: `{{ACTOR_BAJA_USUARIO}}`)* |
| **Historia(s)** | **H-10** (`docs/data/historias-usuario.md:278`), que asigna el acto a plataforma y no al dueño |
| **Flujo** | *no existe* |
| **Implementación** | **NO CONSTRUIDO** — maqueta `1f` |

Fragmento que sostiene la brecha:

```
src/db/schema.ts:50    usuario no tiene columna de estado
src/db/schema.ts:112   la FK sesion_vehiculo.operador_id impide borrar la fila
src/lib/auth.ts:88     el mecanismo de corte YA existe: el rol se relee por petición
```

> **BRECHA operativa real.** En un piloto donde los turnos comparten equipo, no
> hay forma de revocar el acceso de una persona. Es el candidato `usuario.estado`
> del `MER.md` §5. Lo que falta es la columna y la pantalla, no el corte: la
> relectura por petición ya haría efectiva la baja.

---

## 4. Trazabilidad caso ↔ historia

### 4.1 · La matriz

| Caso | Historia(s) | Verificado por |
|---|---|---|
| CU-01 iniciar sesión | **ninguna** | `verificar:endurecimiento` |
| CU-02 ingreso offline | H-01 | `verificar:op1`, `verificar:a3` |
| CU-02 · **E1** patente real | **ninguna** | `verificar:a3` |
| CU-03 sincronizar | H-01 | `verificar:op1` |
| CU-04 salida y cobro | H-03 | `verificar:salida`, `verificar:m4` |
| CU-05 ocupación e ingresos | H-05, H-06 | `verificar:meas2` |
| CU-06 descuadre | H-07 | `verificar:meas2` |
| CU-07 cerrar sesión | H-04 | parcial |
| CU-09 purga del dispositivo | H-03 (parcial) | `verificar:m4` |
| CU-10 medir H1 | **ninguna** | — |
| CU-11 tarifas | H-08 | — |
| CU-12 baja de operador | H-10 | — |

En sentido inverso, para que la traza sea comprobable en las dos direcciones:

| Historia | Caso |
|---|---|
| H-01 registrar sin señal | CU-02, CU-03 |
| H-02 ver cuánto lleva adentro | **ningún caso** |
| H-03 salida y monto | CU-04, CU-09 (parcial) |
| H-04 entregar el turno | CU-07 |
| H-05 ocupación ahora | CU-05 |
| H-06 ingresos del día | CU-05 |
| H-07 descuadre | CU-06 |
| H-08 cambiar tarifa | CU-11 |
| H-09 alta de un cliente | **ningún caso** |
| H-10 revocar acceso | CU-12 |

### 4.2 · Los cinco huecos, declarados

Ninguno se rellena inventando el artefacto que falta. Se nombran para que la
omisión sea una decisión visible.

| Hueco | Qué falta | Por qué no se resuelve acá |
|---|---|---|
| **CU-01 sin historia** | una historia de autenticación | `spec.md` §5 dice *«ya autenticado»*: la auth es precondición de todo el flujo y **no** una capacidad que la spec enuncie. Escribirla sería autorar un requisito |
| **E1 sin historia** | una historia de la barrera del piloto | La barrera nace de AC-PDP-1 y del hallazgo A-3, posteriores a `spec.md` §1–§8. Es la misma regla que dejó fuera de §9 a los verificadores huérfanos |
| **CU-09 con historia parcial** | la purga **al abrir** no está en ninguna historia | Nace de M-4, revisión de seguridad. `spec.md` nunca la enunció |
| **CU-10 sin historia** | la historia del analista de H1 | El actor **no existe**: no está en `docs/data/actores.md` ni en el enum de roles (`src/db/schema.ts:31`). Falta el eslabón entero, igual que con H-09 |
| **H-02 sin caso** | el caso de uso del temporizador | `spec.md` §5 *«Permanencia»* lo enuncia, así que escribirlo sería formalizar y no autorar. **Pero `AC-OP-3` no existe**: `docs/data/matriz-trazabilidad.md:96` lo declara no escrito porque `verificar:temporizador` está **vetado** — toleraba ±1 min sobre un display de granularidad de un minuto. O sea que el caso se puede escribir sin decisión humana y **quedaría sin comando que lo verifique**, que es el estado que este documento marca como brecha. Queda fuera del entregable de hoy, que son nueve flujos |

**El más caro es CU-10.** No es que falte una pantalla: falta el actor. Es la
misma forma que `docs/data/actores.md` §2 describe para el administrador de
plataforma —sin rol, sin ruta, sin historia—, y por eso ninguno de los dos se
arregla con un sprint.

---

## 5. Resumen

| Caso | Estado |
|---|---|
| CU-01, CU-02, CU-03, CU-05, CU-06, CU-09 | **construido y verificado con comando** |
| CU-02 · **E1** | construido y verificado (`verificar:a3`); **sin historia** que lo declare |
| CU-04 salida | construido y verificado, con brecha de verificación: **ningún comando ejercita el paso 10** — `verificar:salida` es puramente en línea y `verificar:op1` no toca la salida |
| CU-07 cerrar sesión | construido; **verificado solo a medias** — se comprueba que el botón exista, no lo que hace |
| CU-10 medir H1 | **BRECHA** — especificado, instrumentado, sin datos ni consulta ni umbral, y **sin actor** |
| CU-11 tarifas | **BRECHA** — modelo listo, pantalla no |
| CU-12 baja de operador | **BRECHA** — falta la columna de estado y la pantalla; el corte ya existe |

**Nueve flujos numerados, tres brechas sin numerar, cinco huecos de traza
declarados.** Lo que este documento no puede cerrar solo: las historias que
faltan para CU-01, E1, CU-09 y CU-10 —porque tres de las cuatro exigirían
autorar requisitos— y el caso de uso que le falta a H-02.
