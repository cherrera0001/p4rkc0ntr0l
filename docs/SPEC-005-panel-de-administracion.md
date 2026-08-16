# SPEC-005 — Panel de administración de clientes

**Estado:** **PROPUESTO, y bloqueado.** Depende de que se acepte
`docs/adr/ADR-005-modelo-de-tenant-y-panel-de-administracion.md`, hoy también
PROPUESTO. Mientras el ADR no se acepte, **nada de este documento se construye —
tampoco AC-ISO-1.**

> **Frase inequívoca, porque §7 dice que AC-ISO-1 «se puede empezar hoy» y eso se
> podía leer como permiso:** *«se puede»* es una afirmación sobre **dependencias**
> —no necesita ningún placeholder resuelto ni este ADR aceptado para ser
> escribible—, **no una autorización**. Escribir ese verificador toca `scripts/`,
> y eso entra por WIP=1 como trabajo del implementador. **Este documento no
> autoriza nada; describe.**

**Fecha:** 2026-08-15
**Deriva de:** ADR-005 alternativa 2 — N clientes, un recinto cada uno, sin
entidad `tenant`.
**Historia que lo origina:** **H-09** (`docs/data/historias-usuario.md:247`).

> Esta spec describe **qué habría que construir si se decide construirlo**. No es
> permiso. `spec.md` sigue siendo la fuente de verdad; esto es una propuesta de
> ampliación que vive fuera de ella hasta que un ADR la incorpore.

---

## 1. Qué problema resuelve

Hoy el alta de un estacionamiento cliente la ejecuta **un humano con
`DATABASE_URL` y una terminal**: `scripts/sembrar.mjs:130` crea el
estacionamiento, `scripts/sembrar.mjs:151` su primera tarifa,
`scripts/sembrar.mjs:176` sus usuarios.

**El mayor privilegio del sistema se ejerce por el camino menos auditable.** No
hay registro de quién dio de alta a quién, ni validación de frontera, ni forma de
delegar el acto sin entregar la credencial de la base.

---

## 2. Actor

**Administrador de plataforma** (C4A). Rol `plataforma`, **que hoy no existe**:
el enum tiene dos valores (`src/db/schema.ts:31`).

| Puede | No puede |
|---|---|
| dar de alta un estacionamiento cliente con su tarifa inicial y sus usuarios | **ver ninguna `patente`, por ninguna ruta** |
| ver el estado de alta de cada cliente | operar sesiones de vehículo |
| — | entrar al panel del dueño ni a la pantalla del operador de un cliente |

**La segunda columna es la spec, no una restricción añadida.** Un rol de
plataforma que puede leer patentes convierte el aislamiento de §4 en decorativo.

---

## 3. Alcance funcional

### 3.1 · Lo que se construye

| # | Capacidad | Detalle |
|---|---|---|
| 1 | **Alta de cliente** | crea `estacionamiento` (nombre, `capacidad_total`, `zona_horaria`), su primera `tarifa` (`valor_hora`, `fraccion_minutos`, `monto_minimo`, `vigente_desde`) y al menos un `dueño` y un `operador` |
| 2 | **Listado de clientes** | nombre, capacidad, zona horaria, fecha de alta, cantidad de usuarios. **Sin ocupación, sin ingresos, sin patentes** |
| 3 | **Estado de alta** | un alta incompleta se ve como incompleta, no como exitosa |

### 3.2 · Lo que NO se construye, y hay que dejarlo escrito

- **Ninguna vista de operación del cliente.** Ni ocupación, ni ingresos, ni
  descuadre, ni lista de vehículos. Si C4A necesita ver el estado del piloto,
  eso es otra spec y otra decisión — y toca dato personal.
- **Ninguna edición de tarifa desde plataforma.** La tarifa la carga el dueño; es
  **H-08** (`docs/data/historias-usuario.md:213`) y es del cliente, no de C4A.
- **Ninguna baja de usuario.** Es **H-10** (`docs/data/historias-usuario.md:278`)
  y le falta la columna de estado (`src/db/schema.ts:50`) y decidir a quién le
  toca el acto — `{{ACTOR_BAJA_USUARIO}}`.
- **Ningún multisitio.** Un cliente, un recinto. Sigue rechazado.
- **Ningún cobro de suscripción.** ADR-004 lo habilitó en principio y sigue
  bloqueado por `{{PRECIO_SUSCRIPCION_UF}}` y por la frontera
  `src/lib/suscripcion/`, hoy vacía.

---

## 4. Aislamiento — requisito de seguridad, no sección de cierre

Va acá arriba por la misma razón que en el ADR: el aislamiento que se especifica
al final se verifica nunca.

### 4.1 · La frontera ya existe

`estacionamiento_id` es la unidad de aislamiento y está aplicada en seis caminos
(`src/lib/auth.ts:88`, `src/app/api/sesiones/route.ts:58`,
`src/app/api/sesiones/route.ts:169`,
`src/app/api/sesiones/[id]/salida/route.ts:66`,
`src/app/api/sesiones/[id]/salida/route.ts:84`, `src/app/dueno/page.tsx:55`).

Esta spec **no la reemplaza ni la reescribe**. Le agrega un actor que crea
fronteras nuevas, y la obligación de probar que aguantan.

### 4.2 · Lo que hoy falta y esta spec vuelve obligatorio

**Ningún verificador siembra un segundo estacionamiento**, así que ninguno prueba
que un usuario de A no vea los datos de B. La propiedad se cumple por construcción
**y por tener un solo cliente sembrado** — la misma casualidad que
`src/lib/contexto.ts:6` describe para el defecto que M-2 corrigió.

**Con un cliente eso es una observación. Con dos es un incumplimiento de la Ley
21.719**, porque la `patente` es dato personal (`spec.md` §7) y un cruce entre
clientes es una comunicación a un tercero.

### 4.3 · Datos personales que esta spec toca

| Dato | ¿Personal? | Consecuencia |
|---|---|---|
| `usuario.email` de los usuarios que el alta crea | **sí** (`src/db/schema.ts:52`) | **sin plazo de retención declarado, ni siquiera pendiente.** `{{PLAZO_RETENCION_USUARIO}}` |
| `patente` de cada cliente | **sí** (`src/db/schema.ts:116`) | INT-7 sin mecanismo. Se multiplica por cliente |
| nombre, capacidad, zona horaria del cliente | no, por sí mismos | son datos de un negocio |

**Rol de tratamiento:** con un solo cliente que es el propio decisor, la pregunta
no se planteaba. Con N clientes, C4A trata datos por cuenta de terceros.
`{{ROL_TRATAMIENTO_C4A}}` — decisión jurídica, no técnica.

---

## 5. Criterios de aceptación propuestos

**No se agregan a `spec.md` §9.** Se proponen acá porque `spec.md` §9 es contrato
de la v1 y esto no está decidido. Si el ADR se acepta, suben.

| ID | Criterio | Verificación propuesta |
|---|---|---|
| **AC-ISO-1** | Con **dos** estacionamientos sembrados, un usuario de A no obtiene ningún recurso de B por ninguno de los seis caminos de §4.1 | verificador nuevo que siembre dos clientes y ejercite los seis |
| **AC-ISO-2** | El rol `plataforma` no obtiene `patente` por ninguna ruta | el mismo verificador, con sesión de plataforma |
| **AC-ADM-1** | El alta deja el cliente operativo: `capacidad_total > 0`, zona horaria IANA válida, una tarifa vigente, un `dueño` y un `operador` | ejercitar el alta, después `verificar:esquema` y `verificar:invariantes` |
| **AC-ADM-2** | El alta no captura ningún campo fuera de `spec.md` §4 | `verificar:esquema`, que compara los 27 campos ni de más ni de menos |
| **AC-ADM-3** | Un alta incompleta se reporta como fallida y no deja un cliente a medio crear | ejercitar el alta interrumpida y comprobar que no queda estacionamiento sin tarifa ni usuarios |

**AC-ISO-1 es el que convierte la casualidad en propiedad.** Los otros cuatro son
de producto; ése es de cumplimiento. Si solo se pudiera escribir uno, es ése — y
**se puede escribir hoy, sin resolver ningún placeholder**, porque sembrar dos
estacionamientos de fixture no requiere ninguna decisión humana.

### 5.1 · Criterio de validación de frontera

El alta es superficie de **escritura** nueva. `spec.md` §7 exige validación de
entrada en toda frontera y consultas parametrizadas. Aplica igual acá: el nombre,
la zona horaria y los emails entran validados, y la zona horaria se comprueba
contra `Intl.DateTimeFormat` — el mismo criterio que `sembrar.mjs` ya aplica desde
la revisión del 2026-08-13, donde una zona inválida se propagaba al corte del día
del panel del dueño.

Y los emails de fixture siguen teniendo que terminar en `.invalid`. **Esa regla no
está en `spec.md`** —grepeado: cero apariciones de `invalid` en todo el archivo—;
vive en `scripts/sembrar.mjs:108`, y lo que `spec.md` §11 dice es lo general: *«no
inventar nombres, métricas ni datos que parezcan reales»*. Un alta que permita
sembrar un email que parezca real reabre ese mismo hallazgo por una puerta nueva,
y hoy la barrera está en un script y no en la fuente de verdad.

---

## 6. Placeholders — ninguno se rellena

| Placeholder | Bloquea |
|---|---|
| `{{PLAZO_RETENCION_USUARIO}}` — **propuesto** | operar con los usuarios que el alta crea |
| `{{ROL_TRATAMIENTO_C4A}}` — **propuesto** | saber qué obligaciones asume C4A por cada cliente |
| `{{PLAZO_MAX_ALTA_CLIENTE}}` — **propuesto** | AC-ADM-3: cuándo un alta se considera fallida |
| `{{PLAZO_RETENCION_PATENTE}}` · `{{BASE_LICITUD}}` | operar con datos reales de **cualquier** cliente. Ya abiertos en `spec.md` §12 |
| `{{ACTOR_BAJA_USUARIO}}` — propuesto en `docs/data/historias-usuario.md:373` | H-10, fuera de esta spec |

---

## 7. Secuencia

1. **AC-ISO-1 primero.** Es el único que **no depende de nada**: ni de este ADR
   aceptado, ni de un placeholder resuelto. Prueba una propiedad que el repo ya
   afirma, con o sin clientes nuevos. Si falla, lo que hay que arreglar no es esta
   spec: es el aislamiento de la v1. **No depender de nada no es lo mismo que
   estar autorizado** — ver el encabezado.
2. **Después, H1 con un número.** `docs/SPEC-D-medicion-de-H1.md`. Construir la
   plataforma antes de eso es infraestructura sobre una hipótesis sin medir, que
   es el riesgo que ADR-004 declara como principal.
3. **Después, el alta.**

**El orden no es una preferencia: es la precondición 3 y la 1 de ADR-005 §6.**

---

## 8. Lo que esta spec no puede resolver sola

Que el rol `plataforma` exista es cambio de alcance. **Sin ADR-005 aceptado, esta
spec es una propuesta y nada más.**

Y hay que decir con qué se hace cumplir eso, porque no es lo que parecía: **el
gate no lo rechaza.** `scripts/verificar-alcance.mjs` no menciona `plataforma` ni
una vez, y su lista de entidades prohibidas
(`scripts/verificar-alcance.mjs:91`) no incluye `tenant`. Reproducido: con el rol,
la entidad y esta misma pantalla plantados, el gate da `9/9 comprobaciones PASS ·
ALCANCE: PASS · exit=0`. Detalle en
`docs/adr/ADR-005-modelo-de-tenant-y-panel-de-administracion.md` §2.5.

Lo que impide construir esto es **la decisión escrita y la revisión humana**. Si
el ADR se acepta, cerrar ese hueco es la primera obra, antes que la pantalla.
