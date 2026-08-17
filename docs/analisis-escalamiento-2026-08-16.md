# Análisis de escalamiento — crecimiento natural, SaaS y multicliente

> **Análisis, no autorización.** Nada de lo que este documento describe se
> construye. `ADR-005` está **PROPUESTO y no adjudicado**, y el gate de ADR-001
> sigue vigente: sin decisión humana no entra `tenant`, ni rol `plataforma`, ni
> pantalla de aprovisionamiento.
>
> Fecha: 2026-08-16 · Árbol: `c2dca49`
>
> Todo lo que afirma sobre el repo está medido y citado. Si algo no reproduce,
> es un defecto de este documento.

---

## 0. La distinción que ordena todo lo demás

**«Escalar» son dos preguntas distintas con costos opuestos**, y tratarlas como
una sola es lo que hace que las discusiones de multitenancy no terminen:

| Eje | Qué crece | Costo hoy |
|---|---|---|
| **A · Profundidad** | más vehículos, más operadores, más días **en un cliente** | **casi nada.** Ver §1 |
| **B · Amplitud** | más **clientes** distintos | **bloqueado**, y no por donde se cree. Ver §2 |

La intuición habitual es que el eje B se bloquea en el **modelo de datos** —que
falta la entidad `tenant`—. **Medido, es al revés:** `sesion_vehiculo` ya está
particionada por cliente, incluidos sus índices, y **el bloqueo real está en la
autenticación**, que ADR-005 no cubre.

Con dos salvedades que este documento mide y no esconde: **`tarifa` no tiene
índice por cliente** (§1.2) y **`usuario.email` es único global** (§2.1.1).

---

## 1. Eje A — más operación en un solo cliente

### 1.1 · Lo que ya aguanta, medido

**Hay tres índices explícitos** —los tres declarados con `CREATE INDEX`, los tres
sobre `sesion_vehiculo`, los tres arrancando por `estacionamiento_id`—:

```sql
sesion_vehiculo_activa_unica  (estacionamiento_id, patente) WHERE estado = 'activa'
sesion_vehiculo_por_estado    (estacionamiento_id, estado)
sesion_vehiculo_por_salida    (estacionamiento_id, estado, salida_at)
```

Las consultas del panel y de la lista de activas —ocupación, ingresos del día,
activas del operador— están cubiertas por el segundo y el tercero.

> **Corrección (auditoría del 2026-08-16).** Acá decía *«así que toda consulta del
> producto entra por índice»*. **Es falso**, y el contraejemplo está en el camino
> crítico del cobro: ver §1.2.

**El registro no depende de la red**: el ingreso escribe primero en IndexedDB y
después intenta el servidor. La evidencia del **orden** está en
`src/app/pantalla-operador.tsx:335` —*«Primero al disco local. Recién después la
red»*— y la escritura local en `src/lib/cola-local.ts:92`. Más tráfico no degrada
al operador, porque su camino crítico es local.

### 1.2 · La consulta que sí degrada con la cantidad de clientes

**`tarifa` no tiene ningún índice sobre `estacionamiento_id`.** El único que tiene
es el de su clave primaria, sobre `id`, que no sirve a esta consulta. **Una FK no
crea índice en Postgres; una PK sí** (`src/db/schema.ts:68`).

Medido contra la base viva, no leyendo el SQL:

```
índices reales: 8
  estacionamiento   estacionamiento_pkey           (id)
  sesion_vehiculo   sesion_vehiculo_activa_unica   (estacionamiento_id, patente)
  sesion_vehiculo   sesion_vehiculo_pkey           (id)
  sesion_vehiculo   sesion_vehiculo_por_estado     (estacionamiento_id, estado)
  sesion_vehiculo   sesion_vehiculo_por_salida     (estacionamiento_id, estado, salida_at)
  tarifa            tarifa_pkey                    (id)      ← el único de tarifa
  usuario           usuario_email_unique           (email)
  usuario           usuario_pkey                   (id)

¿alguno de tarifa sirve a un filtro por estacionamiento_id? NO
```

> **Corrección de la corrección (auditoría, ciclo 2).** Este párrafo decía
> *«`tarifa` no tiene ningún índice»* y §1.1 decía *«existen tres índices en todo
> el esquema»*. **Las dos son falsas: una PK *es* un índice, y hay ocho.** Y se
> escribieron en el párrafo que corregía exactamente ese defecto —una afirmación
> categórica más fuerte que lo medido, en una sección titulada «medido»—.
> La conclusión no cambia; la premisa ahora dice lo que la base dice.

Y `obtenerTarifaVigente()` corre **en cada salida** (`src/lib/contexto.ts:57`),
filtrando por `estacionamiento_id` y ordenando por `vigente_desde`. Sin índice,
eso es un recorrido secuencial sobre las tarifas de **todos** los clientes, en la
ruta que este mismo documento cita como camino de aislamiento
(`src/app/api/sesiones/[id]/salida/route.ts:84`).

Hoy no cuesta nada: hay una tarifa. **Es el único punto del eje A que crece con el
eje B**, y por eso importa nombrarlo antes y no después.

**No se agrega el índice acá.** Es un cambio de `src/db/schema.ts` más una
migración, y esta sesión no toca `src/`. Queda como trabajo declarado, con su
costo: un índice sobre `(estacionamiento_id, vigente_desde)`. No toca
`AC-DATA-1`, que compara **campos** y no índices.

### 1.3 · Los límites del eje A, en orden de aparición

| Límite | Dónde | Cuándo aparece |
|---|---|---|
| **Retención de la patente** | INT-7, sin mecanismo | **ya** — es legal, no de rendimiento, y empeora con cada día de datos |
| **`tarifa` sin índice por cliente** | `src/lib/contexto.ts:57`, en cada salida | **con el eje B**, no con el A — ver §1.2 |
| **Conexiones a la base** | `src/db/index.ts:61` (`max: 1` por invocación) | con concurrencia real: ver §3.2 |
| **La tabla crece sin poda** | no hay purga de históricos | meses, no semanas |

> **La segunda fila la agregó la auditoría del ciclo 2.** Esta tabla se presenta
> como enumeración ordenada y completa, y no incluía el límite que §1.2 acababa de
> encontrar. Una enumeración que se declara completa y no incorpora el hallazgo
> nuevo es el mismo hueco, en chico.

**El primero no es un problema de escala: es de cumplimiento.** Cuantos más días
opere el sistema, más patentes retiene sin plazo declarado. Escalar el eje A sin
resolver INT-7 es acumular incumplimiento, no capacidad.

---

## 2. Eje B — más clientes. El bloqueo no es el modelo de datos

### 2.1 · Lo que ya está listo, y sorprende

- **Aislamiento por `estacionamiento_id` aplicado en los cinco caminos que
  filtran**: `src/app/api/sesiones/route.ts:58` (lista de activas) y `:169`
  (inserción), `src/app/api/sesiones/[id]/salida/route.ts:66` (pertenencia) y
  `:84` (tarifa vigente), `src/app/dueno/page.tsx:55` y `:67` (ocupación e
  ingresos). Es la corrección de M-1 y M-2.

  > **Corrección (auditoría del 2026-08-16).** Acá decían *«los seis caminos»*
  > incluyendo `src/lib/auth.ts:88`. Esa línea filtra por `usuario.id`: es de
  > donde **sale** la clave de cliente, no donde se aplica. Es lo que
  > `docs/adr/ADR-005-modelo-de-tenant-y-panel-de-administracion.md:80` describe
  > bien —*«el rol y el estacionamiento se releen de la base en cada petición»*— y
  > acá se la había reetiquetado.

- **Los índices de `sesion_vehiculo` lo acompañan** (§1.1) — **pero `tarifa` no**
  (§1.2).
- **La unicidad de patente activa es por cliente** (`src/db/schema.ts:148`).

### 2.1.1 · Y una restricción de multicliente que sí vive en el modelo

`src/db/schema.ts:52` declara `email` **único global**, y `:54` un solo
`estacionamiento_id` NOT NULL por usuario. Consecuencia: **una persona no puede
ser usuaria de dos clientes.** Para un contador que atiende dos estacionamientos,
o para alguien de C4A con cuenta en varios, hace falta un email por cliente.

No tumba la tesis —el bloqueo duro sigue siendo la credencial, §2.2— pero estaba
faltando en una sección que se titula *«lo que ya está listo»*, y su ausencia
hacía que el «por exclusión» que este documento se atribuye no estuviera hecho.

`src/lib/contexto.ts:16` dice *«esto no es multitenancy ni la prepara»*. Es una
afirmación honesta sobre la **intención**, y hoy es pesimista sobre el **hecho**:
la partición de datos por cliente está construida y verificada.

### 2.2 · El bloqueo real: **no existe credencial por usuario**

Es el hallazgo de este análisis, y **no está en ADR-005**.

```
src/db/schema.ts:50-60   usuario = { id, email, rol, estacionamiento_id, created_at }
                         → ninguna columna de credencial
src/lib/auth.ts:114      const esperada = exigirEnv("CLAVE_ACCESO", …)
                         → UNA clave, de entorno, para todos
src/app/api/login/route.ts:84   if (!fila || !claveOk) → 401
                         → cualquier email válido + la clave compartida = sesión
```

**Con un cliente, es una clave de acceso de piloto. Con N clientes, es una falla
de aislamiento que ninguna cláusula `WHERE` corrige:** quien conozca la clave
—todos los operadores de todos los clientes— y un email **que exista en
`usuario`**, entra como esa persona. El email tiene que existir (`if (!fila ||
!claveOk)`); lo que no hace falta es ningún secreto propio de ella. El aislamiento de datos funciona perfectamente
*después* de autenticar; el problema es que autenticar no distingue clientes.

`LEDGER.md` (2026-08-09) ya lo había declarado con precisión al elegir el
mecanismo: *«es separación de roles, no un sistema de identidad… alcanza para dos
roles en un estacionamiento; no alcanza para multiusuario real»*. **Lo que este
análisis agrega es que esa frase es la precondición del eje B**, y que hoy vive en
un ledger y no en ADR-005.

### 2.3 · Y su costo real, que no es escribir un login

Agregar credencial por usuario significa **una columna nueva en `usuario`** —o una
tabla, o un proveedor externo—. Y:

> `AC-DATA-1` compara los **27 campos** de `spec.md` §4, *ni de más ni de menos*
> (`npm run verificar:esquema` → 8/8).

Una columna de credencial **rompe AC-DATA-1** hasta que se enmiende §4. O sea: el
eje B exige **tocar la fuente de verdad y migrar**, exactamente el costo que
`docs/SPEC-D-medicion-de-H1.md` §2 midió para la opción B de otro problema.

**Esto reordena las precondiciones de ADR-005.** Su §6 lista cinco; ninguna
menciona la autenticación. Debería ser la primera del eje B, porque sin ella el
alta de un segundo cliente **crea el agujero en el momento de crearlo**.

---

## 3. Los tres muros, en el orden en que van a aparecer

### 3.1 · Muro legal — INT-7, ya

No escala nada mientras la patente no tenga plazo de retención.
`{{PLAZO_RETENCION_PATENTE}}` y `{{BASE_LICITUD}}` siguen abiertos, y
`OPERACION_REAL_HABILITADA=false` es lo que hoy impide que el problema exista.
**Encender la operación real es la decisión que convierte todo lo demás en
urgente.**

### 3.2 · Muro de conexiones — el clásico de serverless

`src/db/index.ts:61` usa `max: 1` **por invocación**, y el comentario explica por
qué: cada invocación serverless es un proceso efímero y un pool grande por
instancia agota el servidor sin dar throughput. Es la decisión correcta.

Pero el techo no lo pone el cliente: lo pone **Postgres**. Con concurrencia real,
`invocaciones simultáneas ≈ conexiones`, y ahí entra un **pooler** (PgBouncer o el
pooler gestionado del proveedor). **No hay número medido acá**, y no lo invento:
depende del plan de Railway y de la concurrencia real, que hoy es cero porque el
piloto no tiene tráfico.

Cuándo importa: **cuando el eje A tenga tráfico real**, no antes.

### 3.3 · Muro de identidad — §2.2

El primero que aparece al abrir el eje B, y el único que exige enmendar `spec.md`.

---

## 4. Qué haría escalable esto sin construir multitenancy

Ordenado por *lo que destraba* dividido por *lo que cuesta*. **Ninguno se ejecuta
sin decisión:**

| # | Movimiento | Destraba | Costo |
|---|---|---|---|
| 1 | **Resolver `{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}`** y construir INT-7 | operar con datos reales; sin esto no hay ni eje A | decisión humana + un `UPDATE` parametrizado (ya costeado en `SPEC-D` §2) |
| 2 | **Medir H1** con el banco que FASE D dejó listo | saber si el producto vale la pena antes de invertir en escala | tecleo humano, cero código |
| 3 | **Credencial por usuario** | el eje B entero | enmienda de `spec.md` §4 + migración + ADR |
| 4 | **Control negativo de aislamiento** (`AC-ISO-1` de ADR-005) | convierte en propiedad lo que hoy es coincidencia de tener un cliente | un verificador que siembre dos clientes; **se puede escribir hoy** |
| 5 | **Pooler de conexiones** | el eje A bajo carga | configuración, cuando haya tráfico |

**El 4 es el más barato y el único que no depende de ninguna decisión pendiente.**
Prueba una propiedad que el repo ya afirma. Si falla, lo que hay que arreglar no
es el futuro multicliente: es el aislamiento de hoy.

> **Que no dependa de una decisión NO lo autoriza.** Es la misma línea que
> `docs/adr/ADR-005-modelo-de-tenant-y-panel-de-administracion.md:431` fija para
> este mismo AC: escribirlo toca `scripts/`, y eso entra por WIP=1 como trabajo
> del implementador. **Lo único que este documento autoriza es leerlo.**
>
> La primera versión decía *«un movimiento gratis y disponible hoy»* sin esa
> frase, y un implementador bajo `/loop` podía leerlo como luz verde para
> implementar un AC de un ADR no adjudicado.

---

## 5. Lo que este análisis NO hace

- **No adjudica ADR-005.** La pregunta *«¿se habilita N clientes, un recinto cada
  uno?»* sigue abierta y es del decisor.
- **No propone construir `tenant`.** Al contrario: muestra que el eje B no
  necesita una entidad nueva sobre `estacionamiento` —la partición ya existe—
  sino **identidad por usuario**, que es otra cosa y más barata que una jerarquía.
- **No inventa números de capacidad.** No hay medición de carga porque no hay
  carga. Un número inventado acá sería el `6,2 s` otra vez.
- **No rellena ningún `{{placeholder}}`.**

---

## 6. Lo que le pone sobre la mesa al decisor

1. **La autenticación es la precondición del eje B, y falta en ADR-005 §6.** Si se
   acepta ADR-005 tal como está, la primera alta de un cliente nuevo crea un
   agujero de aislamiento que el propio ADR no anticipa.
2. **El eje A no está bloqueado por arquitectura: está bloqueado por dos
   `{{placeholder}}` legales.** Es una decisión de negocio disfrazada de deuda
   técnica.
3. **Hay un movimiento que no depende de ninguna decisión anterior** —el control
   negativo de aislamiento—. **No depender de una decisión no es estar
   autorizado:** sigue siendo trabajo del implementador bajo WIP=1, y quien lo
   abra lo abre a propósito.

> **Y el orden que este repo ya se impuso:** *primero H1 tiene un número, después
> se habilitan clientes*. FASE D dejó el instrumento; hoy marca `AC-H1-1: FAIL`
> porque no hay una sola sesión que medir. Escalar amplitud antes de tener ese
> número es construir infraestructura sobre una hipótesis sin verificar — el
> riesgo principal que `docs/adr/ADR-004-multisitio-y-suscripcion.md:146` declara.
