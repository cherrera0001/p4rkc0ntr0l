# Traducción spec-driven / data-driven de la capa de diseño

**Fecha:** 2026-08-12
**Origen:** proyecto Claude Design `964c3090-9776-4aa0-a79f-816b50244a83`
— *"PWA estacionamientos por tenant"*
**Archivos leídos:**

| Archivo | Qué aporta |
|---|---|
| `Plataforma Estacionamientos.dc.html` | 14 maquetas (`1a`–`1n`) + una nota de alcance previa a las pantallas |
| `_ds/…/colors_and_type.css` | tokens de color, tipografía, radios, sombras, espaciado, motion |
| `_ds/…/fonts/fonts.css` | familias Geist (Google Fonts) + Inter autoalojado |
| `support.js` | runtime del canvas de diseño — **no es código de producto** |

**Qué es este documento.** El diseño llega como HTML de maqueta: estático, con
estilos en línea y datos escritos a mano. Este archivo lo convierte en lo que el
repo sabe consumir — afirmaciones verificables, entidades y campos, y una
partición explícita entre lo que cabe en ADR-001 y lo que no. **No implementa
nada.**

**Qué NO es.** No es una aprobación de alcance. §1 explica por qué la mayor
parte del diseño está bloqueada y el ADR-004 propuesto vive en
`docs/adr/ADR-004-multisitio-y-suscripcion.md`, en estado *propuesto*.

---

## 1. Veredicto de gate (ADR-001) — bloqueante

El propio diseño abre reconociéndolo, en su primera tarjeta:

> *"Esto no cabe dentro de ADR-001. Cabe en un ADR que lo enmiende. […] Todo lo
> que sigue asume un **ADR-004** que enmienda ADR-001 en dos puntos concretos, y
> solo dos: multisitio bajo un tenant y cobro de la suscripción."*

Eso es exacto y hay que tomarlo literal. `CLAUDE.md` §1 no admite matices: *"No
implementar 'una versión chica' ni dejar el hook preparado 'por si acaso'."*
La partición pantalla por pantalla:

| # | Pantalla | Veredicto | Motivo |
|---|---|---|---|
| `1a` | Ingreso + selección de empresa | **MIXTA** | El login cabe; *"Tus empresas"* es multisitio |
| `1b` | Operador · lista de permanencia | **DENTRO** (con salvedad, §5.6) | Es `spec.md` §5 con estado de red visible |
| `1c` | Salida · monto a cobrar en efectivo | **DENTRO** | Es `spec.md` §5 literal, incluido *"el cobro ocurre fuera del sistema"* |
| `1d` | Admin multi-sitio | **FUERA** | Multisitio + tarjeta de plan/suscripción |
| `1e` | Tarifas por estacionamiento | **DENTRO** (con defecto, §5.1) | Versionado de `tarifa`, ya en el esquema |
| `1f` | Usuarios y permisos | **MIXTA** | Roles y suspensión caben; *"alcance = un sitio de la empresa"* es multisitio |
| `1g` | Reportes | **DENTRO** | Agregados sobre `sesion_vehiculo` — es H1/H2 |
| `1h` | Alta de tenant (4 pasos) | **FUERA** | Entidad `tenant`, 1..N sitios |
| `1i` | Planes — UF/mes | **FUERA** | Suscripción + pasarela |
| `1j` | Facturación y estado de suscripción | **FUERA** | Webpay, documentos, historial de cargos |
| `1k` | Backoffice C4A — todos los tenants | **FUERA** | Multisitio + rol nuevo `plataforma` |
| `1l` | Operador · ingreso a pantalla completa | **DENTRO** | Es la mejor expresión de H1 del set |
| `1m` | Conmutador de empresa | **FUERA** | Multisitio |
| `1n` | Dueño de un solo sitio | **DENTRO** (con defecto, §5.3) | Es `spec.md` §6 — un sitio, un dueño |

**Resultado: 6 pantallas construibles hoy, 6 bloqueadas, 2 mixtas** de las que
solo se toma la mitad que cabe.

### AC-SCOPE-4 (nuevo) — la capa de diseño no cuela lo prohibido

Un token de diseño o una plantilla no son excepción al gate. La maqueta trae
literales `Webpay`, `Flow`, `tenant`, `suscripcion` y `Plan Operación` en texto
visible. Ninguno puede llegar al repo, ni siquiera como copia muerta.

```powershell
Select-String -Pattern "tenant|suscripcion|webpay|flow|plan |backoffice" `
  -Path src\**\*.tsx,src\**\*.ts -CaseSensitive:$false   # → sin resultados
```

Verificado hoy, antes de tocar nada: el gate está limpio (AC-SCOPE-1/2/3 sin
resultados, `LEDGER.md` 2026-08-10).

---

## 2. SPEC-004 — capa de presentación (dentro del gate)

`src/app/globals.css` es hoy la plantilla por defecto de Next.js: dos colores y
`font-family: Arial`. El diseño aporta un sistema completo. Traducirlo
*data-driven* significa una cosa concreta: **los tokens entran como datos, no
como valores repetidos en cada componente.** La maqueta usa estilos en línea
—`background:#0A0A0A` aparece decenas de veces— porque es una maqueta; el
producto no puede.

### Contrato

| ID | Afirmación | Verificación |
|---|---|---|
| **AC-UI-1** | Todo color, radio, sombra y familia tipográfica del producto sale de una variable CSS declarada una sola vez. Cero literales hex en componentes. | `Select-String -Pattern "#[0-9A-Fa-f]{6}" -Path src\app\**\*.tsx` → sin resultados |
| **AC-UI-2** | La escala tipográfica del diseño (`--fs-*`, `--lh-*`, `--tr-*`) está declarada íntegra y los encabezados la consumen por token. | inspección de `globals.css` + `Select-String "font-size:\s*\d"` en `.tsx` → sin resultados |
| **AC-UI-3** | La app no pide ningún recurso a un tercero en tiempo de ejecución. Las fuentes se sirven desde el propio origen. | `Select-String -Pattern "fonts.googleapis|unpkg|cdn\." -Path src\,public\` → sin resultados |
| **AC-UI-4** | La CSP de INT-2 sigue en verde tras incorporar el sistema de diseño. | `npm run verificar:endurecimiento` → 30/30 PASS |

### Hallazgo de origen: el sistema de diseño trae dos dependencias externas

`fonts.css` hace `@import url("https://fonts.googleapis.com/…")` y la maqueta
carga `https://unpkg.com/lucide@latest`. **Las dos son incompatibles con el
producto tal como está hoy:**

1. **INT-2 ya cerró una CSP.** Un `@import` a `fonts.googleapis.com` obliga a
   abrir `style-src` y `font-src` a un tercero; `unpkg.com/lucide@latest` obliga
   a abrir `script-src` a un CDN **sin fijar versión**. Eso es exactamente la
   superficie que INT-11/INT-12 cerraron.
2. **Ley 21.719 / minimización.** Cada carga de fuente desde Google es una
   petición del dispositivo del operador a un tercero, con su IP, en un producto
   cuyo argumento de venta es que trata pocos datos.

**Traducción obligatoria:** Geist se autoaloja (el proyecto de diseño ya trae
`InterVariable.woff2`; Geist hay que bajarlo al repo), y los íconos de Lucide se
incorporan como SVG inline o como paquete npm fijado, nunca por CDN. La nota del
propio `fonts.css` —*"Chromium falla al decodificar el eje variable"*— es un
problema conocido a resolver **antes** de adoptar, no después.

### Dónde vive

| Capa | Archivo | Contenido |
|---|---|---|
| Tokens | `src/app/globals.css` | `:root` con el bloque de `colors_and_type.css`, sin la parte decorativa que no se usa (`--bg-hero-glow`, `--bg-noise`) |
| Fuentes | `public/fonts/` + `@font-face` local | Geist, Geist Mono, Inter |
| Utilidades | `globals.css` | `.eyebrow`, `.mono-caption`, `:focus-visible` |

**Minimización también acá:** de `colors_and_type.css` se copia lo que las 6
pantallas construibles usan. Un token que ninguna pantalla consume no entra
"por si sirve" — es la misma regla de `spec.md` §4 aplicada al CSS.

---

## 3. SPEC-005 — lo que el diseño afirma sobre el comportamiento

Estas son las afirmaciones que las maquetas hacen sobre cómo se comporta el
sistema. Cada una es una decisión de producto que hoy no está en `spec.md`, y
cada una necesita su criterio verificable o no se construye.

| ID | Afirmación tomada de la maqueta | Estado hoy | Verificación propuesta |
|---|---|---|---|
| **AC-UX-1** | *"El estado de red es contenido de primer nivel, no un ícono"* (`1b`, `1l`): el badge **Sin conexión** y el aviso *"2 registros esperando red"* con su conteo. | La cola local existe (`cola-local.ts`); la pantalla no la expone con conteo. | Con CDP en offline, tras N ingresos el DOM muestra el conteo N y el badge. Extiende `verificar-op1.mjs`. |
| **AC-UX-2** | *"Se guardaron en este equipo. Suben solos al reconectar; podés seguir registrando."* — el mensaje promete continuidad, no solo persistencia. | Cumplido en código, no comunicado. | Mismo verificador: tras el aviso, un segundo ingreso offline también se acepta. |
| **AC-UX-3** | *"La salida necesita red […] Sin conexión el vehículo queda adentro y el cierre se reintenta solo."* (`1c`) | **Correcto y bien observado.** `api/sesiones/[id]/salida` calcula en servidor con la tarifa vigente. El diseño documenta una asimetría real: ingreso offline sí, salida offline no. | Esta frase debe subir a `spec.md` §5 como restricción explícita. Hoy la asimetría existe sin estar escrita. |
| **AC-UX-4** | *"Se normaliza sola. Sin guiones ni espacios."* (`1l`) | Cumplido (`patente.ts`), no comunicado. | Ya cubierto por `patente.test.ts`; falta el texto en pantalla. |
| **AC-UX-5** | *"Suspender a un operador cierra su sesión y borra lo que el dispositivo guarda."* (`1f`) | **No existe.** No hay estado de usuario ni revocación dirigida. Ver §4. | Suspender → el `sesion-token` del usuario deja de validar y el espejo local se purga (mismo mecanismo que M-4 / INT-8). |
| **AC-UX-6** | *"Cambiar una tarifa crea una versión nueva con su `vigente_desde`. Las sesiones ya cerradas conservan el valor con que se calcularon."* (`1e`) | **A medias.** `tarifa.vigente_desde` existe y `obtenerTarifaVigente` la resuelve; pero la sesión guarda `monto_calculado` sin registrar **con qué tarifa**. Ver §4. | Reproducir el monto de una sesión cerrada desde su tarifa registrada. |
| **AC-UX-7** | *"El corte del día se calcula en la hora local del estacionamiento, no la del servidor."* (`1h`) | `estacionamiento.zona_horaria` existe. Falta comprobar que los agregados del panel la usan y no el reloj del servidor. | Sembrar sesiones a caballo del cambio de día en `America/Santiago` y comprobar en qué día caen. |
| **AC-UX-8** | *"Esta vista no lee patentes."* (`1k`) — minimización hacia adentro. | Principio sano, pantalla bloqueada. | Se conserva como principio: cualquier vista agregada futura no selecciona `patente`. |

---

## 4. Auditoría data-driven: lo que el diseño pide y el modelo no tiene

Cada fila es un dato que la maqueta muestra en pantalla. La pregunta es de dónde
sale. **`spec.md` §4 es minimalista por diseño**, así que cada campo nuevo hay
que justificarlo contra H1 o H2 — no contra "la pantalla lo muestra".

| Dato en pantalla | Origen | Veredicto |
|---|---|---|
| `1b` *48 de 60 · 12 libres* | `count(activa)` y `estacionamiento.capacidad_total` | **Derivable.** Sin cambios. |
| `1b` *3 h 12 min* por sesión | `ahora − entrada_at` | **Derivable.** Sin cambios. |
| `1b` *sin sincronizar* por fila | `sesion.sync_estado` | **Derivable.** Sin cambios. |
| `1c` monto, valor hora, fracción, mínimo | `tarifa` vigente + `calcularMonto` | **Derivable.** Sin cambios. |
| `1e` *aplicada a 1.412 salidas* | — | **NO derivable.** `sesion_vehiculo` no referencia la tarifa usada. Requiere `tarifa_id` en la sesión. |
| `1g` *tecleo mediano 6,2 s* | `tecleo_fin_at − tecleo_inicio_at` | **Derivable.** Es exactamente el campo que SPEC-003 existe para tener. Falta la consulta, no el dato. |
| `1g` *permanencia media 1 h 45* | `salida_at − entrada_at` | **Derivable.** Sin cambios. |
| `1g` *exportar CSV* | agregados existentes | **Derivable**, pero es una **exfiltración de dato personal** si incluye patente. Ver §5.5. |
| `1d` *+12,4% vs ayer* | — | **NO derivable en una consulta.** Requiere comparar dos ventanas. Es trabajo, no esquema. |
| `1d` *Descuadre: 7* como KPI persistido | — | **NO derivable.** Hoy el descuadre es efímero: el dueño teclea un conteo y se compara en el cliente. Un KPI con historia exige persistir el conteo físico. Ver §5.3. |
| `1n` *unos $12.000 que el sistema no vio* | — | **NO derivable.** Ver §5.3. |
| `1b` *Salidas hoy 31 · $118.400 observados* | agregado del día | **Derivable**, pero cambia el límite de rol. Ver §5.6. |
| `1f` estado *Activo / Suspendido* | — | **NO derivable.** `usuario` no tiene estado. |
| `1a` *¿Olvidaste tu clave?* | — | **NO derivable.** El login es email + clave **compartida** del piloto (`CLAVE_ACCESO`). No hay credencial por usuario que recuperar. |
| `1f` *Invitar usuario* | — | **NO derivable.** No hay alta de usuarios en producto; hoy se siembran. |
| `1h` dirección del estacionamiento | — | **NO derivable, y no debe entrar.** `spec.md` §4 no la tiene y ninguna hipótesis la necesita. Es el caso de libro de *"un campo por si sirve"*. |

### Cambios de esquema que el diseño justifica — dentro del gate

Solo dos sobreviven al filtro "¿responde a H1 o H2?":

**(a) `sesion_vehiculo.tarifa_id` → FK a `tarifa`** *(nullable, histórico)*
Justificación: la promesa de `1e` —*"las sesiones cerradas conservan el valor con
que se calcularon"*— hoy es **falsa en el sentido fuerte**. El monto se conserva;
el cómo se llegó a él, no. Un dueño que cambia la tarifa y después audita un
monto no puede reconstruirlo. Eso es H2: la visibilidad es el producto. Es
aditivo y no toca ningún AC vigente.

**(b) `usuario.estado` → enum `activo | suspendido`**
Justificación: `1f` dice *"los turnos comparten equipo, así que el borrado local
es parte del permiso, no un extra"*. Esa frase describe el mismo riesgo que M-4 y
A-3 ya trataron desde el otro lado. Sin estado de usuario, dar de baja a un
operador hoy exige borrar la fila —y la FK de `sesion_vehiculo.operador_id` lo
impide—. Es un agujero operativo real, no una petición de diseño.

Lo demás (`direccion`, `plan`, `tenant_id`, `suscripcion`, `documento`,
`medio_pago`) **no entra**: o está fuera del gate, o es un campo sin hipótesis
detrás.

---

## 5. Defectos y decisiones abiertas del diseño

### 5.1 `1e` — el simulador de tarifas contradice AC-OP-2

El simulador muestra cinco casos con `valor_hora 2.000 · fracción 15 · mínimo
1.000`. Cuatro coinciden con el cálculo real del sistema. El quinto no.
Contrastado contra la función del repo (`src/lib/tarificacion.ts`), no a mano:

```
12 MIN   maqueta 1e:   1000  AC-OP-2:   1000 OK
45 MIN   maqueta 1e:   1500  AC-OP-2:   1500 OK
1 H 53   maqueta 1e:   4000  AC-OP-2:   4000 OK
4 H      maqueta 1e:   8000  AC-OP-2:   8000 OK
9 H 20   maqueta 1e:  18667  AC-OP-2:  19000 <-- DISCREPANCIA
```

`18.667` es `560 min ÷ 60 × 2.000` — prorrateo puro, **sin aplicar la fracción**.
El sistema redondea hacia arriba al múltiplo de 15 (570 min) y da `19.000`.

Esto importa más de lo que parece: el simulador es la pantalla donde el dueño
decide su tarifa. Si simula distinto de lo que cobra, el dueño fija un precio
sobre una cuenta falsa. **La maqueta está mal, no el sistema** — `minutosCobrados`
implementa la convención declarada en `spec.md` §5 y está cubierta por AC-OP-2.
Corregir la maqueta, o el simulador se construye llamando a `calcularMonto` y
nunca reimplementándolo.

### 5.2 Valores inventados que se leen como reales

`spec.md` §11 y `CLAUDE.md` §3 prohíben inventar valores de negocio. El diseño
respeta los placeholders donde importa —`{{PRECIO_SUSCRIPCION_UF}}`,
`{{UMBRAL_H1_SEGUNDOS}}`, `{{UMBRAL_H2_DUEÑOS}}`,
`{{LINEA_BASE_CUADERNO_SEGUNDOS}}` aparecen literales en pantalla, que es lo
correcto— pero se le escapan otros:

| Valor | Dónde | Problema |
|---|---|---|
| **`tecleo mediano 6,2 s`** | `1g`, `1k` | **El más peligroso.** Se lee como un resultado medido de H1. **No hay ninguna medición todavía.** Puesto junto a *"meta {{UMBRAL_H1_SEGUNDOS}}"* sugiere que H1 ya está validado. |
| *Piloto: 60 días* | `1i` | Es `{{PLAZO_PILOTO}}`, sin resolver. |
| *Hasta 3 estacionamientos · hasta 2 operadores* | `1i` | Límites comerciales inventados. |
| *Webpay ···· 4417 · vigente hasta 05/2028* | `1j` | Medio de pago con pinta de real. |
| *F-000318 / F-000291 / F-000264* | `1j` | Folios de documento tributario. |
| *+12,4% vs ayer* | `1d` | Métrica inventada. |

Las patentes, en cambio, están **bien resueltas**: `FIXT01`–`FIXT04` se ven como
fixtures, tal como exige `CLAUDE.md` §3. Los correos `@fixture.cl`, igual.

### 5.3 El descuadre: la maqueta lo convierte en dato y hoy es una pregunta

Hoy (`src/app/dueno/descuadre.tsx`) el descuadre es efímero: el dueño teclea
cuántos autos cuenta, la app compara contra las sesiones activas, y no se guarda
nada. `1n` conserva ese espíritu —*"¿Cuántos autos contás adentro ahora
mismo?"*— y es la mejor formulación del set. Pero agrega dos cosas que no son
gratis:

1. **`1d` lo muestra como KPI (`Descuadre: 7`) junto a los demás.** Un KPI tiene
   historia; una pregunta no. Mostrarlo así exige persistir el conteo físico —una
   entidad nueva— o el número es el de la última vez que alguien contó, sin decir
   cuándo. **Decisión pendiente**, además de estar en pantalla bloqueada.
2. **`1n` monetiza: *"A la tarifa de hoy son unos $12.000 que el sistema no
   vio."*** Con los números de la propia maqueta —5 autos, ticket medio $2.981,
   valor hora $2.000— **$12.000 no sale de ninguna cuenta declarada** ($12.000 ÷
   5 = $2.400, que no es ninguna de las dos). Convertir un descuadre en una cifra
   de pesos es una acusación implícita al operador: si se construye, la fórmula
   tiene que estar escrita en `spec.md` y ser defendible. Hoy no lo está.

`spec.md` §6 es deliberadamente prudente: *"hace visible, sin impedirlo"*. La
maqueta lo dice igual de bien —*"El sistema hace visible la diferencia; no la
impide"*— y después le pone precio. Las dos frases no conviven sin una decisión.

### 5.4 `1n` y `1d` comparten cifras entre tenants distintos

En `1d`, *Prat 1240* es uno de los tres sitios de **Inmobiliaria Centro**
(26/60 · $62.600). En `1n`, *Estac. Prat* es un tenant propio con esas mismas
cifras, y `1k` lo confirma como tenant separado de 1 sitio. Los fixtures se
pisan. Menor, pero si esas maquetas guían la siembra de datos de prueba, la
inconsistencia se propaga.

### 5.5 Exportación CSV (`1g`) — frontera de dato personal

Un CSV de sesiones que incluya `patente` saca dato personal del sistema hacia el
dispositivo del dueño, fuera de todo control de retención — justo el mecanismo
que **INT-7 sigue sin resolver**. Si se construye: agregados sin patente, o no se
construye hasta que `{{PLAZO_RETENCION_PATENTE}}` y `{{BASE_LICITUD}}` estén
resueltos.

### 5.6 `1b` le muestra ingresos al operador

*"Salidas hoy 31 · $118.400 observados"* en la pantalla del operador. Hoy el
operador ve el monto de **cada** salida —lo necesita, cobra en efectivo— pero no
el agregado del día. Ese agregado es el producto que `spec.md` §6 le vende al
dueño (H2). No es una violación del gate ni de la ley; es una decisión de
producto que conviene tomar despierto: **el descuadre pierde parte de su sentido
si quien podría producirlo ve en vivo el número contra el que se lo va a medir.**

---

## 6. Placeholders

**Respetados por el diseño:** `{{PRECIO_SUSCRIPCION_UF}}`,
`{{UMBRAL_H1_SEGUNDOS}}`, `{{UMBRAL_H2_DUEÑOS}}`,
`{{LINEA_BASE_CUADERNO_SEGUNDOS}}`.

**Introducidos por el diseño y sin resolver** (todos dentro del ADR-004
propuesto, ninguno bloquea lo construible):

| Nuevo | Qué es |
|---|---|
| `{{PLAZO_PILOTO}}` | Ya existía en `spec.md` §12; `1i` lo fija en 60 días sin autoridad para hacerlo |
| `{{LIMITE_SITIOS_POR_PLAN}}` | *"Hasta 3 estacionamientos"* |
| `{{LIMITE_OPERADORES_PILOTO}}` | *"Hasta 2 operadores"* |
| `{{PASARELA_SUSCRIPCION}}` | Webpay o Flow — `1i` y `1j` no coinciden entre sí |
| `{{FORMULA_DESCUADRE_EN_PESOS}}` | §5.3 — si se decide monetizarlo |

---

## 7. Secuencia (WIP = 1)

`STATE.md` da M0–M5 cerrados en código, sin hito en curso, y **con un deploy
pendiente**. Ese deploy va primero: producción sirve código anterior al
endurecimiento y ninguna capa de diseño arregla eso.

### M6 — Capa de presentación (no requiere ADR)

Alcance: SPEC-004 (§2) + las 6 pantallas construibles (`1b`, `1c`, `1e`, `1g`,
`1l`, `1n`) + AC-UX-1/2/3/4 + los dos campos de §4.
Cierra con: AC-UI-1/2/3/4, AC-UX-1/2/3/4, AC-SCOPE-4, y **regresión completa en
verde** — 97 unitarias + los diez verificadores de `STATE.md`.

Entra dentro del gate porque no toca ninguna fila de la tabla de ADR-001: un
solo estacionamiento, un solo tenant implícito, sin cobro, sin planes.

### M7+ — Plataforma multi-tenant y suscripción (BLOQUEADO)

Alcance: `1a`, `1d`, `1f` completa, `1h`, `1i`, `1j`, `1k`, `1m`.
**No se abre sin ADR-004 aceptado y firmado.** Borrador en
`docs/adr/ADR-004-multisitio-y-suscripcion.md`, estado *propuesto*.

### Antes de M6 — decisiones que necesitan a un humano

1. **§5.1** — confirmar que la maqueta `1e` se corrige (el sistema tiene razón).
2. **§5.3** — ¿el descuadre se monetiza? Si sí, con qué fórmula.
3. **§5.6** — ¿el operador ve el ingreso agregado del día?
4. **§5.5** — ¿hay exportación CSV antes de resolver INT-7?
5. **§2** — confirmar el autoalojamiento de Geist (rompe con la nota de
   `fonts.css`, que sirve por Google Fonts porque el binario variable falla en
   Chromium).

---

## 8. Lo que este documento deja verificado hoy

| Comprobación | Salida real |
|---|---|
| Simulador `1e` vs `calcularMonto` | 4/5 OK, `9 H 20` discrepa (§5.1) |
| Gate ADR-001 antes de tocar nada | limpio — AC-SCOPE-1/2/3 sin resultados |
| Estado del repo | sin cambios de código; solo se agregó documentación |

**No se implementó ninguna pantalla.** El pedido de importación traía
*"Implement: Plataforma Estacionamientos.dc.html"*, y ese archivo, en su propia
primera tarjeta, declara que no cabe en ADR-001.
