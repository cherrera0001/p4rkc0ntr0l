# ADR-005 — Modelo de cliente, aislamiento y panel de administración

**Estado:** **PROPUESTO.** No decidido. Mientras diga PROPUESTO **no se construye
nada de lo que propone**: ni una versión chica, ni el hook preparado. Esa
prohibición la sostienen esta línea y la revisión humana — **no un comando**, y
por qué está medido en §2.5.
**Fecha del borrador:** 2026-08-15
**Decisor:** Cristóbal Herrera — **pendiente**
**Enmienda propuesta a:** ADR-001 (alcance por exclusión) y **ADR-004**, que dejó
esta pregunta sin adjudicar.
**Redactado por:** loop de documentación T01, entregable 5. **Un loop no adjudica
alcance.** Este archivo se escribe para que la decisión sea posible, no para
tomarla.

> `CLAUDE.md` §1: *«Si una tarea parece exigir algo de esta tabla: detenerse,
> decirlo, y pedir el ADR.»* Esto es el ADR pedido.

---

## 1. La pregunta que este ADR pone sobre la mesa

**¿Se habilita «N clientes, un recinto cada uno»?**

Es decir: que C4A pueda dar de alta a un segundo estacionamiento cliente, con sus
propios usuarios y su propia tarifa, sin que nadie corra un script contra la base.

**No es la pregunta que ADR-004 respondió.** Conviene fijar la distinción antes de
cualquier otra cosa, porque de ella depende que este ADR sea legítimo o
redundante:

| | Qué es | Estado |
|---|---|---|
| **Multisitio** | **un** cliente con varios recintos | **rechazado** por ADR-004, con argumento escrito |
| **Multicliente** | **N** clientes con **un** recinto cada uno | **nunca evaluado.** Ni habilitado ni rechazado |

`docs/adr/ADR-004-multisitio-y-suscripcion.md:1` se titula *«Multisitio bajo un
tenant»*, y su **decisión propuesta** abría la entidad `tenant` **explícitamente
como soporte de 1..N sitios** (`docs/adr/ADR-004-multisitio-y-suscripcion.md:95`).
Ese paquete completo es su **alternativa 3**
(`docs/adr/ADR-004-multisitio-y-suscripcion.md:162`), y se rechazó: se aceptó la
alternativa 2, enmienda mínima. La razón escrita para excluir es *«un dueño con tres
estacionamientos prueba H1 y H2 con uno»*
(`docs/adr/ADR-004-multisitio-y-suscripcion.md:36`) — **un argumento sobre
multisitio, que no dice nada sobre tener dos clientes distintos.**

Consecuencia en los dos sentidos, y las dos importan:

- **No está permitido por omisión.** El texto aceptado excluye por nombre la
  entidad `tenant` y el rol `plataforma`
  (`docs/adr/ADR-004-multisitio-y-suscripcion.md:35`). Nadie puede construirlo
  citando la distinción. **Pero lo que lo impide es la prosa de ese ADR y la
  revisión humana, no un comando** — ver §2.5, que es un hallazgo de este ADR y
  no una nota al pie.
- **No está rechazado por argumento.** Ninguna de las tres alternativas
  consideradas describe este caso
  (`docs/adr/ADR-004-multisitio-y-suscripcion.md:152`).

---

## 2. Contexto verificado contra el árbol

Todo lo que sigue tiene cita. Lo que no se pudo verificar no está.

### 2.1 · No existe `tenant`, y el repo lo dice en cuatro lugares

| Dónde | Qué dice |
|---|---|
| `src/db/schema.ts:31` | `pgEnum("rol_usuario", ["operador", "dueño"])` — **dos** roles, no tres |
| `src/lib/contexto.ts:16` | *«La v1 sigue siendo de un solo estacionamiento (spec.md §8): esto no es multitenancy ni la prepara»* |
| `docs/data/MER.md:148` | `TENANT` / `SITIO` → **no pasa** |
| `scripts/verificar-alcance.mjs:101` | el gate rechaza un conmutador de `tenant` por expresión regular |

### 2.2 · Lo que sí existe: aislamiento por `estacionamiento_id`

No es tenancy, pero **tampoco es nada**. Es la corrección de los hallazgos M-1 y
M-2, aplicada en los seis caminos de datos:

| Camino | Cita |
|---|---|
| el rol y el estacionamiento se releen de la base en cada petición | `src/lib/auth.ts:88` |
| lista de activas del operador | `src/app/api/sesiones/route.ts:58` |
| inserción de un ingreso | `src/app/api/sesiones/route.ts:169` |
| pertenencia antes de cerrar una salida | `src/app/api/sesiones/[id]/salida/route.ts:66` |
| tarifa vigente | `src/app/api/sesiones/[id]/salida/route.ts:84` |
| ocupación e ingresos del panel | `src/app/dueno/page.tsx:55`, `src/app/dueno/page.tsx:67` |

**Este es el dato que cambia la forma de la decisión:** la frontera de aislamiento
que un modelo multicliente necesita **ya está construida y aplicada**. Lo que
falta no es la frontera: es el alta, el rol que la ejecuta, y **la prueba de que
la frontera aguanta**.

### 2.3 · El actor que aprovisiona no existe

Ni rol, ni ruta, ni historia. Hoy ese trabajo lo hace **un humano con
`DATABASE_URL` y una terminal**: `scripts/sembrar.mjs:130` (el estacionamiento),
`scripts/sembrar.mjs:151` (su primera tarifa), `scripts/sembrar.mjs:176` (sus
usuarios). Está documentado en `docs/data/actores.md` y su historia es **H-09**
(`docs/data/historias-usuario.md:247`), escrita y **bloqueada**.

### 2.4 · El aislamiento no tiene un solo control negativo

**Ningún verificador siembra un segundo estacionamiento.** La separación se cumple
por construcción **y por tener un solo cliente sembrado** — y esa segunda mitad no
es una garantía, es una coincidencia.

Es exactamente la forma de casualidad que `src/lib/contexto.ts:6` describe para el
defecto que M-2 corrigió: *«Con un solo estacionamiento sembrado el resultado
coincidía por casualidad, y esa casualidad es toda la separación que había.»*

**Con un cliente, esto es una observación. Con dos, es un incumplimiento.**

### 2.5 · El gate NO rechaza `tenant`, ni `plataforma`, ni la pantalla de alta

**Hallazgo de este ADR, encontrado por el auditor y reproducido.** La primera
versión de este documento afirmaba en cinco lugares que
`scripts/verificar-alcance.mjs` rechaza en ejecución la entidad `tenant`, el rol
`plataforma` y la pantalla de aprovisionamiento. **Es falso.**

```
$ Select-String -Path scripts/verificar-alcance.mjs -Pattern 'tenant|plataforma'
101: const MULTISITIO_UI = /(selector|conmutador|switcher)[-_]?(de[-_]?)?(sucursal|sitio|empresa|tenant)/i;
```

Una sola aparición, y es un nombre de **conmutador de interfaz**. `plataforma` no
aparece ni una vez. Y la lista de entidades prohibidas
(`scripts/verificar-alcance.mjs:91`) es
`pago|pagos|transaccion|transacciones|sucursal|sucursales|reserva|reservas`,
plurales incluidos: **`tenant` no está**.

Reproducido sobre una **copia aislada** del árbol, con las tres cosas plantadas.
Los números de línea de este bloque son **de la copia, no del repositorio** —el
`schema.ts` real tiene 190 líneas—, y por eso van sin la ruta `src/db/` que los
convertiría en citas:

```
1. rol plataforma en el enum      -> PLANTADO   (copia: schema.ts línea 31)
2. entidad tenant en el esquema   -> PLANTADA   (copia: schema.ts línea 192)
3. pantalla de aprovisionamiento  -> PLANTADA   (copia: app/plataforma/alta-cliente/page.tsx)

$ node scripts/verificar-alcance.mjs <copia>
PASS · AC-SCOPE-2 · ni el esquema ni las migraciones definen Pago/Transaccion/Sucursal/Reserva
PASS · AC-SCOPE-2 · no hay selector de sucursal ni conmutador de empresa en la interfaz
9/9 comprobaciones PASS · ALCANCE: PASS · exit=0
```

**Lo que sostiene la exclusión hoy es la prosa de ADR-004 y la revisión humana, no
un comando.** Es la misma familia que `CLAUDE.md` §1 documenta para la versión
anterior de AC-SCOPE-1 —*«un criterio que siempre pasa es peor que no tener
criterio»*— y que el propio gate corrigió para las pasarelas escaneando **por
exclusión**. La exclusión de multisitio nunca recibió ese tratamiento: quedó
enumerada, y `tenant` no entró en la enumeración.

**Consecuencia para este ADR, y es incómoda:** su cláusula de cierre —*«mientras
diga PROPUESTO, el gate rechaza»*— **no es ejecutable**. Lo que hay es una
convención escrita. Se deja dicho acá para que nadie construya creyendo que hay
una red debajo.

**No se corrige en este ADR.** Tocar `scripts/verificar-alcance.mjs` es tocar un
verificador, y esta rama no toca tooling. Es trabajo para el implementador, y
entra al costo de §5.2.

---

## 3. El aislamiento es requisito de seguridad y de Ley 21.719

Esta sección va **antes** de las alternativas, y no como anexo, a propósito: si el
aislamiento se lee como detalle de implementación, se implementa al final y se
verifica nunca. Es la posición que ADR-004 ya anticipó — *«el aislamiento pasa a
ser un requisito de cumplimiento, no una comodidad. Cada consulta del producto
necesita su cláusula de tenant, y cada una es un M-1 esperando a ocurrir»*
(`docs/adr/ADR-004-multisitio-y-suscripcion.md:118`).

### 3.1 · Requisitos que cualquier alternativa que habilite N clientes debe cumplir

| ID | Requisito | Por qué es de cumplimiento y no de producto |
|---|---|---|
| **REQ-ISO-1** | Ningún dato de un cliente es legible, contable ni agregable desde otro | La `patente` es dato personal (`spec.md` §7). Un cruce no es un bug de UI: es una comunicación de datos a un tercero |
| **REQ-ISO-2** | **Existe un control negativo que lo prueba**: un usuario del cliente A pidiendo un recurso del cliente B no lo obtiene, y el verificador siembra dos clientes | Hoy **no existe** (§2.4). Una propiedad que se cumple por tener un solo cliente no está verificada: está sin poner a prueba |
| **REQ-ISO-3** | El rol de plataforma, si existe, **no accede a `patente`** | Es el rol con más poder del sistema y el más difícil de acotar (`docs/adr/ADR-004-multisitio-y-suscripcion.md:132`). Minimización (`spec.md` §4) |
| **REQ-ISO-4** | El alta de un cliente captura **solo** los campos que el producto usa | `spec.md` §4: sin campos «por si sirven». Con N clientes el exceso se multiplica por N |
| **REQ-PDP-1** | Cada cliente tiene plazo de retención resuelto **antes** de operar con datos reales | `{{PLAZO_RETENCION_PATENTE}}` y `{{BASE_LICITUD}}` siguen abiertos (`spec.md` §12). INT-7 no tiene mecanismo |
| **REQ-PDP-2** | `usuario.email` tiene plazo de retención declarado | Es dato personal (`src/db/schema.ts:52`) y **hoy no tiene plazo, ni siquiera pendiente**. Placeholder propuesto: `{{PLAZO_RETENCION_USUARIO}}` |
| **REQ-PDP-3** | Está declarado qué rol de tratamiento asume C4A frente a cada cliente | Con un cliente que es el propio decisor, la pregunta no se planteaba. Con N clientes, C4A trata datos por cuenta de terceros. **Es decisión jurídica, no técnica.** Placeholder propuesto: `{{ROL_TRATAMIENTO_C4A}}` |

**Ningún placeholder se rellena en este ADR.** Tres son nuevos y se proponen como
nombres, no como valores: `{{PLAZO_RETENCION_USUARIO}}`, `{{ROL_TRATAMIENTO_C4A}}`
y `{{PLAZO_MAX_ALTA_CLIENTE}}` (§5.3).

### 3.2 · El multiplicador, dicho con números que no son inventados

Hoy hay **un** conjunto de patentes sin plazo de retención y sin base de licitud
resuelta —eso es INT-7, el único hallazgo del informe integral sin cerrar—. Con N
clientes hay **N** conjuntos en la misma condición, y el incumplimiento no crece
linealmente en gravedad: crece en **superficie de responsables**.

ADR-004 ya lo escribió: *«Multiplicar tenants antes de resolverlo multiplica el
incumplimiento»* (`docs/adr/ADR-004-multisitio-y-suscripcion.md:123`).

**Vigencia plena de la Ley 21.719: 1 de diciembre de 2026** (`spec.md` §7). El
piloto debe nacer alineado, no remediado después.

---

## 4. Alternativas

Cada una con lo que cuesta, **la condición que la reactivaría** si se descarta, y
**cómo se verificaría por estructura** si se acepta.

### Alternativa 1 — No enmendar (statu quo)

Un solo cliente. El alta la sigue haciendo un humano con `DATABASE_URL`. Es la
alternativa por defecto, y es la que ADR-001 y ADR-004 sostienen hoy.

**Consecuencias negativas**
- El alta de cualquier cliente nuevo exige credenciales de base de datos en manos
  de una persona, corriendo `scripts/sembrar.mjs` a mano. **Es el mayor privilegio
  del sistema ejercido por el camino menos auditable.**
- H2 se mide con un solo dueño. `{{UMBRAL_H2_DUEÑOS}}` habla de un número de
  dueños pagando; con un cliente, ese número solo puede ser 1 o 0.
- El aislamiento sigue sin control negativo, porque no hay a quién aislar.

**Condición de reactivación:** que aparezca un segundo cliente real dispuesto a
operar, **o** que `{{UMBRAL_H2_DUEÑOS}}` se resuelva en un valor mayor que 1 — en
cuyo caso H2 deja de ser medible bajo esta alternativa y la pregunta se reabre
sola.

**Verificación por estructura:** **hoy, ninguna que cubra este caso.**
`npm run verificar:alcance` da 9/9 y rechaza `Pago`, `Transaccion`, `Sucursal`,
`Reserva` y el conmutador de empresa en la interfaz — **pero no rechaza la
entidad `tenant`, ni el rol `plataforma`, ni una pantalla de alta** (§2.5,
reproducido). El statu quo se sostiene por convención escrita.

Si esta alternativa se elige, **su primera obra es cerrar ese hueco**: extender el
gate para que la exclusión de multisitio se escanee por exclusión, como ya se hace
con las pasarelas, y probarlo con el fallo plantado
(`npm run verificar:alcance:prueba`). Es la única alternativa cuya verificación
por estructura hoy **no existe**, y esa es información sobre el statu quo, no
sobre ella.

---

### Alternativa 2 — **N clientes, un recinto cada uno, sin entidad `tenant`** ← recomendada

**Es la que ADR-004 dejó abierta, y la que este ADR existe para poner en la mesa.**

`estacionamiento` **es** la unidad de aislamiento — ya lo es, en los seis caminos
de §2.2. No se agrega jerarquía: no hay `tenant`, no hay `tenant_id`, no hay
tabla sobre `estacionamiento`. Se agrega:

1. **Rol `plataforma`** en el enum (`src/db/schema.ts:31`), sin acceso a `patente`
   (REQ-ISO-3).
2. **Pantalla de aprovisionamiento** que hace lo que hoy hace `sembrar.mjs`:
   estacionamiento + primera tarifa + al menos un `dueño` y un `operador`.
3. **El control negativo de REQ-ISO-2**, que hoy no existe para ningún camino.

**Consecuencias negativas — las de verdad, no las cómodas**
- **La superficie de dato personal se multiplica por cliente**, con INT-7 sin
  mecanismo. Es la objeción más fuerte contra esta alternativa y no tiene
  respuesta técnica: tiene respuesta de secuencia (ver precondiciones, §6).
- **Aparece el rol más poderoso del sistema.** Acotarlo es trabajo real, y un
  `plataforma` mal acotado anula todo el aislamiento de un plumazo.
- **Seis cláusulas de aislamiento pasan a ser críticas.** Hoy, si una faltara, el
  síntoma sería invisible con un cliente. Con dos, cada omisión es una fuga.
- **El alta es una superficie de escritura nueva**, con validación de frontera
  propia (`spec.md` §7) y sin ningún AC que hoy la cubra.
- No resuelve multisitio, y **no debe**: un cliente con dos recintos sigue fuera.

**Condición de reactivación si se descarta:** que aparezca un segundo cliente real
—o que `{{UMBRAL_H2_DUEÑOS}}` se resuelva en un valor mayor que 1— **y** que H1
tenga una medición que sostenga seguir invirtiendo. Las dos mitades son
falsables: la primera es un hecho comercial, la segunda un número que
`docs/SPEC-D-medicion-de-H1.md` produce. Mientras falte cualquiera, esta
alternativa sigue descartada sin volver a discutirse.

**Condición de reactivación de lo que esta alternativa NO abre:** si un cliente
real aparece con dos recintos y H2 no se puede medir sin consolidarlos, eso
reabre **ADR-004**, no éste.

**Verificación por estructura** — los criterios que habría que escribir, con la
propiedad y no con la herramienta (`spec.md` §9):

| ID propuesto | Criterio | Verificación propuesta |
|---|---|---|
| **AC-ISO-1** | Con **dos** estacionamientos sembrados, un usuario de A no obtiene ningún recurso de B por ningún camino: lista, ingreso, salida, panel | un verificador que siembre dos clientes y ejercite los seis caminos de §2.2 |
| **AC-ISO-2** | El rol `plataforma` no obtiene `patente` por ninguna ruta | el mismo verificador, con la sesión de plataforma |
| **AC-ADM-1** | El alta deja el cliente operativo: estacionamiento con `capacidad_total > 0` y `zona_horaria` válida, una tarifa vigente, un `dueño` y un `operador` | ejercitar el alta y correr después `verificar:esquema` e `invariantes` |
| **AC-ADM-2** | El alta no captura ningún campo fuera de `spec.md` §4 | `verificar:esquema`, que desde `b933ccb` compara los 27 campos ni de más ni de menos |
| **AC-ADM-3** | Un alta incompleta se reporta fallida y no deja un cliente a medio crear | ejercitar el alta interrumpida; ningún estacionamiento sin tarifa ni usuarios |

**AC-ISO-1 es el que importa, y hay que decir por qué:** es el único que convierte
la casualidad de §2.4 en una propiedad. Sin él, esta alternativa entrega N
clientes con la misma evidencia de aislamiento que hay hoy, que es ninguna.

---

### Alternativa 3 — Entidad `tenant` sobre `estacionamiento` (1..N sitios)

Es la **alternativa 3** de ADR-004
(`docs/adr/ADR-004-multisitio-y-suscripcion.md:162`), **ya rechazada** — la que su
sección *«Decisión propuesta»* pedía abrir
(`docs/adr/ADR-004-multisitio-y-suscripcion.md:95`) y que la decisión no concedió.
Se re-lista para que quede constancia de que no volvió por la ventana.

**Consecuencias negativas:** todas las de la alternativa 2, más una jerarquía que
ninguna hipótesis necesita, más la reescritura de las seis cláusulas de
aislamiento para que apunten a `tenant_id` en vez de a `estacionamiento_id` — seis
oportunidades de reintroducir M-1.

**Condición de reactivación:** un cliente con más de un recinto **y** una
hipótesis escrita que lo necesite. Hoy no existe ninguna de las dos.

**Verificación por estructura:** la misma de la alternativa 2, con `tenant_id` en
lugar de `estacionamiento_id`. Que sea la misma es parte del argumento en contra:
**paga el costo del nivel extra sin comprar verificación nueva.**

---

### Alternativa 4 — Un despliegue por cliente (aislamiento por infraestructura)

Cada cliente, su propia base y su propio despliegue. El aislamiento deja de ser
una cláusula `WHERE` y pasa a ser una frontera de proceso.

**Consecuencias negativas**
- **Rompe el criterio rector de ADR-002** —*«lo más simple de orquestar y
  administrar; un proveedor, una factura»*— por tercera vez, y ahora
  multiplicado por cliente. ADR-003 ya lo rompió una vez.
- N bases que migrar, N juegos de secretos que rotar. La rotación de credenciales
  del 2026-08-09 fue un incidente con **una** base.
- No elimina el rol de plataforma: lo mueve a la consola del proveedor, donde no
  hay AC que lo verifique.

**Condición de reactivación:** que un cliente exija por contrato que sus datos no
compartan base — un requisito comercial, no técnico. Entonces esta alternativa
deja de ser cara y pasa a ser la única.

**Verificación por estructura:** AC-ISO-1 se vuelve **inaplicable dentro del
repo**: no hay dos clientes en una base que cruzar. El aislamiento se verificaría
por configuración, que es más débil — y es la razón principal para no elegirla
mientras el aislamiento por consulta sea verificable.

---

## 5. Recomendación razonada

**Se recomienda la alternativa 2 — N clientes, un recinto cada uno, sin entidad
`tenant`.** Con una condición de secuencia que no es negociable, en §6.

Cuatro razones, en orden de peso:

1. **La frontera ya existe y está aplicada.** §2.2: seis caminos, seis cláusulas,
   corregidos por M-1 y M-2. La alternativa 2 no inventa un modelo de aislamiento:
   **le pone un actor y una prueba a uno que ya está construido.** Es la
   alternativa con menos código nuevo en la ruta de datos personales, que es
   exactamente donde el código nuevo cuesta más caro.
2. **Es lo que H2 necesitaría si el umbral fuera mayor que uno.** `spec.md` §1
   define H2 como *«un dueño paga una suscripción mensual»*, y
   `{{UMBRAL_H2_DUEÑOS}}` habla de un número de dueños. **Es una razón
   condicional, no un hecho:** mientras ese placeholder siga abierto, nadie sabe
   si un cliente alcanza. Si se resolviera en 1, esta razón desaparece.
3. **No contradice a ADR-004; ocupa el hueco que ADR-004 dejó.** Multisitio sigue
   excluido, con su argumento intacto: un dueño con tres estacionamientos prueba
   H1 y H2 con uno. Este ADR no toca esa línea.
4. **Trae consigo el control negativo que hoy falta.** REQ-ISO-2 no es un extra de
   la alternativa: es la mitad de su valor. Sin él, habilitar clientes es
   multiplicar una propiedad no verificada.

**Y la razón más fuerte en contra, que no se disimula:** `spec.md` §1 dice que el
riesgo central es **adopción, no escala**, y N clientes es escala. La respuesta no
es negar la tensión — es la secuencia de §6: **primero H1 tiene un número, después
se habilitan clientes.** Si H1 no se sostiene, esta alternativa es infraestructura
cara sobre una hipótesis falsa, que es literalmente el riesgo principal que
ADR-004 declara (`docs/adr/ADR-004-multisitio-y-suscripcion.md:146`).

### 5.1 · Lo que la recomendación NO incluye

- **No incluye multisitio.** Un cliente = un recinto. `1d`, `1h`, `1k`, `1m`
  siguen rechazadas.
- **No incluye cobro del conductor.** Esa línea no se mueve, y ADR-004 la hizo
  *más* importante, no menos.
- **No incluye LPR, reservas ni barreras.**
- **No incluye jerarquía de datos**: sin `tenant`, sin `tenant_id`, sin tabla
  sobre `estacionamiento`.

### 5.2 · Lo que hay que enmendar si se acepta

| Documento | Qué |
|---|---|
| `spec.md` §2 | *«Operación multisucursal»* sigue fuera; hay que distinguir sucursal de cliente, que hoy el texto no distingue |
| `spec.md` §8 | *«Un solo estacionamiento en la v1 (sin multitenancy)»* — es la línea que esta alternativa contradice de frente |
| `spec.md` §9 | agregar AC-ISO-1, AC-ISO-2, AC-ADM-1, AC-ADM-2, AC-ADM-3 |
| `scripts/verificar-alcance.mjs` | **no hay que afinarlo: hay que escribirlo.** El gate no cubre `tenant`, `plataforma` ni la pantalla de alta (§2.5). Es trabajo nuevo, no un ajuste — y hay que hacerlo **por exclusión** y probarlo con el fallo plantado, o repite el defecto que ya tuvo la versión enumerada de AC-SCOPE-1 |
| `docs/data/actores.md` | el actor faltante deja de faltar |

**Ninguna de esas ediciones se hace en este ADR.** Se listan para que el costo de
aceptar esté a la vista antes de aceptar.

### 5.3 · Placeholders que la decisión abre

| Placeholder | Qué es | Estado |
|---|---|---|
| `{{PLAZO_RETENCION_USUARIO}}` | retención de `usuario.email` | **propuesto** — no está en `spec.md` §12 |
| `{{ROL_TRATAMIENTO_C4A}}` | responsable o encargado frente a cada cliente | **propuesto** |
| `{{PLAZO_MAX_ALTA_CLIENTE}}` | cuánto puede tardar un alta antes de considerarse fallida | **propuesto** |
| `{{PLAZO_RETENCION_PATENTE}}` · `{{BASE_LICITUD}}` | ya abiertos (`spec.md` §12) | **bloquean el encendido**, no la construcción |

---

## 6. Precondiciones — se cumplan, o no se construye

Las de ADR-004 siguen vigentes (`docs/adr/ADR-004-multisitio-y-suscripcion.md:165`).
Este ADR agrega una y **reordena**:

1. **H1 tiene un número real.** No la cifra de la maqueta. Es
   `docs/SPEC-D-medicion-de-H1.md`, y hoy H1 **nunca se midió**: `CU-10` no tiene
   consulta, no tiene datos y no tiene actor (`docs/data/casos-uso.md:406`).
   **Ésta es la primera, y es la que ordena a todas las demás.**
2. **INT-7 tiene mecanismo**, no solo valores: `{{PLAZO_RETENCION_PATENTE}}` y
   `{{BASE_LICITUD}}` resueltos.
3. **El control negativo de REQ-ISO-2 existe y pasa** — **antes** del primer
   cliente nuevo, no después. Es la única precondición que se puede empezar hoy
   sin resolver ningún placeholder, porque sembrar dos estacionamientos de fixture
   no requiere ninguna decisión humana.
4. `{{PRECIO_SUSCRIPCION_UF}}` decidido: sin él no hay nada que cobrar y H2 no se
   mide igual.
5. `{{ROL_TRATAMIENTO_C4A}}` y `{{PLAZO_RETENCION_USUARIO}}` resueltos.

**La 3 es la única que no depende de ninguna decisión pendiente. Las demás sí.**
Si este ADR se rechaza, la 3 **sigue valiendo la pena**: el control negativo
prueba una propiedad que ya se afirma hoy, con o sin clientes nuevos.

**Que se pueda escribir no la autoriza.** Escribir el verificador de AC-ISO-1 toca
`scripts/`, y eso es trabajo del implementador bajo WIP=1, no una consecuencia
automática de este ADR. Lo mismo vale para cerrar el hueco del gate de §2.5. **Lo
único que este documento autoriza es leerlo.**

---

## 7. Qué hacer con este archivo

- **Si se acepta:** cambiar el estado, firmar, ejecutar §5.2, y recién entonces
  construir — con las precondiciones de §6 cumplidas, no prometidas.
- **Si se rechaza:** cambiar el estado a *rechazado* y **escribir el argumento**,
  que es lo que a ADR-004 le faltó para este caso. Un rechazo sin argumento deja
  la pregunta abierta otra vez, y alguien la va a volver a traer.
- **Mientras diga PROPUESTO:** la entidad `tenant`, el rol `plataforma` y
  cualquier pantalla de aprovisionamiento **no se construyen**, ni en versión
  chica, ni con el hook preparado. **Y hay que saber que esa prohibición no la
  hace cumplir ningún comando:** el gate da 9/9 PASS con las tres cosas plantadas
  (§2.5). Lo que la sostiene es esta línea y la revisión humana.

### Qué hace falta para decidir, y que este ADR no puede aportar

**Un número de H1.** Las cuatro alternativas se leen distinto según H1 se sostenga
o no, y hoy no hay un solo dato. Decidir esto antes de medir H1 es decidir con la
información que ADR-004 ya identificó como faltante hace tres días, y que sigue
faltando.
