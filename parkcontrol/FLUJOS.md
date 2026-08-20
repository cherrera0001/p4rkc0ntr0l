# ParkControl · Flujos

> Cinco diagramas. Cada guarda y cada transición es una afirmación sobre el
> comportamiento: si el árbol no la ejecuta, **el diagrama está mal y se corrige
> el diagrama**, no el código a la fuerza.

---

## 1. Ciclo de vida de un movimiento

Dos dimensiones que conviene no confundir: **`estado`** dice dónde está el
vehículo; **`sync_estado`** dice dónde está el registro.

```mermaid
stateDiagram-v2
    direction TB
    [*] --> Tecleando : toca "Nueva entrada"<br/>marca inicio de tecleo

    Tecleando --> Rechazada : patente invalida
    Rechazada --> [*] : NO se escribe nada<br/>ni en disco ni en servidor

    Tecleando --> DentroLocal : confirma<br/>marca fin de tecleo

    state "dentro / pendiente" as DentroLocal
    state "dentro / sincronizado" as DentroSync
    state "cerrado / sincronizado" as Cerrado

    DentroLocal --> DentroSync : aceptado (201) o ya existia (200)
    DentroLocal --> DentroLocal : sin red, 5xx, 401, 408, 409, 429<br/>QUEDA en la cola con backoff
    DentroLocal --> Descartado : rechazo DEFINITIVO: solo 400 o 403

    DentroSync --> Cerrado : salida<br/>monto con la tarifa vigente del servidor
    Cerrado --> Cerrado : cerrar dos veces devuelve lo mismo

    Cerrado --> [*] : el dispositivo borra la patente
    Descartado --> [*] : se borra del dispositivo<br/>y se avisa al cajero
```

**Tres cosas que este diagrama hace visibles:**

1. **`Rechazada` no toca disco.** No es un estado de la base: es el camino que
   garantiza que una patente inválida —o real, si hay barrera de piloto— **nunca
   se recolecta**. Rechazar antes de persistir es la diferencia entre no tratar
   el dato y tratarlo mal.
2. **¿Existe `cerrado / pendiente`?** Depende de la decisión abierta de CU-05. Si
   la salida funciona sin red, ese estado existe y **el monto mostrado puede ser
   desmentido por el servidor**. Dibujalo como sea, pero decidilo.
3. **El único rechazo definitivo es 400/403.** Todo lo demás vuelve a la cola.

---

## 2. Outbox, con resolución servidor-autoritativa

```mermaid
flowchart TB
    A["Cajero confirma la entrada"] --> B["El DISPOSITIVO genera el uuid<br/>= Idempotency-Key"]
    B --> C["Escribe en SQLite local<br/>sync_estado = pendiente"]
    C --> D["La UI muestra la fila<br/>SIN esperar a la red"]

    D --> E{"Hay conexion?"}
    E -- no --> F["Queda en la cola.<br/>Reintento con backoff"]
    F --> E

    E -- si --> G{"Ya hay una<br/>sincronizacion en curso?"}
    G -- si --> H["Se marca para repetir al final.<br/>Nunca se pierde la ultima"]
    H --> G
    G -- no --> I["POST con Idempotency-Key"]

    I --> J{"Respuesta"}
    J -- "201 creado" --> K["sync_estado = sincronizado"]
    J -- "200 ya existia" --> K
    J -- "400 o 403 DEFINITIVO" --> L["Se BORRA del dispositivo<br/>y se avisa: hay que registrarlo de nuevo"]
    J -- "401, 408, 409, 429, 5xx<br/>o sin red: RECUPERABLE" --> F

    K --> M["Lista autoritativa del servidor"]
    M --> N{"Es la respuesta mas reciente?"}
    N -- no --> O["Se descarta.<br/>Una respuesta vieja no pisa una nueva"]
    N -- si --> P["Reconciliar: el dispositivo conserva<br/>lo que esta adentro + lo no subido"]
```

### La resolución de conflicto, dicha con precisión

**El servidor es autoritativo sobre qué está adentro; el dispositivo es
autoritativo sobre qué todavía no subió.** La lista en pantalla es la unión de
ambos, deduplicada por `id`, con el servidor pisando.

La asimetría es deliberada: el servidor no puede saber de una entrada que nunca
le llegó, y el dispositivo no puede saber de una salida que registró otro turno.

**Dos excepciones donde el dispositivo tiene que ganar**, y las dos son defectos
reales si faltan:

1. **Cierres recientes.** Una respuesta del servidor emitida *antes* de un cierre
   local todavía lista el vehículo. Aplicarla **re-escribiría una patente ya
   borrada**. Hace falta una memoria corta de cierres.
2. **Sin red.** Si la lectura falla, manda la lista local **y se marca en
   pantalla que está incompleta**.

---

## 3. Turno de caja y arqueo

```mermaid
flowchart TB
    A["Cajero abre turno"] --> B["Declara monto inicial"]
    B --> C{"Ya hay turno abierto<br/>para este cajero?"}
    C -- si --> D["Se rechaza: no se abren dos.<br/>Lo impide el indice unico parcial"]
    C -- no --> E["turno abierto"]

    E --> F["Los movimientos cerrados<br/>se asocian al turno"]
    F --> G["Cajero pide cerrar"]

    G --> H{"Queda cola sin sincronizar?"}
    H -- si --> I["NO se cierra.<br/>Cerrar con cola pendiente<br/>FABRICA un descuadre"]
    I --> H
    H -- no --> J["Declara el efectivo contado"]

    J --> K["esperado = suma de montos cobrados<br/>en la ventana del turno,<br/>en la zona horaria del RECINTO"]
    K --> L{"declarado - esperado"}
    L -- "= 0" --> M["Cuadra"]
    L -- "> 0" --> N["Sobrante"]
    L -- "< 0" --> O["Faltante"]

    M --> P["turno cerrado"]
    N --> P
    O --> P
```

**El paso que casi nunca está y es el que sostiene la honestidad del arqueo:** el
rombo *«¿queda cola sin sincronizar?»*. Si el dispositivo tiene entradas o
salidas sin subir, el esperado del servidor está **incompleto**, y la diferencia
que se calcule no mide al cajero: mide a la red.

Y el cálculo del esperado se hace en la **zona horaria del recinto**. Un corte
tomado en la zona del servidor produce descuadres fantasma dos veces al día.

---

## 4. La decisión de plan — dónde vive el modelo comercial

```mermaid
flowchart TB
    R["Peticion autenticada"] --> S["Resolver usuario, cliente y plan<br/>DESDE LA BASE, no del token"]
    S --> T{"Cliente suspendido?"}
    T -- si --> U["Ver flujo 5"]
    T -- no --> V{"La capacidad pedida<br/>esta habilitada para el plan?"}
    V -- no --> W["403 nombrando la capacidad.<br/>NO 404, NO 500, NO 200 vacio"]
    V -- si --> X{"Consume cupo?<br/>usuarios"}
    X -- no --> Y["Ejecuta"]
    X -- si --> Z{"Cupo disponible?<br/>evaluado DENTRO de la transaccion"}
    Z -- no --> AA["409 con el limite y el uso actual"]
    Z -- si --> Y
```

**Dos propiedades que lo vuelven real y no decorativo:**

- El chequeo vive en **un envoltorio por el que pasan todas las rutas**, y se
  verifica **por exclusión** —un barrido del árbol que falla si alguna ruta se
  registra por fuera—. Una lista blanca de rutas protegidas deja agujeros por
  construcción: la ruta que alguien agregue mañana nace sin control.
- El cupo se evalúa **dentro de la transacción** que crea el usuario. Contar
  antes y crear después deja pasar dos altas simultáneas.

---

## 5. Suspensión por impago — el flujo que falta decidir

```mermaid
flowchart TB
    A["Suscripcion vencida"] --> B["superadmin suspende"]
    B --> C{"Que se suspende?"}
    C --> D["Opcion A: corte total"]
    C --> E["Opcion B: solo ENTRADAS.<br/>Las salidas siguen"]
    C --> F["Opcion C: periodo de gracia"]

    D --> G["Los autos que estan ADENTRO<br/>no se pueden cobrar ni sacar<br/>del sistema"]
    E --> H["El patio se vacia solo.<br/>No entran autos nuevos"]
    F --> I["Se avisa y se corta<br/>en una fecha conocida"]

    G --> J["Falla de OPERACION,<br/>no de facturacion"]
    H --> K["Presion comercial sin<br/>romper la operacion"]
    I --> K
```

**Está sin decidir, y es una decisión de producto, no de implementación.** La
opción A es la que sale por default cuando nadie la piensa, y es la única que
convierte un problema de cobranza en un auto que no puede salir del patio.

---

## 6. Lo que estos flujos NO cubren

Se dice, en vez de omitirse, porque un documento que calla se lee como completo:

- **No hay flujo de conciliación entre turnos** que se solapan en el mismo
  recinto: dos cajeros a la vez, o un relevo con vehículos adentro.
- **No hay flujo de corrección** de un movimiento mal registrado —patente
  tecleada mal, salida cobrada de menos—. En operación real eso pasa todos los
  días, y sin flujo se resuelve por SQL a mano, que es el camino menos auditable.
- **No hay flujo de baja de usuario**, y sin él la auditoría por cajero es una
  promesa que nadie puede hacer cumplir.
- **No hay flujo de retención**: qué borra las patentes vencido el plazo, quién
  lo corre y con qué evidencia de que corrió.
