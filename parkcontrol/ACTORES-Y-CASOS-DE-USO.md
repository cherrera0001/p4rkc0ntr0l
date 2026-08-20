# ParkControl · Actores y casos de uso

> **Derivados de la descripción declarada del producto y de su diseño de
> pantallas.** No están anclados a `archivo:línea` porque el árbol de ParkControl
> no está acá. Por eso **cada ficha lleva su procedencia**, y esa columna es el
> trabajo pendiente, no un adorno.

| Marca | Qué significa |
|---|---|
| **DECLARADO** | lo afirma la descripción del producto o el mapa de pantallas |
| **INFERIDO** | no lo dice nadie; se deduce del resto y **hay que confirmarlo o corregirlo** |
| **A VERIFICAR** | la afirmación necesita un comando contra el árbol antes de darse por cierta |

**Regla de numeración:** un paso es un acto discreto y citable. Sin saltos, y sin
pasos que el código no ejecute. Un caso sin comando que lo verifique se marca
**BRECHA**, no «cerrado».

---

## 1. Actores

| Actor | Qué hace | Qué **no** puede hacer | Procedencia |
|---|---|---|---|
| **SuperAdministrador** (`superadmin`) | alta de clientes, planes, vencimientos, cobro de suscripción, suspensión y reactivación, dashboard global | **decisión abierta: ¿ve patentes, ingresos u operación de un cliente?** Ver `MER.md` §5 | DECLARADO |
| **Administrador** (`admin`) | tarifas, tolerancia, fraccionamiento; usuarios dentro del límite del plan; contabilidad, auditoría, reportes y exportes **de su recinto** | tocar datos de otro cliente; superar el límite del plan por API | DECLARADO |
| **Cajero** (`cajero`) | entradas, salidas, vehículos dentro, apertura y cierre de turno **de su recinto** | ver contabilidad; cambiar tarifas; ver turnos ajenos | DECLARADO |
| **Sistema · sincronización** | subir la cola outbox, reconciliar, resolver conflictos por clave de idempotencia | — no es un usuario: corre en el dispositivo | DECLARADO |
| **Conductor** | — | **no es actor**: no tiene cuenta, ni pantalla, ni fila. Aparece solo como sujeto del dato `patente` | INFERIDO |

**El actor que probablemente falta:** quien lee la evidencia del piloto —cuánto
tarda un cajero, cuántos descuadres hay, si el plan Pro se usa—. Si no existe
como rol ni como consulta, es la misma brecha que cuesta más cara en cualquier
producto de este tipo: **el producto se construye y nadie mide si sirve.**

---

## 2. Casos de uso

### CU-01 · Iniciar sesión

| | |
|---|---|
| **Actor** | cajero · admin · superadmin |
| **Precondición** | el usuario existe y su cliente no está suspendido |
| **Postcondición** | credencial de sesión emitida, con su vencimiento |
| **Plan** | todos |
| **Procedencia** | DECLARADO |
| **Verifica** | ráfaga de credenciales incorrectas → límite; credencial correcta tras el límite; token manipulado y vencido rechazados |

1. El usuario envía credenciales.
2. El servidor consulta el limitador de intentos **antes** de tocar la base y de
   comparar la credencial: un intento frenado no cuesta consulta ni da señal de
   temporización.
3. Compara en **tiempo constante**; responde igual ante usuario inexistente y
   credencial incorrecta, para no filtrar qué cuentas existen.
4. Emite el token con `iat`/`exp` **verificados en el servidor**, no confiados al
   cliente.
5. Resuelve el destino según rol.

> **A VERIFICAR, y es lo primero:** ¿el rol y el `cliente_id` se **releen de la
> base en cada petición**, o se creen de lo que el token afirma? De eso depende
> que suspender un usuario o un cliente tenga efecto inmediato (CU-16).

---

### CU-02 · Registrar entrada **sin conexión** · *el caso que sostiene el producto*

| | |
|---|---|
| **Actor** | cajero |
| **Precondición** | sesión iniciada, app cargada, **con o sin red** |
| **Postcondición** | la entrada existe **en el dispositivo** aunque no haya red, y se ve en la lista |
| **Plan** | Lite y Pro |
| **Procedencia** | DECLARADO (`registrar_entrada_screen.dart`, outbox) |
| **Verifica** | con la red cortada de verdad, N entradas persisten y la UI las muestra sin esperar al servidor |

1. El cajero abre *Nueva entrada*; **se marca el instante de inicio de tecleo**
   (INFERIDO — si no existe, no hay métrica de velocidad; ver §4).
2. Teclea la patente y elige tipo de vehículo.
3. Se **valida y normaliza** la patente. Si es inválida, el flujo termina acá con
   el motivo en pantalla y **sin escribir nada**.
4. **El cliente genera el `uuid`** que será la clave de idempotencia.
5. Se escribe en la base local (Drift) con estado `pendiente`, **antes de
   cualquier intento de red**.
6. La fila aparece en la lista **sin esperar al servidor**.
7. Recién entonces se intenta la red, sin bloquear la pantalla. Sigue en CU-03.

> **El orden es el caso de uso.** Primero disco local, después red. El `uuid` lo
> genera el cliente porque sin id estable una reconexión inestable duplica filas
> en cada reintento.

**Excepción E1 · patente ya adentro.** Si ya hay un movimiento abierto con esa
patente en ese recinto, **no se crea otro**: se responde el existente. Se hace
cumplir con un índice único parcial en la base (`MR.md` §3), no solo con un `if`.

---

### CU-03 · Sincronizar la cola al reconectar

| | |
|---|---|
| **Actor** | sistema |
| **Precondición** | hay filas `pendiente` en el dispositivo |
| **Postcondición** | lo registrado sin red está en el servidor y **nada se duplicó** |
| **Procedencia** | DECLARADO (`coordinador_sincronizacion.dart`, `Idempotency-Key`) |
| **Verifica** | reenviar la misma operación **con espera entre intentos** no crea una segunda fila |

1. Dispara el evento de reconexión, el tic periódico, o la entrada recién
   guardada.
2. **Una sola sincronización a la vez.** Si llega otro pedido mientras hay una en
   curso, se marca para repetir al final. Sin esta guarda, cada entrada relanza
   la cola entera.
3. Se envía de a una operación, con su `Idempotency-Key`.
4. **Se clasifica la respuesta** según la tabla de códigos —es la decisión más
   cara del sistema:

   | Código | Qué hace la cola |
   |---|---|
   | 400, 403 | **borra** del dispositivo y avisa: hay que registrarlo de nuevo |
   | 401, 408, 409, 429, 5xx, sin red | lo deja en cola **y corta el lote** |

5. Lo aceptado pasa a `sincronizado`; se reconcilia contra la lista autoritativa
   del servidor.
6. **Guarda de orden:** una respuesta más vieja no pisa a una más nueva.

> **Decisión abierta que hay que tomar y escribir: el 404.** Si se clasifica como
> definitivo, un despliegue que devuelva 404 treinta segundos **borra las
> entradas del turno**. Si se clasifica como recuperable, una ruta que ya no
> existe **bloquea la cola para siempre**. No hay opción gratis.

---

### CU-04 · Consultar vehículos dentro

| | |
|---|---|
| **Actor** | cajero |
| **Postcondición** | ninguna: es lectura |
| **Procedencia** | DECLARADO (`vehiculos_dentro_screen.dart`) |

La lista en pantalla es la **unión** de lo que dice el servidor y lo que el
dispositivo todavía no subió, deduplicada por `id`, **con el servidor pisando**.
El servidor es autoritativo sobre qué está adentro; el dispositivo, sobre qué no
subió. Sin red, manda la lista local y **se dice en pantalla que está incompleta**.

---

### CU-05 · Registrar salida y cobrar

| | |
|---|---|
| **Actor** | cajero |
| **Precondición** | el movimiento está abierto **y pertenece al recinto del cajero** |
| **Postcondición** | movimiento cerrado, con hora de salida y monto; el cajero cobra |
| **Procedencia** | DECLARADO (`registrar_salida_screen.dart`) |
| **Verifica** | N salidas simultáneas sobre el mismo movimiento producen **un solo cierre**, con un único monto idéntico en todas las respuestas |

1. El cajero elige el vehículo y toca *Salida*.
2. El servidor **comprueba pertenencia**: busca por `id` **y** por `cliente_id`
   del usuario autenticado. Un id de otro cliente responde **404**, igual que uno
   inexistente — «no existe» y «no es tuyo» no se distinguen.
3. Fija la hora de salida **en el servidor**.
4. Toma la **tarifa vigente de la base** y aplica tolerancia y fraccionamiento.
5. Escribe cierre y monto en **una sola sentencia condicionada al estado
   abierto**, para que una segunda petición afecte cero filas.
6. Devuelve el monto. **Volver a tocar *Salida* devuelve lo mismo**, no recalcula.
7. El dispositivo borra la patente en el acto.

> **La decisión que la descripción no toma, y que hay que tomar (§2.3 del prompt
> maestro): ¿la salida funciona sin red?** Si sí, el monto que muestra puede ser
> desmentido por el servidor al reconectar, y el conductor paga la diferencia. O
> la salida exige red, o el monto local se marca en pantalla como **provisorio**.
> No hay tercera opción honesta.

---

### CU-06 · Abrir turno de caja

| | |
|---|---|
| **Actor** | cajero |
| **Precondición** | no hay otro turno abierto para ese cajero en ese recinto |
| **Postcondición** | turno abierto con monto inicial declarado y hora |
| **Procedencia** | DECLARADO (`turno_caja_screen.dart`) |
| **Verifica** | dos aperturas simultáneas producen **un solo** turno abierto |

---

### CU-07 · Cerrar turno y arquear · *el único punto donde el dinero se compara*

| | |
|---|---|
| **Actor** | cajero |
| **Postcondición** | turno cerrado con declarado, esperado y **diferencia** |
| **Procedencia** | DECLARADO |
| **Verifica** | el esperado se calcula en la **zona horaria del recinto** y coincide con la suma de salidas de la ventana |

1. El cajero declara el efectivo contado.
2. El sistema calcula el **esperado**: salidas cerradas dentro de la ventana del
   turno, en la zona horaria del recinto.
3. Muestra la **diferencia** = declarado − esperado.
4. Cierra el turno.

**Tres decisiones que hay que tomar antes de construirlo:**

1. **¿La diferencia se persiste?** Si sí, se está guardando **una acusación con
   historia sobre una persona identificable**. Es defendible —hay dinero— pero
   exige base de licitud, plazo de retención y que la persona lo sepa.
2. **¿Se puede cerrar el turno con la cola sin vaciar?** Si el dispositivo tiene
   entradas sin subir, el esperado del servidor está incompleto: cerrar igual es
   **fabricar un descuadre** y atribuírselo a alguien.
3. **¿Qué pasa con los vehículos que siguen adentro** al cerrar el turno? Pasan
   al turno siguiente, y su cobro también.

---

### CU-08 · Configurar tarifa, tolerancia y fraccionamiento

| | |
|---|---|
| **Actor** | admin |
| **Postcondición** | **una versión nueva** de tarifa, vigente desde ahora |
| **Procedencia** | DECLARADO (`tarifas_screen.dart`) |
| **Verifica** | cambiar la tarifa **no altera** el monto de salidas ya cerradas |

**Se inserta, nunca se actualiza.** Cambiar la tarifa crea una fila nueva con su
`vigente_desde`; las anteriores quedan. Es lo que permite reconstruir el monto de
una salida vieja. **`vigente_desde` lo pone el servidor**: aceptarlo del cliente
permitiría antedatar una versión y cambiar retroactivamente cobros ya hechos en
efectivo.

---

### CU-09 · Gestionar usuarios dentro del límite del plan

| | |
|---|---|
| **Actor** | admin |
| **Procedencia** | DECLARADO (`users_screen.dart`, límites Lite 1+1 / Pro 2+3) |
| **Verifica** | crear el usuario N+1 **pegándole directo a la API**, sin pasar por la UI: debe responder el límite y el uso actual, y **no crear la fila** |

> **Ocultar un botón no es negar un permiso.** El límite se hace cumplir en el
> backend, dentro de la transacción que crea el usuario — o dos altas simultáneas
> pasan el chequeo las dos.

---

### CU-10 a CU-14 · Capacidades de plan

| ID | Caso | Actor | Plan | Procedencia |
|---|---|---|---|---|
| CU-10 | Consultar contabilidad y estimación de IVA | admin | Lite: básica en pantalla · Pro: avanzada | DECLARADO |
| CU-11 | Ver analítica y gráficos | admin | **Pro** | DECLARADO |
| CU-12 | Emitir comprobante PDF | admin/cajero | **Pro** | DECLARADO |
| CU-13 | Exportar PDF / Excel / CSV y correo programado | admin | **Pro** | DECLARADO |
| CU-14 | Auditar movimientos de cajeros y alertas | admin | Lite: básica · Pro: avanzada con alertas | DECLARADO |

**Todos comparten un requisito y es el que decide si el modelo comercial existe
de verdad:** la capacidad se resuelve **en el servidor**, contra el plan leído de
la base, en un envoltorio por el que pasan **todas** las rutas — descubierto por
exclusión, no por lista blanca. Una ruta nueva que se registre por fuera nace sin
control.

**Y CU-13 tiene un requisito propio (`MER.md` §6):** un export saca dato personal
del sistema, fuera de todo control de retención. Mínimo: registro de quién
exportó qué y cuándo.

---

### CU-15 · Alta de cliente con su plan

| | |
|---|---|
| **Actor** | superadmin |
| **Postcondición** | **el cliente queda operativo, o no queda nada** |
| **Procedencia** | DECLARADO (`clientes_screen.dart`) |
| **Verifica** | un alta interrumpida a la mitad **no deja** un recinto sin tarifa ni sin usuarios |

Escribe cliente, plan contratado, **primera tarifa** y al menos un `admin`, **en
una transacción**. Un alta a medias deja un recinto que **no puede cobrar una
salida**, porque sin tarifa vigente no hay monto.

---

### CU-16 · Suspender y reactivar el servicio

| | |
|---|---|
| **Actor** | superadmin |
| **Procedencia** | DECLARADO |
| **Verifica** | tras suspender, la siguiente petición del cliente ya no opera — **sin esperar a que expire ningún token** |

> **La pregunta abierta más urgente de este caso: ¿qué pasa con los vehículos que
> están adentro?** Un cajero que no puede registrar la salida de un auto que está
> en el patio es una falla de operación, no de facturación. Opciones a decidir:
> suspender solo entradas y seguir permitiendo salidas; período de gracia; o
> corte total con procedimiento manual escrito.

---

### CU-17 · Dashboard global de plataforma

| | |
|---|---|
| **Actor** | superadmin |
| **Procedencia** | DECLARADO (`superadmin_dashboard.dart`) |
| **Verifica** | **por exclusión**: ninguna pieza de la superficie de plataforma toca la tabla donde vive la patente, y ninguna de sus URL devuelve una |

Qué muestra —y qué **no**— depende de la decisión de §1 sobre `superadmin`.

---

## 3. Trazabilidad

| Caso | Pantalla declarada | Capacidad de plan | Estado |
|---|---|---|---|
| CU-01 | login | todos | A VERIFICAR |
| CU-02 · CU-03 | `registrar_entrada_screen` + outbox | todos | A VERIFICAR |
| CU-04 | `vehiculos_dentro_screen` | todos | A VERIFICAR |
| CU-05 | `registrar_salida_screen` | todos | A VERIFICAR · **decisión abierta** |
| CU-06 · CU-07 | `turno_caja_screen` | todos | A VERIFICAR · **3 decisiones abiertas** |
| CU-08 | `tarifas_screen` | todos | A VERIFICAR |
| CU-09 | `users_screen` | todos, con límite | A VERIFICAR |
| CU-10 | `contabilidad_screen` | Lite básico / Pro | A VERIFICAR |
| CU-11 | `analitica_pro_screen` | **Pro** | A VERIFICAR |
| CU-12 · CU-13 | comprobantes y exportes | **Pro** | A VERIFICAR · **retención sin resolver** |
| CU-14 | auditoría | Lite / Pro | A VERIFICAR |
| CU-15 · CU-16 | `clientes_screen` | plataforma | A VERIFICAR |
| CU-17 | `superadmin_dashboard` | plataforma | A VERIFICAR |

---

## 4. Las brechas — no se numeran porque no hay pasos que citar

| Brecha | Por qué importa |
|---|---|
| **Medir la velocidad de registro** | Si el argumento es *«más rápido que el cuaderno»*, tiene que existir una consulta que publique la **mediana con su tamaño de muestra**. Si no hay dos instantes registrados por movimiento —inicio y fin de tecleo—, el número **no se puede calcular después**: hay que instrumentarlo antes |
| **Dar de baja a un usuario** | En un piloto donde los turnos comparten equipo, revocar el acceso de una persona tiene que ser posible **y efectivo en la petición siguiente** |
| **Retención de la patente y de los datos de usuarios** | Sin plazo definido, cada día de operación agranda el problema, y con multi-inquilino se multiplica por cliente |
