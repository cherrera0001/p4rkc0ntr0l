# Matriz de trazabilidad

> **Medida, no afirmada.** La columna *¿Verificado?* se pobló con la salida real
> de los comandos, corridos el 2026-08-13 contra el commit `8c28d9a` con el
> servidor local levantado desde `npm run build && npm start`.
>
> Ningún estado se declara por leer un docstring.

---

## 0. Base de evidencia — salida real de la suite

```
verificar:esquema        exit=0   4/4    AC-DATA-1: PASS
verificar:invariantes    exit=0   8/8    INT-15 / INT-16 / INT-17: PASS
verificar:verificadores  exit=0  27/27   VERIFICADORES: PASS
verificar:citas          exit=0  17/17   CITAS: PASS
verificar:endurecimiento exit=0  30/30   ENDURECIMIENTO: PASS
verificar:ui             exit=0  18/18   SPEC-004: PASS
verificar:pwa            exit=0  13/13   AC-PWA-1: PASS
verificar:op1            exit=0  11/11   AC-OP-1: PASS
verificar:a3             exit=0  11/11   A-3: PASS
verificar:m4             exit=0  29/29   M-4: PASS
verificar:salida         exit=0  11/11   Ciclo ingreso/salida: PASS
verificar:meas1          exit=0          AC-MEAS-1: PASS
verificar:meas2          exit=0  10/10   AC-MEAS-2: PASS
verificar:int12          exit=0  13/13   INT-12: PASS   <- ver la fila de INT-12
npm test                 exit=0  122/122
```

> **Corrección.** Una versión anterior de esta sección pegaba
> `verificar:citas 15/15`. Ese número correspondía a un árbol donde `MER.md`
> todavía no tenía diagrama; hoy son 17/17. En la sección que se titula *"medida,
> no afirmada"*, la única línea que no reproducía era la del guard escrito en
> este mismo loop. Corregida, y anotada como recordatorio de que **un conteo
> deriva y crece**: por eso los AC deben citar el comando, no el número.

Gate de alcance, comandos de `CLAUDE.md` §1:

```
Select-String -Path package.json -Pattern "stripe|mercadopago|webpay|transbank|flow"
  -> sin resultados

Get-ChildItem -Recurse src\db | Select-String "pago|transaccion|sucursal|reserva"
  -> sin resultados

Get-ChildItem -Recurse src,public | Select-String "fonts.googleapis|unpkg|cdn."
  -> sin resultados
```

Estado del dato de H1, consultado contra la base:

```
sesiones totales: 0 · cerradas: 0 · fixtures: 0
H1 · sesiones cerradas NO fixture: 0
H1 · mediana de tecleo: SIN DATOS
```

---

## 1. Leyenda de estados

| Estado | Significa |
|---|---|
| **E+C+V** | especificado, construido y **verificado con comando** |
| **E+C+SV** | especificado y construido, **sin AC que lo verifique** |
| **E+NC** | especificado y **no construido** → deuda |
| **C+NE** | construido y **no especificado** → huérfano |

---

## 2. Capacidades del núcleo (`spec.md`)

| Capacidad | Origen | ¿Construido? | ¿Verificado? | Estado |
|---|---|---|---|---|
| Modelo de datos §4 | `spec.md` §4 · AC-DATA-1 | `src/db/schema.ts:33-184` | `verificar:esquema` → `4/4 · AC-DATA-1: PASS` | **E+C+V** |
| Registro de patente al ingreso | §2.1, §5 | `src/app/api/sesiones/route.ts:77` | `verificar:salida` → `11/11` | **E+C+V** |
| Ingreso offline + sync | §3, §5 · AC-OP-1 | `src/lib/cola-local.ts:92` | `verificar:op1` → `11/11 · AC-OP-1: PASS` | **E+C+V** |
| Temporizador de permanencia | `spec.md:177` | `src/app/pantalla-operador.tsx:75` | **NO.** `verificar:meas2` tiene 10 comprobaciones y ninguna lee lo que produce `duracion()`; ningún otro comando lo asevera | **E+C+SV** |
| Cálculo de precio a la salida | §2.3, §5 · AC-OP-2 | `src/lib/tarificacion.ts:75` | `npm test` → 122 pruebas, 0 fallos | **E+C+V** |
| Panel del dueño | §2.4, §6 · AC-MEAS-2 | `src/app/dueno/page.tsx:38` | `verificar:meas2` → `10/10 · AC-MEAS-2: PASS` | **E+C+V** |
| Descuadre visible | §6 | `src/app/dueno/descuadre.tsx:21` | `verificar:meas2` | **E+C+V** |
| Instrumentación de tecleo | §6 · AC-MEAS-1 | `src/db/schema.ts:123` | `verificar:meas1` → `AC-MEAS-1: PASS` | **E+C+V** ⚠ ver §5 |
| PWA instalable | §8 · AC-PWA-1 | `src/app/manifest.ts:11` | `verificar:pwa` → `13/13` | **E+C+V** |
| Compila | AC-BUILD-1 | — | `npm run build` → exit=0 | **E+C+V** |
| Sin pasarela de pago | AC-SCOPE-1 | — | `Select-String` → sin resultados | **E+C+V** |
| Sin entidades prohibidas | AC-SCOPE-2 | — | `Select-String` sobre `src/db` → sin resultados | **E+C+V** |
| Sin módulo LPR/cámara | AC-SCOPE-3 | — | `Select-String` sobre `src,public` → sin resultados | **E+C+V** |
| Auth mínima de dos roles | §3 | `src/lib/auth.ts:104` | `verificar:meas2` (separación en ambas direcciones) | **E+C+V** |
| **Deploy por `git push`** | §8 | **NO** — corre por CLI de Vercel | — | **E+NC** |
| **Retención / enmascarado de patente** | §4, §7 (`spec.md:150`) | **NO** — `patente` es `NOT NULL` | — | **E+NC** · INT-7 |

---

## 3. Las 14 maquetas de Claude Design

Origen: `docs/diseno-2026-08-12-traduccion.md` §1.

### 3.1 Construidas

| Maqueta | ¿Construido? | ¿Verificado? | Estado |
|---|---|---|---|
| `1a` login (mitad no-multisitio) | `src/app/login/page.tsx:16` | `verificar:meas2` y `verificar:endurecimiento`, que entran **por el formulario**. `verificar:ui` comprueba tokens y capas, no acredita esta maqueta | **E+C+V** |
| `1b` operador · lista de permanencia | `src/app/pantalla-operador.tsx:406` | `verificar:op1` → `11/11` | **E+C+V** ⚠ el temporizador de la fila no está verificado — ver §2 |
| `1c` salida · monto a cobrar | `src/app/pantalla-operador.tsx:573` | `verificar:m4` → `29/29`, que incluye *"el operador ve el monto a cobrar en efectivo"*. **No** `verificar:salida`: ese es `fetch` puro y nunca abre navegador | **E+C+V** |
| `1n` dueño de un solo sitio | `src/app/dueno/page.tsx:78` | `verificar:meas2` → `10/10` | **E+C+V** |
| descuadre (parte de `1n`) | `src/app/dueno/descuadre.tsx:32` | `verificar:meas2` | **E+C+V** |
| cerrar sesión (INT-8) | `src/app/cerrar-sesion.tsx:66` | `verificar:endurecimiento` → `30/30` | **E+C+V** |

### 3.2 Construibles sin ADR, **no construidas** → deuda

| Maqueta | Qué falta | Estado |
|---|---|---|
| `1e` tarifas por estacionamiento | pantalla de carga/versionado. El modelo ya lo soporta (`src/lib/contexto.ts:57`) | **E+NC** |
| `1g` reportes | agregados sobre `sesion_vehiculo`; **incluye la consulta de H1** | **E+NC** |
| `1l` operador · ingreso a pantalla completa | la traducción la llama *"la mejor expresión de H1 del set"* | **E+NC** |

### 3.3 Bloqueadas por ADR-001 · multisitio **no** enmendado

ADR-004 se aceptó en su alternativa 2: suscripción sí, multisitio no.

| Maqueta | Por qué | Estado |
|---|---|---|
| `1d` admin multi-sitio | multisitio | **bloqueada** |
| `1h` alta de tenant | entidad `tenant`, 1..N sitios | **bloqueada** |
| `1k` backoffice C4A | multisitio + rol `plataforma` | **bloqueada** |
| `1m` conmutador de empresa | multisitio | **bloqueada** |
| mitad multisitio de `1a` (*"Tus empresas"*) | multisitio | **bloqueada** |
| mitad multisitio de `1f` (*"alcance = un sitio de la empresa"*) | multisitio | **bloqueada** |

### 3.4 Habilitadas por ADR-004 pero bloqueadas en la práctica

| Maqueta | Habilitada por | Bloqueada por |
|---|---|---|
| `1i` planes UF/mes | ADR-004 alt. 2 | `AC-SCOPE-1` **sin reescribir** + `{{PRECIO_SUSCRIPCION_UF}}` sin definir |
| `1j` facturación y suscripción | ADR-004 alt. 2 | ídem + `{{PASARELA_SUSCRIPCION}}` sin elegir |

El propio ADR-004 lo condiciona: *"hasta que AC-SCOPE-1 se reescriba, no entra
ninguna dependencia de pasarela"*. Hoy `AC-SCOPE-1` es un `grep` de
`webpay|flow` que empezaría a dar positivo por diseño.

### 3.5 Fuera del gate por otra razón

| Maqueta | Estado |
|---|---|
| mitad no-multisitio de `1f` (roles, suspensión) | **E+NC** — requiere `usuario.estado`, que pasa el gate (ver `MER.md` §5) |

---

## 4. Los tres defectos del diseño importado

| Defecto | Estado real | Evidencia |
|---|---|---|
| **Fuentes e íconos de terceros** (`fonts.googleapis` por `@import`, `unpkg/lucide@latest`) | **CORREGIDO** — no se copió `fonts.css`; Geist llega autoalojado por `next/font/google`; cero peticiones a terceros en runtime | `verificar:ui` → `18/18`, incluye *"cargar la pantalla no pide nada a un tercero"*; `Select-String "fonts.googleapis\|unpkg\|cdn."` → sin resultados |
| **`1e` cobra 18.667 donde AC-OP-2 cobra 19.000** | **NO CORREGIDO Y NO CORREGIBLE HOY** — el defecto vive en la maqueta, y `1e` **no está construida** | la pantalla no existe: no hay código que corregir |
| **`6,2 s` de tecleo presentado como medición** | **NO CORREGIDO Y NO CORREGIBLE HOY** — vive en `1g` y `1k`, **ninguna construida** | ídem. Y el dato real no existe: ver §5 |

**Los dos últimos no son deuda de corrección: son deuda de construcción.** El
riesgo es que se construyan `1e` y `1g` copiando la maqueta sin releer esta fila.

---

## 5. H1 — la fila que importa

| | |
|---|---|
| **Origen** | `spec.md` §1 (hipótesis), §6 (SPEC-003), AC-MEAS-1 |
| **¿Especificado?** | **Sí.** La métrica es `tecleo_fin_at − tecleo_inicio_at` |
| **¿Instrumentado?** | **Sí.** Ambas columnas `NOT NULL` en `src/db/schema.ts:123` y `:127`; se marcan en `src/app/pantalla-operador.tsx:280` y `:322` |
| **¿Verificado?** | AC-MEAS-1 pasa: `verificar:meas1` → `AC-MEAS-1: PASS`. **Pero verifica que no haya nulos, no que haya datos** |
| **¿Hay datos?** | **NO.** `H1 · sesiones cerradas NO fixture: 0` · `mediana de tecleo: SIN DATOS` |
| **¿Hay consulta?** | **NO.** Ningún script, pantalla ni endpoint calcula la mediana |
| **¿Hay umbral?** | **NO.** `{{UMBRAL_H1_SEGUNDOS}}` y `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` sin definir |

### Estado: **ESPECIFICADO · INSTRUMENTADO · SIN DATOS**

Tres razones concurrentes, y ninguna se arregla sola:

1. **La barrera de cumplimiento lo impide por diseño.** Con
   `OPERACION_REAL_HABILITADA=false` solo entran patentes `FIXT`, que no son
   operación real. Medir H1 de verdad exige resolver `{{BASE_LICITUD}}` y
   `{{PLAZO_RETENCION_PATENTE}}` primero — es correcto que sea así.
2. **Los verificadores limpian lo que crean.** Cada verificador de navegador
   llama `limpiarFixtures()` al iniciar (`scripts/lib/fixtures.mjs`), así que
   toda tanda termina en cero. Correcto para las pruebas, y significa que las
   corridas nunca acumulan evidencia.
3. **No existe la consulta.** Aunque hubiera datos, nadie los agregaría: es la
   maqueta `1g`, no construida.

**El proyecto entero existe para probar o refutar H1 (`spec.md` §1), y H1 nunca
se midió.** No es una nota al pie: es el hallazgo de fondo de esta auditoría.

---

## 6. INT-12 — refleja el FAIL, no lo reabre

| | |
|---|---|
| **Origen** | `docs/revision-integral-2026-08-09.md` · hallazgo INT-12 |
| **¿Construido?** | Sí — `src/lib/version-app.ts:177` compone la versión: unicidad del deploy, trazabilidad del commit |
| **¿La propiedad se cumple?** | **Sí, observada en producción**, sin depender del verificador: `f77e331` → `f77e331-o1sVm5pNFAKk` y `f77e331-WzcRtmYaY2KP` en dos deploys del mismo commit con árbol limpio |
| **¿Verificado?** | **NO.** El gate es **FAIL** |
| **Estado** | **E+C+SV** — el comando da `13/13 · INT-12: PASS` y ese PASS **no es confiable** |

Por qué el PASS de la base de evidencia no cuenta: el auditor forjó dos objetos
en el historial JSON —sin build, sin deploy, sin tocar código— y obtuvo `13/13`.
Además el historial se puede borrar sin dejar rastro (está gitignoreado), y el
PASS no distingue un deploy de un rebuild ocioso.

**No se reabre acá.** Queda como está registrado en `LEDGER.md` del 2026-08-13:
BoundedLoop agotado, FAIL, hito detenido.

---

## 7. Huérfanos · **C+NE**

Construido, verificado, y **sin AC en `spec.md`** que lo exija.

| Qué | Dónde | Se verifica con | Por qué es huérfano |
|---|---|---|---|
| Invariantes de base (INT-15/16/17) | `src/db/schema.ts:148`, `:161`, `:166`, `:177` | `verificar:invariantes` → `8/8` | AC-DATA-1 verifica **presencia y forma**, no invariantes |
| **M-4 entero: purga del dispositivo** | `src/lib/cola-local.ts:135`, `:163`, `:201`, `:276` | `verificar:m4` → `29/29` | **Un subsistema completo con verificador propio y ningún AC.** Cubre `purgarNoActivas`, `reconciliarActivas`, `borrarTodo`, la memoria de cierres de INT-9 y el monto en pantalla. Faltaba en esta matriz — tanto en capacidades como en huérfanos — pese a que sus números se citan en CU-04 y CU-09 |
| Temporizador de permanencia | `src/app/pantalla-operador.tsx:75` | **nada** | `spec.md:177` lo pide y **ningún comando lo asevera**. No es solo huérfano: es la única capacidad del núcleo sin verificación alguna |
| Endurecimiento completo (INT-2, C-1, A-1, B-2, INT-4, INT-8, INT-11, INT-14) | `src/proxy.ts`, `src/lib/limite-intentos.ts`, `src/lib/sesion-token.ts`, `src/lib/tiempo.ts` | `verificar:endurecimiento` → `30/30` | nace de una revisión de seguridad posterior a `spec.md`; **ningún AC de §9 lo menciona** |
| Capa de presentación (AC-UI-1..4) | `src/app/globals.css`, pantallas | `verificar:ui` → `18/18` | los AC-UI viven en `docs/diseno-…`, no en `spec.md` §9 |
| Barrera de datos reales | `src/lib/fixtures.ts:12` | `verificar:a3` → `11/11` | nace de M4/A-3; `spec.md` §4 nombra los placeholders pero no exige la barrera |
| Cota del reloj del cliente | `src/lib/tiempo.ts:91` | `verificar:endurecimiento` (INT-14) | INT-14, sin AC |
| Guard de verificadores | `scripts/verificar-verificadores.mjs` | `verificar:verificadores` → `27/27` | herramienta interna |
| Guard de citas | `scripts/verificar-citas.mjs` | `verificar:citas` → `15/15` | creado en este loop |

**Nota importante.** Que algo sea huérfano **no significa que esté mal**:
significa que su verificación no está anclada a la spec, así que un cambio futuro
podría eliminarlo sin violar ningún criterio escrito. Formalizar los que ya se
verifican con comando es formalización; el resto es decisión.

---

## 8. Resumen numérico

| Estado | Cantidad | Detalle |
|---|---|---|
| **E+C+V** | 20 | núcleo `spec.md` (13) + maquetas construidas (6) + fuentes autoalojadas |
| **E+C+SV** | 2 | INT-12 (gate en FAIL) · **temporizador de permanencia** (ningún comando) |
| **E+NC** (deuda) | 6 | deploy por `git push`, retención INT-7, `1e`, `1g`, `1l`, mitad de `1f` |
| **C+NE** (huérfanos) | 9 | ver §7 — se sumaron **M-4 entero** y el temporizador |
| **Bloqueadas** | 6 maquetas | multisitio (ADR-001 no enmendado en esa fila) |
| **Habilitadas y bloqueadas** | 2 maquetas | `1i`, `1j` — falta AC-SCOPE-1 y `{{PRECIO_SUSCRIPCION_UF}}` |
| **Sin datos** | 1 | **H1** — el propósito del proyecto |

---

## 9. Límite declarado de esta matriz

La columna *¿Verificado?* cita comandos que **acabo de correr**, con su salida
pegada en §0. Dos advertencias honestas:

1. **`verificar:int12` aparece con `13/13 PASS` en la base de evidencia y su fila
   dice FAIL.** No es contradicción: el comando pasa y el gate no es confiable.
   La matriz refleja el veredicto, no el número.
2. **Una corrida verde es válida para el estado en que se tomó.** Los
   verificadores de navegador limpian fixtures al iniciar, así que la base quedó
   en cero al terminar — que es precisamente por qué H1 no tiene datos.
