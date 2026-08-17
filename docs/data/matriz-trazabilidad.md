# Matriz de trazabilidad

> **Medida, no afirmada.** La columna *¿Verificado?* se pobló con la salida real
> de los comandos. El bloque de §0 **ya no se teclea**: lo genera
> `npm run evidencia` (ver la nota al pie de esta sección).
>
> Ningún estado se declara por leer un docstring.

---

## 0. Base de evidencia — salida real de la suite

<!-- EVIDENCIA:INICIO -->
<!-- Generado por `npm run evidencia`. No editar a mano: se regenera y se desfasa. -->

**Commit:** `afc0535` · ⚠ **árbol sucio**: esta corrida no describe un estado reproducible · **corrido:** 2026-08-17 · **grupos:** estatico, base, servidor

| Comando | Resultado | Veredicto | Nota |
|---|---|---|---|
| `npm run test` | `exit=0` · 122/122 | PASS |  |
| `npm run verificar:alcance` | `exit=0` · 9/9 | PASS |  |
| `npm run verificar:alcance:prueba` | `exit=0` · 15/15 | PASS |  |
| `npm run evidencia:prueba` | `exit=0` · 23/23 | PASS |  |
| `npm run verificar:ac` | `exit=0` · 9/9 | PASS |  |
| `npm run verificar:citas` | `exit=0` · 49/49 | PASS |  |
| `npm run verificar:verificadores` | `exit=0` · 49/49 | PASS |  |
| `npm run verificar:agentes` | `exit=0` · 20/20 | PASS |  |
| `npm run verificar:metrica` | `exit=0` · 4/4 | PASS |  |
| `npm run verificar:esquema` | `exit=0` · 8/8 | PASS |  |
| `npm run verificar:invariantes` | `exit=0` · 8/8 | PASS |  |
| `npm run verificar:meas1` | `exit=0` · — | PASS |  |
| `npm run verificar:h1` | `exit=1` · — | FAIL | ⚠ **REGRESIÓN, no el entregable.** Se esperaba `banco-vacio` y falló por `control-negativo` |
| `npm run build` | **NO CORRIDO** · grupo `build` | — |  |
| `npm run verificar:salida` | `exit=0` · 11/11 | PASS |  |
| `npm run verificar:concurrencia` | `exit=0` · 6/6 | PASS |  |
| `npm run verificar:frontera` | `exit=0` · 4/4 | PASS |  |
| `npm run verificar:pwa` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:op1` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:a3` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:m4` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:meas2` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:temporizador` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:endurecimiento` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:ui` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:int12` | **NO CORRIDO** · grupo `navegador` | — | gate registrado **FAIL** (LEDGER 2026-08-13). Su PASS no es evidencia: el historial se puede forjar y borrar |

**Cobertura de esta corrida: 16 de 26 comandos.** Los 10 restantes dicen NO CORRIDO a propósito: un bloque que omite lo que no corrió se lee como si todo hubiera pasado.

**Excluidos del catálogo a propósito (1):** `npm run evidencia`. No están medidos acá y esta línea existe para que la cobertura no baje en silencio.
<!-- EVIDENCIA:FIN -->

> **Por qué este bloque se genera y ya no se escribe.** Se tecleó a mano y se
> desfasó dos veces:
>
> 1. `verificar:citas 15/15` cuando el comando daba 17/17. Se corrigió acá mismo,
>    con la nota de que *"un conteo deriva y crece"*.
> 2. `verificar:esquema 4/4` cuando `b933ccb` lo hizo comparar los 27 campos y
>    pasó a dar 8/8. **Ése quedó sin corregir**, en la sección que se titula
>    *"medida, no afirmada"*.
>
> El proyecto ya había sacado la lección —los AC citan el comando, no el número—
> pero la aplicó a `spec.md` §9 y no a los bloques de evidencia. La lección que no
> se vuelve mecanismo se repite, y ésta se repitió. Ahora el bloque lleva el
> commit, avisa si el árbol estaba sucio, y **lo que no se corrió dice
> `NO CORRIDO` en vez de desaparecer**: un informe que omite lo que no corrió se
> lee como si todo hubiera pasado.

**Gate de alcance.** Los tres `Select-String` de `CLAUDE.md` §1 que esta sección
pegaba quedaron superados por `npm run verificar:alcance`, que escanea **por
exclusión** en vez de enumerar, y que está probado **con el fallo plantado**
(`verificar:alcance:prueba`). Ambos aparecen en la tabla de arriba. El motivo del
reemplazo está en `spec.md` §9, enmienda de AC-SCOPE-1.

**Estado del dato de H1.** `verificar:meas1` reporta hoy sesiones cerradas con
tecleo completo, pero **su recuento varía con los fixtures que dejó la última
corrida** y no distingue fixture de operación real. La mediana de tecleo —la
métrica de H1— **sigue sin existir como consulta**: ningún script, pantalla ni
endpoint la calcula. Ver §5, que es el hallazgo de fondo. Construirla es FASE D.

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
| Modelo de datos §4 | `spec.md` §4 · AC-DATA-1 | `src/db/schema.ts:33-184` | `verificar:esquema` → ver §0. Desde `b933ccb` **compara los 27 campos**, no cuenta tablas | **E+C+V** |
| Invariantes del modelo, **declaradas en la base** | `spec.md` §9 · **AC-DATA-2** (creado por `f98a652`) | `src/db/schema.ts:148`, `:161`, `:166`, `:177` | `verificar:invariantes` → ver §0 | **E+C+V** — dejó de ser huérfano, ver §7 |
| Registro de patente al ingreso | §2.1, §5 | `src/app/api/sesiones/route.ts:77` | `verificar:salida` → `11/11` | **E+C+V** |
| Ingreso offline + sync | §3, §5 · AC-OP-1 | `src/lib/cola-local.ts:92` | `verificar:op1` → `11/11 · AC-OP-1: PASS` | **E+C+V** |
| Temporizador de permanencia | `spec.md:176` | `src/app/pantalla-operador.tsx:75` | **TODAVÍA NO.** Existe `verificar:temporizador`, pero está **VETADO** (2026-08-14): toleraba ±1 min sobre un display de granularidad de un minuto, así que un error sistemático daba 15/15 PASS. `AC-OP-3` **no se escribe** hasta que el comando sostenga lo que el criterio afirmaría | **E+C+SV** |
| Cálculo de precio a la salida | §2.3, §5 · AC-OP-2 | `src/lib/tarificacion.ts:75` | `npm test` → 122 pruebas, 0 fallos | **E+C+V** |
| Panel del dueño | §2.4, §6 · AC-MEAS-2 | `src/app/dueno/page.tsx:38` | `verificar:meas2` → `10/10 · AC-MEAS-2: PASS` | **E+C+V** |
| Descuadre visible | §6 | `src/app/dueno/descuadre.tsx:21` | `verificar:meas2` | **E+C+V** |
| Instrumentación de tecleo | §6 · AC-MEAS-1 | `src/db/schema.ts:123` | `verificar:meas1` → `AC-MEAS-1: PASS` | **E+C+V** ⚠ ver §5 |
| PWA instalable | §8 · AC-PWA-1 | `src/app/manifest.ts:11` | `verificar:pwa` → `13/13` | **E+C+V** |
| Compila | AC-BUILD-1 | — | `npm run build` → exit=0 | **E+C+V** |
| **El conductor no paga dentro del sistema** | AC-SCOPE-1 (reescrito, `f98a652`) | — | `verificar:alcance` → ver §0, **por exclusión**; y `verificar:alcance:prueba`, que lo corre **con el fallo plantado**. El `Select-String` anterior daba PASS incondicionalmente | **E+C+V** |
| Sin entidades prohibidas | AC-SCOPE-2 | — | `verificar:alcance` → ver §0 | **E+C+V** |
| Sin módulo LPR/cámara | AC-SCOPE-3 | — | `verificar:alcance` → ver §0 | **E+C+V** |
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
2. **Los verificadores barren lo que encuentran, no lo que dejan.**
   `limpiarFixtures()` (`scripts/lib/fixtures.mjs`) corre **al iniciar**, y lo
   llaman **6 de los 9** verificadores de navegador (`a3`, `m4`, `meas2`, `op1`,
   `endurecimiento` y **`temporizador`**, `scripts/verificar-temporizador.mjs:208`;
   no `pwa`, `ui` ni `int12`; `verificar-salida.mjs:10`
   declara en su docstring que a propósito no limpia al inicio). Consecuencia:
   cada tanda **borra las filas de la tanda anterior** y deja las suyas puestas
   hasta la siguiente. Ninguna corrida acumula evidencia, que es lo que importa
   para H1 — pero por un mecanismo distinto del que este documento describía.

   > **Corrección (2026-08-14).** Acá decía *"cada verificador de navegador llama
   > `limpiarFixtures()` al iniciar, así que toda tanda termina en cero"*, y §9
   > repetía *"la base queda en cero al terminar"*. **Es falso, y se refuta
   > corriendo `verificar:meas1`**, que hoy reporta 3 sesiones cerradas
   > (`FIXT01/02/03`). Dos errores en una frase: *"cada"* son 5 de 8, y *"termina
   > en cero"* confunde limpiar-al-iniciar con limpiar-al-terminar. Importa
   > porque **FASE D dice construir un banco que acumula en vez de purgar**, y
   > estaba partiendo de un modelo del purgado que no es el que corre.
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
| **Disposición** | **Riesgo aceptado por decisión humana (2026-08-14)**, `LEDGER.md`. Cerrado como riesgo, **no como verificado**: no es lo mismo, y la distinción es el punto |

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
| **M-4 entero: purga del dispositivo** | `src/lib/cola-local.ts:135`, `:163`, `:201`, `:276` | `verificar:m4` → `29/29` | **Un subsistema completo con verificador propio y ningún AC.** Cubre `purgarNoActivas`, `reconciliarActivas`, `borrarTodo`, la memoria de cierres de INT-9 y el monto en pantalla. Faltaba en esta matriz — tanto en capacidades como en huérfanos — pese a que sus números se citan en CU-04 y CU-09 |
| Temporizador de permanencia | `src/app/pantalla-operador.tsx:75` | **nada** | `spec.md:176` lo pide y **ningún comando lo asevera**. No es solo huérfano: es la única capacidad del núcleo sin verificación alguna |
| Endurecimiento completo (INT-2, C-1, A-1, B-2, INT-4, INT-8, INT-11, INT-14) | `src/proxy.ts`, `src/lib/limite-intentos.ts`, `src/lib/sesion-token.ts`, `src/lib/tiempo.ts` | `verificar:endurecimiento` → `30/30` | nace de una revisión de seguridad posterior a `spec.md`; **ningún AC de §9 lo menciona** |
| Capa de presentación (AC-UI-1..4) | `src/app/globals.css`, pantallas | `verificar:ui` → `18/18` | los AC-UI viven en `docs/diseno-…`, no en `spec.md` §9 |
| Barrera de datos reales | `src/lib/fixtures.ts:12` | `verificar:a3` → `11/11` | nace de M4/A-3; `spec.md` §4 nombra los placeholders pero no exige la barrera |
| Cota del reloj del cliente | `src/lib/tiempo.ts:91` | `verificar:endurecimiento` (INT-14) | INT-14, sin AC |
| Guard de verificadores | `scripts/verificar-verificadores.mjs` | `verificar:verificadores` → ver §0 | herramienta interna |
| Guard de citas | `scripts/verificar-citas.mjs` | `verificar:citas` → ver §0 | creado en este loop |

**Nota importante.** Que algo sea huérfano **no significa que esté mal**:
significa que su verificación no está anclada a la spec, así que un cambio futuro
podría eliminarlo sin violar ningún criterio escrito. Formalizar los que ya se
verifican con comando es formalización; el resto es decisión.

> **Corrección (2026-08-14).** Esta tabla listaba **9** huérfanos e incluía
> *"Invariantes de base (INT-15/16/17)"*, justificado en que *"AC-DATA-1 verifica
> presencia y forma, no invariantes"*. Era cierto **hasta `f98a652`**, que creó
> **AC-DATA-2** en `spec.md` §9 exactamente para esas invariantes. Son **8**.
>
> Lo delata el propio comando que esta matriz cita: `verificar:ac` lista **6**
> verificadores sin AC y `verificar:invariantes` **no está entre ellos** —
> precisamente porque ya tiene AC. El 6 se midió; el 9 se contó a mano sobre una
> tabla que FASE A dejó vieja. **FASE C habría arrancado con un ítem de alcance
> ya cerrado.**
>
> Y este mismo párrafo pagaba dos veces el mismo defecto: la fila del guard de
> verificadores decía `27/27` cuando el §0 generado, en este archivo, dice
> **37/37**. El generador solo reescribe entre marcadores; §2, §3, §4 y §7 siguen
> teniendo conteos tecleados. Los que quedan ahora citan **`→ ver §0`**.

---

## 8. Resumen numérico

| Estado | Cantidad | Detalle |
|---|---|---|
| **E+C+V** | 21 | núcleo `spec.md` (14, con las **invariantes** que pasaron de huérfanas a AC-DATA-2) + maquetas construidas (6) + fuentes autoalojadas |
| **E+C+SV** | 2 | INT-12 (gate en FAIL) · **temporizador de permanencia** (ningún comando) |
| **E+NC** (deuda) | 6 | deploy por `git push`, retención INT-7, `1e`, `1g`, `1l`, mitad de `1f` |
| **C+NE** (huérfanos) | 8 | ver §7. Eran 9: las **invariantes de base salieron**, porque `f98a652` les creó `AC-DATA-2` |
| **Bloqueadas** | 6 maquetas | multisitio (ADR-001 no enmendado en esa fila) |
| **Habilitadas y bloqueadas** | 2 maquetas | `1i`, `1j` — falta AC-SCOPE-1 y `{{PRECIO_SUSCRIPCION_UF}}` |
| **Sin datos** | 1 | **H1** — el propósito del proyecto |

---

## 9. Límite declarado de esta matriz

La columna *¿Verificado?* cita comandos, y §0 pega la salida real de la última
corrida generada. Tres advertencias honestas:

1. **§0 no siempre corre la suite entera.** Los grupos `navegador`, `servidor` y
   `build` exigen la app levantada; cuando no se corrieron, la tabla lo dice
   `NO CORRIDO` y esta matriz sigue citando el veredicto vigente registrado en
   `LEDGER.md`. Un `NO CORRIDO` **no es un PASS viejo**: es la ausencia de una
   medición de hoy.
2. **`verificar:int12` imprime `PASS` y su fila dice FAIL.** No es contradicción:
   el comando pasa y el gate no es confiable. Desde el 2026-08-14 está registrado
   como **riesgo aceptado por decisión humana** (`LEDGER.md`), no como pendiente.
   La matriz refleja el veredicto, no el número.
3. **Una corrida verde es válida para el estado en que se tomó.** 6 de los 9
   verificadores de navegador limpian fixtures **al iniciar**, así que cada tanda
   arrasa con las filas de la anterior y deja las suyas. La base no queda en
   cero: queda con la última tanda. Ninguna acumula, que es por qué H1 no tiene
   datos — ver §5.2.
