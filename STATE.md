# STATE.md — cursor de reanudación

> Archivo **sobrescribible**, corto por diseño. Puntero O(1) para retomar sin
> releer `LEDGER.md` entero. El ledger es append-only y la verdad histórica:
> ante discrepancia, manda el ledger.

**Actualizado:** 2026-08-20 (noche)

**URL viva: https://estacionamiento-three.vercel.app** — responde 200.

| | |
|---|---|
| **Último hito cerrado** | M5 — Endurecimiento (código y deploy) |
| **Hito en curso** | M6 · **FASE C** de la estrategia nueva (B cerrada) |
| **Bloqueo activo** | ninguno. El gate de evidencia quedó **FAIL, riesgo aceptado** (2026-08-14) |
| **INT-12** | riesgo aceptado por decisión humana (2026-08-14). Ya no detiene el hito |
| **Próximo paso** | **Llenar el banco de H1 tecleando en la app.** El instrumento existe y falla por falta de datos, que es lo que tiene que hacer |
| **FASE D** | **construida** (2026-08-16). `npm run verificar:h1` publica la mediana con su `n`, separa tres poblaciones y **falla con el banco vacío** |
| **El bloque de §0 ya NO está todo en verde** | `verificar:h1` sale **FAIL** a propósito. **No lo “arregles”**: mientras el banco esté vacío, ese FAIL *es* la medición |
| **Rama paralela de documentación** | T01 · **los cinco entregables cerrados** el 2026-08-15. ADR-005 queda **PROPUESTO**: adjudicarlo es decisión humana |
| **~~HALLAZGO alcance~~ · CERRADO** | el gate ya cubre la jerarquía sobre `estacionamiento` (AC-SCOPE-4, M8). Multicliente sí, multisitio no |
| **Harness (unificación de agentes)** | **FAIL, BoundedLoop agotado** (2026-08-16). Funciona y **no se declara verificado** — igual que INT-12. Reabrirlo es decisión humana |
| **spec-driven · huérfano declarado + tipo de AC** | cerrado en código el 2026-08-16, **SIN AUDITAR**. `verificar:ac` pasó de 5 a 9 comprobaciones |
| **FASE D-2 · AC-H1-2** | **FAIL registrado, hito detenido** (2026-08-17). Tres ciclos, tres VETO. El último bypass publicó **10 s sobre un tecleo real de 40 s con el criterio en verde**. `AC-H1-2` **no se declara verificado**; el criterio queda escrito y su verificación, corregida para decir lo que hace. Detalle y salida técnica en `LEDGER.md` (2026-08-17) |
| **M7 · integridad del cierre y frontera de entrada** | **PASS** (2026-08-17). La carrera del cierre está cerrada —8 de 8 respuestas la cerraban, ahora 1 de 8— y la frontera dejó de producir 5xx. AC-OP-5 y AC-API-1 nuevos en §9, **probados fallando contra el árbol sin corregir**. Cero migraciones |
| **Hallazgo nuevo, del corpus y no de lectura** | un **byte NUL** en el email daba 503 en `/api/login`. Postgres no lo admite en `text`; atravesaba las tres validaciones y reventaba en el driver. Corregido con `esTextoAlmacenable` |
| **M7 · el envoltorio de ruta** | **HECHO** (commit `d9df8a9`). `exigirRol` corre dentro del `try` vía `rutaAutenticada`; `verificar:endurecimiento` lo hace cumplir por exclusión (33/33). *(La línea anterior decía «sin hacer» y estaba desactualizada.)* |
| **/loop del concilio · 6 pendientes** | **cerrados** (2026-08-18). FE-6 (guarda de vuelo + cierre diferido en `verificar:concurrencia`), FE-5 (aria + foco patente), H-5/H-6 (409 nombra solo el email que choca, carrera verificada), FE-3 (`sembrar` crea el usuario plataforma; `aislamiento` ya no lo borra — revierte `094a900`), H-7 (contrato). Probados con fallo plantado. Los 3 agentes auditores murieron por error de API; verificación hecha con evidencia real |
| **M8 · multicliente** | **PASS** (2026-08-17). ADR-005 **ACEPTADO** en su alternativa 2 por decisión explícita y repetida del decisor. Rol `plataforma`, alta de cliente por API y pantalla, y el control negativo de aislamiento con **dos** clientes: `verificar:aislamiento` 9/9, probado fallando al borrar una cláusula real (`FUGA: ve FIXT71`) |
| **El hueco del gate se cerró, y fue lo primero** | `AC-SCOPE-4`: el modelo no puede tener jerarquía sobre `estacionamiento`. Multicliente sí, multisitio no. Probado con `tenant` plantado: 10/11 y FALLARON |
| **Transacciones: ya existen** | el alta escribe cuatro filas indivisibles. Es la condición de reversión que M7 declaró, y se cumplió el mismo día |
| **M6 · maqueta `1e` (Tarifas)** | **PASS** (2026-08-19). El dueño ya puede cargar una versión nueva de tarifa: pantalla, ruta, histórico y simulador que corre `calcularMonto` (sin un solo número escrito a mano). `verificar:tarifas` **11/11**, probado con el fallo plantado (201 sin versionar → 7/11) |
| **M6 · maqueta `1g` (Reportes)** | **PASS** (2026-08-20). El «dashboard por período» que faltaba: sesiones, ingresos observados y permanencia media de 7 días, más el gráfico por día. Las tres cifras se comparan **contra la base**, no contra la maqueta: `verificar:reportes` **10/10**. El «tecleo mediano» va vacío A PROPÓSITO —el diseño lo pide así y la métrica de H1 tiene un solo dueño, `verificar:h1`— y el verificador **falla si alguien publica un número ahí**. Sin CSV: sacaría dato personal fuera de todo control de retención (INT-7). **Queda solo `1l`** |
| **AC-OP-1 tenía un `true` escrito a mano** | corregido (2026-08-19). `verificar-op1.mjs:155` afirmaba *«la UI muestra el vehículo aunque no haya red»* con una **constante**. Y AC-UX-1 estaba construido sin verificar. Con el fallo plantado: 10/12, fallando solo las dos nuevas. Ahora **12/12** |
| **`verificar:frontera` 4/5 → 5/5** | la ruta nueva exigía rol `dueño` y el verificador no tenía esa sesión: **su piso la delató**. Corregido; 231 casos degenerados sin 5xx |
| **FE-1 · doble toque** | **CERRADO** (2026-08-19). Guarda de reentrancia en `confirmar`, mismo patrón que `registrarSalida`. Medido: `2 registros / 2 filas` antes, `1 / 1` después. `verificar:op1` 12/12 → **14/14** |
| **Endurecimiento transversal** | **PASS** (2026-08-19). `Cache-Control: private, no-store` en todos los caminos de salida del envoltorio + login · `statement_timeout 8s` / `idle_in_transaction 5s` en `src/db/index.ts` (medido: waiter esperaba **14,6 s sin techo**) · cota de rango de fecha **503 → 400** · `enteroDeFrontera`/`fechaDeFrontera` consolidados en `src/lib/frontera.ts` con **`frontera.test.ts`** nuevo (134 pruebas, eran 122) |
| **Hallazgo sobre la propia suite** | el corpus de `verificar:frontera` **no alcanza** las validaciones aguas abajo de la primera guarda: manda el mismo degenerado en todos los campos y `validarPatente` corta antes. Medido con la cota quitada: **5/5 PASS igual**. Por eso AC-API-1 daba verde sobre un 503 real. Rediseñar la sonda es decisión, no ajuste |
| **BLOQUEADOS por decisión humana** | **API-1**: agregar 404 a `esRechazoDefinitivo` cambia «bloqueo permanente de la cola» por «pérdida de ingresos si la ruta 404ea en un deploy» — es decisión de producto. **SEG-1**: el DoS de cuenta es trade-off entre fuerza bruta y disponibilidad, misma familia que `CLAVE_ACCESO` compartida |
| **CONCILIO · hallazgos ABIERTOS** | diagnóstico integral con evidencia reproducida, **ninguno corregido** (WIP=1). Los tres de mayor riesgo: **API-1/API-2** (la cola offline se bloquea para siempre por un 404 mal clasificado y por un 503 sobre fecha fuera de rango), **SEG-1** (DoS de cuenta: 6 peticiones sin autenticar bloquean el login del operador real) y **FE-1** (doble toque en «Confirmar» duplica el ingreso). Detalle y evidencia en `LEDGER.md` (2026-08-19) |
| **TMP-1 · defecto real, preexistente** | `verificar:temporizador` 11/14: una fila muestra **`0 min`** en el primer pintado y se corrige después (`pantalla "0 min" · entrada_at implica "2 h 20 min"`). No lo introdujo este hito |
| **Capa administrativa de plataforma** | **PASS** (2026-08-19). `AC-ISO-2` pasó de **enumerar dos rutas** a escanear **por exclusión** toda la superficie de plataforma: `verificar:aislamiento` 9/9 → **12/12**, probado con una ruta plantada que repartía patentes —las dos comprobaciones viejas seguían en PASS—. Y el **listado de clientes** de SPEC-005 §3.1 (sin ocupación, sin ingresos, sin patentes, sin correos) |
| **Directus / MCP · RECHAZADO, no pendiente** | rompe `AC-DATA-1` y se midió: con dos tablas `directus_*` plantadas, `verificar:esquema` da **7/8 exit=1**; borradas, vuelve a 8/8. Además no hay servidor MCP de Directus configurado en el entorno. Adoptarlo **va por ADR**: la pregunta está formulada en `LEDGER.md` (2026-08-19) |
| **Contrato de API** | `docs/CONTRATO-api.md`, derivado del código, con su sección de lo que NO cubre |
| **Placeholders** | ninguno se rellenó. `{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}` bloquean el **encendido**, no la construcción: se opera con `OPERACION_REAL_HABILITADA=false` |

## 2026-08-20 (noche) — MCP CONECTADOS · dominio vivo · SEG-2 corregido

### Los cinco MCP están conectados

`claude mcp list` → `vercel`, `cloudflare-api`, `cloudflare-docs`,
`cloudflare-workers-builds`, `cloudflare-observability` **todos ✔ Connected**.
La autorización OAuth ya está hecha; **no hay que repetirla**.

### `parkcontrol.cl` ESTÁ VIVO

Lo que por la mañana era `NXDOMAIN` hoy resuelve. La delegación en NIC Chile
ocurrió: la zona está `active` (`activated_on 2026-08-21T00:04:10Z`) y la
resolución pública contra `1.1.1.1` devuelve IPs de Cloudflare.

```
https://www.parkcontrol.cl/login   200  server=cloudflare  x-vercel-id=gru1::iad1
https://parkcontrol.cl/login       308  → www
```

**Los registros pasaron a nube NARANJA** (`proxied=true`), que no era lo previsto.
Funciona, y el `Cache-Control` del origen atraviesa el proxy intacto.

### SEG-2 / M-8 · corregido en código, **NO cerrado como meta**

`identificarCliente` ya **no lee `x-forwarded-for`**: usa `cf-connecting-ip` →
`x-vercel-forwarded-for` → `x-real-ip` → clave fija. Unitarias 138/138, probado
con el fallo plantado (código viejo: 10/15).

**Desplegado y medido contra producción**, que es lo que M-8 exige:

```
www.parkcontrol.cl        (corregido, por Cloudflare)  corta en el 6.º   PASS 2/2
qm0gp9tav…vercel.app      (código VIEJO, directo)      NUNCA CORTA       FAIL 0/2
g030z2n5h…vercel.app      (corregido, directo)         NUNCA CORTA
```

Verificador nuevo: **`npm run verificar:seg2`**, probado fallando contra el deploy
inmutable del código viejo.

**M-8 sigue ABIERTA.** Por Cloudflare corta en el número exacto; por el camino
directo `*.vercel.app` no corta nunca — y **no es por la cabecera**: pasa igual
con código viejo, con código nuevo, y sin forjar nada. Eso es **M-10**.

### M-10 · nueva · el limitador no corta por el camino directo

**Causa SIN DIAGNOSTICAR, y así queda declarado.** La primera explicación que
escribí —«16 instancias», contadas sobre `x-vercel-id`— **la retracté yo mismo**:
esa cabecera identifica la petición, no la instancia, y por Cloudflare cortó
igual con 26 valores distintos. Tercera vez en este repo que el defecto está en
el instrumento (van M-2, TMP-1 y ésta). Detalle en `LEDGER.md` (noche 3).

Lo que hace falta antes de concluir: **una señal de instancia real puesta por la
app**, no una cabecera de la plataforma reinterpretada.

### PENDIENTE · Cloudflare, bloqueado por permisos del token

El token OAuth del MCP **lee pero no escribe** (`9109` en zona, `10000` en DNS,
`1000` en `/user/tokens/verify`). **Nada se aplicó.** Los cuatro ajustes, con su
razón, están en `LEDGER.md` (2026-08-20 noche). El resumen:

| Ajuste | Hoy | Debe ser |
|---|---|---|
| `ssl` | `full` | `strict` |
| `min_tls_version` | **`1.0`** | `1.2` |
| `always_use_https` | `off` | `on` |
| `browser_cache_ttl` | `14400` | `0` |

Se resuelve de una de dos formas, y **es acto humano**: (a) tocarlo en el panel
de Cloudflare, o (b) crear un API Token con `Zone Settings:Edit` + `DNS:Edit`
acotado a `parkcontrol.cl`, ponerlo en `.env` y aplicarlo con un script.

### M-8 y M-10 · CERRADAS (2026-08-20, `5b14917`)

`estacionamiento-three.vercel.app` respondía en directo, sin pasar por Cloudflare.
Por ahí el limitador no cortaba —30 intentos, 0 cortes— y cada petición era una
invocación facturada sin techo. **Seguridad y costo eran el mismo agujero.**

Corregido con `src/lib/host-canonico.ts` + `src/proxy.ts`: **308 al host canónico**
—no 403, que dejaría la app inalcanzable si el dominio fallara—, y el `matcher`
pasó a cubrir **también `/api`**, que era justo lo que quedaba afuera.

```
verificar:seg2 contra el camino que antes evadía
  ANTES: 429=0   -> NUNCA CORTA     FAIL 0/2
  AHORA: 429=20  -> corta en el 6   PASS 2/2     (maxIntentos = 5)
```

**M-10 se cierra por INALCANZABLE, no por diagnóstico.** La causa de que el
limitador no acumulara por el camino directo sigue sin entenderse; lo que se hizo
fue rodearla. La propiedad queda protegida y la pregunta abierta.

`URL_PRODUCCION` pasó a `https://www.parkcontrol.cl`.

### Costo de Railway · el gasto NO es de parkcontrol

Ciclo 1–21 de agosto: **farmTag = 89,7 % de la memoria** del equipo, con **cero
servicios visibles** — servicios borrados y un `postgres-volume` huérfano que se
cobra igual. *Pausar detiene el cómputo, no el disco.* parkcontrol no aparece
entre los 12 primeros de memoria y es 1,0 % de la CPU.

Herramientas de solo lectura, con tope de 12 peticiones por corrida, espaciado de
1,2 s y **detención ante un 429** en vez de reintento:
`railway:estado` · `railway:gasto` · `railway:anomalia` · `railway:ciclo`.

**La medida de fondo para bajar el piso:** la app es serverless (Vercel, cobra por
uso) pero la base está encendida 24/7 (Railway, cobra por existir). ADR-003 movió
la base a Railway *«porque ya existía una instancia provisionada»* y dejó escrito
el costo asumido. Esa razón era de conveniencia y **no sobrevive a un
presupuesto**: Neon escala a cero. Reabrirlo va por ADR.

### Directus · NO instalado. Bloqueo medido, no supuesto

Sondeada la base viva: **ninguna tabla `directus_*`**. Esquemas `drizzle` y
`public`, las cuatro entidades de siempre, y los fixtures del piloto
(estacionamiento 3 · usuario 7 · tarifa 3 · sesion_vehiculo 2).

**`npm install directus@latest` FALLA** compilando `isolated-vm` (módulo nativo):
no hay Python real —el `python.exe` del PATH es el **stub de la Store**— ni
compilador de C++. `--omit=optional` no sirve: es dependencia dura. Sin Docker
tampoco hay salida. **No se instalaron las Build Tools**: son varios GB en la
máquina de alguien y no es decisión de un agente.

**La base de descarte ya está lista** y se queda a propósito, para que M-11
arranque sin preparación:

```
npm run base:descarte   ->  directus_descarte · esquema consola · 0 tablas
```

Tres caminos para destrabar M-11, todos actos humanos: (a) Docker Desktop;
(b) Python + Build Tools; (c) **Directus en Railway desde su imagen oficial** —que
es donde tiene que vivir de todos modos (traducción §2.1)— y necesita un token de
la API de Railway que hoy no está en `.env`.

### El modelo, extraído del motor — `docs/MODELO-datos.md`

`npm run modelo` lo genera desde `pg_catalog` de la base viva, **no** desde
`src/db/schema.ts`: *el DDL dice lo que alguien quiso, el motor dice lo que hay.*
**4 entidades · 27 campos · 41 restricciones · 8 índices**, con diagrama Mermaid.
No incluye datos: los conteos son estadísticas del motor.

**Consecuencia de arquitectura, y es lo que importa:** *data-driven es la base*
implica que **Directus entra database-first, no schema-authoring**. El modelo ya
existe y es autoritativo —`AC-DATA-1` lo pinnea, `AC-DATA-2` pone sus invariantes
en la base—. Si Directus autorara el esquema habría **dos dueños del modelo**, y
un criterio que hoy da 8/8 pasaría a depender de cuál escribió último.

### Guía externa (Directus + Qdrant) · traducida, adjudicada, NO ejecutada

Decisión humana del 2026-08-20: *«qdrant y directus mantener, pero Vercel se
queda acá»*. Traducción completa en **`docs/guia-2026-08-20-traduccion.md`**.

**Fuera por gate, y no por criterio propio:** `parking_transactions` (ADR-001,
entidad `Transaccion`) y la jerarquía `parking_lots` (AC-SCOPE-4, multisitio).
`verificar:alcance` sigue **11/11**.

**Lo central:** Directus y Qdrant **no corren en Vercel** —son servicios de larga
vida con estado en disco—. Con Vercel conservado, la topología es *Next.js en
Vercel · Directus y Qdrant en Railway*. Cuesta pasar de un servicio desplegado a
tres. Y **no hay `docker` ni `pnpm` en este entorno** (medido): todo el flujo
`pnpm dev` / puertos `18701`–`18708` / worktrees con `--offset` no traduce.

| | |
|---|---|
| **ADR-006** | **ADJUDICADO** a la alternativa 1 (Directus en esquema propio). **VIABLE-SIN-VERIFICAR**: falta la medición de su §2.3 → **M-11**, bloqueada por entorno |
| **ADR-007** *(nuevo)* | Qdrant adjudicado y **bloqueado por H-6**: qué se indexa. No pueden ser sesiones (patente = dato personal, INT-7). Hoy **no hay corpus** |
| **AC-SECRET-1** | **PASS.** Nuevo en `spec.md` §9. `npm run verificar:secretos` |

### AC-SECRET-1 · encontró cinco cosas en la primera corrida

Ninguna era fuga: dos rutas de máquina en `LEDGER.md` —**redactadas**, sin tocar
el texto de las entradas— y tres fixtures que se ven como fixtures, dentro de las
pruebas de `redactarSecretos`, que **por su función tienen que contener cadenas
de conexión**. El criterio se afiló con `CLAUDE.md` §3 como discriminante en vez
de silenciarlas: una credencial real no vive en `.invalid` ni se llama
`CLAVE_DE_PRUEBA`. Probado con **4 fallos plantados a la vez**, incluida una
cadena realista sin marcas de fixture.

### Premisas descartadas con evidencia (no volver a abrirlas sin ADR)

- **Directus**: ~~rechazado~~ **ADJUDICADO el 2026-08-20** por decisión humana (ADR-006 alt. 1). La medición del 2026-08-19 sigue siendo válida para la instalación en `public`, y sólo para ésa.
- **JWT**: metería un retroceso. La sesión ya es HMAC-SHA256 con vencimiento
  verificado en servidor y **rol releído de la base en cada petición** — lo que un
  JWT justamente no hace. Cerró A-1 y M-3.

### Trabajo pendiente que NO depende del dominio

- **M-6** · que la sonda de frontera confirme un fallo **aislado** antes de
  reportarlo. Es el mismo patrón que cerró TMP-1 y reclasificó M-2.
- **M-5, M-7, M-9** y `1l` (M-4, necesita el lienzo por `DesignSync` desde el
  agente principal).
## 2026-08-20 (noche) — M-1 (MET-1) CERRADO · el FAIL de H1 volvió a ser el suyo

**Esto reemplaza a los puntos 1 y 2 del bloque de la tarde.** MET-1 está
corregido y `verificar:h1` volvió a fallar **por banco vacío**, que es su FAIL
deliberado. Evidencia completa en `LEDGER.md` (2026-08-20, noche).

```
verificar:metrica → 5/5 PASS
verificar:h1      → 9 comprobaciones de control PASS · CAUSA: banco-vacio · AC-H1-1: FAIL
regresión estático+base → 12/13 PASS · el único FAIL es verificar:h1, el deliberado
```

Eran **dos** guards rotos, no uno, y del mismo defecto de familia —comparar
formas distintas del mismo texto—:

1. **MET-1a** · `scripts/lib/metrica.mjs`: la búsqueda normalizaba **un solo
   lado**, así que `OTRO_DOMINIO.has()` no acertaba nunca. La misma resta salía a
   la vez «sin declarar» y «declarada que sobra».
2. **MET-1b** · `scripts/verificar-h1.mjs`: el control de invasores del banco leía
   el fuente **crudo** y contaba el backtick de un JSDoc como comilla de literal.
   Los dos «invasores» eran **comentarios que explican que no invaden**. Un guard
   que cuenta menciones en comentarios castiga documentar la regla.

Probado con **tres fallos plantados** (A: resta divergente sin declarar → 4/5 ·
B: declaración rancia → 3/5, reproduce el síntoma original · C: literal `FIXTB99`
real → `CAUSA: control-negativo`). Los tres revertidos.

**No se corrieron** los grupos de servidor y navegador: exigen `npm run build` +
`npm start` y son la meta **M-3**. **AC-H1-2 sigue SIN VERIFICAR.**

> **Próximo paso: M-2** (el 503 de `POST /api/sesiones/[id]/salida`), y su primer
> acto es **reproducirlo con los tres roles**, no corregir. Después M-3 y recién
> ahí el commit. Las metas, con su condición de término, están en `METAS.md`.

## 2026-08-20 (tarde) — REANUDACIÓN: leé esto primero

**Sesión cortada por reinicio.** No se commiteó nada y no se corrigió nada. Lo
que sigue es **medición real de hoy**, no lectura del ledger.

### Cómo correr la regresión (esto costó una corrida entera)

Los verificadores de navegador exigen **producción**, no `next dev`:

```powershell
npm run build ; npm start          # y recién entonces los verificadores
```

Con `next dev`, `verificar:ui` da **12/21** y el fallo es del servidor, no del
código. Con `npm start`, **21/21**. Si el puerto 3000 quedó tomado por una
corrida anterior, `npm start` muere con `EADDRINUSE` y el `curl` de humo sigue
dando 200 **desde el servidor viejo**: matá el listener antes.

### Baseline medido hoy sobre el árbol SIN COMMITEAR

```
test 134/134 · build exit=0 · alcance PASS · ac PASS · citas PASS
verificadores PASS · esquema PASS · invariantes PASS · salida PASS
concurrencia PASS · aislamiento PASS · tarifas PASS · reportes PASS
op1 PASS · meas1 PASS · meas2 PASS · a3 PASS · m4 PASS · pwa PASS
endurecimiento PASS · ui 21/21 · temporizador 14/14
```

### Tres cosas que el ledger NO dice y la medición sí

1. **MET-1 · `verificar:metrica` 3/4 FAIL.** Regresión **introducida por el
   trabajo sin commitear**: `scripts/verificar-reportes.mjs` usa
   `salida_at - entrada_at` (permanencia media, legítima) y el guard la lee como
   métrica de H1 divergente. Salida real:
   `FAIL · toda resta entre columnas de tiempo es la métrica declarada · 1 divergente(s): scripts/verificar-reportes.mjs: «salida_at - entrada_at»`
   **Por qué pasó:** la regresión final del ledger de ayer lista 22 verificadores
   y **`metrica` no está entre ellos**. La lección es del tipo que hay que
   convertir en guard: *una regresión que no se corre no existe.*
2. **`verificar:h1` ya NO falla por banco vacío.** Falla con
   `CAUSA: metrica-divergente`, o sea **MET-1 está tapando al FAIL que
   `STATE.md` declara deliberado**. Cuando MET-1 cierre, `verificar:h1` tiene
   que volver a fallar por banco vacío — y eso hay que comprobarlo corriéndolo,
   no suponerlo.
3. **`verificar:frontera` 4/5 FAIL** — `POST /api/sesiones/[id]/salida` devuelve
   **503** con byte NUL y con año fuera del rango de Postgres, dos veces cada
   uno. Es 5xx en el camino del dinero, y un 5xx **bloquea la cola del turno
   entero** (`cola-local.ts:276-278`).
   **OJO, no está diagnosticado:** reproducido a mano **como `operador` da 400**,
   no 503 —`{"error":"Id de sesión inválido."}`, `esIdValido` corta bien—. El
   verificador entra con **tres** roles (operador, dueño, plataforma) y cada caso
   falló **dos veces**: el 503 sale por los otros roles, no por el operador. El
   sospechoso es el usuario `plataforma`, que se siembra con
   `estacionamiento_id NULL`. **Hay que reproducirlo con los tres roles antes de
   tocar nada.** El repro a medio escribir quedó en el scratchpad y se perdió:
   se reescribe con `import postgres` resuelto desde el repo, no desde `$TEMP`
   (ahí falla con `ERR_MODULE_NOT_FOUND`).

### Orden acordado, por riesgo real

**MET-1** → **el 503 de `salida`** → **commit de todo lo verificado** → **`1l`**
→ el resto de los hallazgos abiertos (QA-1, BE-2, BE-3, SEG-2).

**Nada se commitea sobre rojo.** El árbol tiene 21 archivos modificados y 7 sin
rastrear (tarifas, reportes, endurecimiento transversal, `frontera.test.ts`,
`zona.ts`) que **son trabajo verificado de las sesiones del 19 y 20**, no de
ésta.

### Trabajo en vuelo que el reinicio se llevó

- Un `implementador` estaba corrigiendo **MET-1** (hacer que el guard distinga
  una resta publicada como H1 de una resta de otro dominio **declarada con su
  motivo**, al estilo de los huérfanos declarados de `verificar-ac.mjs`, sin
  debilitar la propiedad). **Sin auditar y sin verificar: hay que rehacerlo o
  revisar si dejó cambios en el árbol.**
- Un agente estaba extrayendo la maqueta **`1l`** del lienzo de Claude Design
  (`DesignSync`, proyecto `964c3090-9776-4aa0-a79f-816b50244a83`, archivo
  `Plataforma Estacionamientos.dc.html`) para poder construirla sin inventar
  textos ni cifras. **No entregó, y por un motivo que hay que saber antes de
  reintentarlo: `DesignSync` NO está disponible dentro de un subagente.** Lo
  buscó cuatro veces por `ToolSearch` y no aparece ni por `select:` ni por
  palabras clave. **La extracción del lienzo la tiene que hacer el agente
  principal**, guardando el `.dc.html` en el scratchpad y recorriéndolo con
  grep/sed para no volcarlo entero en contexto. `1l` es la **única** pantalla
  construible que falta.

  Lo único literal de `1l` que el repo preservó son tres cadenas, ya presentes
  en el código de `1b` (`src/app/pantalla-operador.tsx:560`, `:496`, `:616`):
  *«Se normaliza sola. Sin guiones ni espacios.»* (AC-UX-4), el badge **Sin
  conexión** y *«2 registros esperando red»* (AC-UX-1). **Lo que `1l` agrega
  sobre `1b` —el teclado, el tamaño del campo, la jerarquía sin lista de
  permanencia— no está escrito en ninguna parte del repo: sin el lienzo,
  construirlo es inventarlo.**

### Sin cambios

Ningún `{{placeholder}}` se rellenó. Gate ADR-001/004 intacto. Cero migraciones.


## FASE D (2026-08-16) — «SIN DATOS» dejó de ser una frase y pasó a ser un FAIL

`npm run verificar:h1`. Hasta hoy *«H1 nunca se midió»* vivía en documentos; ahora
es un comando que falla. `AC-MEAS-1` **no podía** fallar por ausencia de datos —un
`count(*)` sobre un `WHERE` es vacuamente verdadero sobre el conjunto vacío—.
`AC-H1-1` es **existencial**: su salida es un número.

**Tres poblaciones que nunca se mezclan:** real (`NOT LIKE 'FIXT%'`, la única que
vale), banco (`LIKE 'FIXTB%'`), y efímero (el resto de `FIXT%`, que es **tecleo de
robot**). En su primera corrida el instrumento encontró 4 efímeras con mediana
**1,53 s** — un número plausible, reproducible y basura. Publicarlo habría sido el
`6,2 s` inventado otra vez.

**El banco sobrevive a la limpieza, y solo el cerrado.** `FIXTB…` sigue siendo
fixture para la barrera de A-3, así que `AC-PDP-1` no se tocó: cero migraciones,
cero campos. Una fila de banco **activa** se barre como cualquier fixture — dejarla
viva rompía `verificar:op1` (8/11) y `verificar:meas2` la cerraba clickeando a
ciegas, contaminando la muestra.

**Para vaciar el banco a propósito:** `npm run limpiar:fixtures -- --banco`.

**Lo que el instrumento NO puede saber, y por eso no lo afirma:** la procedencia.
Un `INSERT` con duraciones a mano entra al banco y da PASS. Está declarado en su
salida en vez de fingir una garantía.

**Cambio de semántica que conviene mirar:** `verificar-meas2.mjs` comparaba el
panel contra **la tabla entera**; ahora usa los filtros del panel. Sostengo que
recién ahora verifica lo que AC-MEAS-2 dice. Detalle en `LEDGER.md` (2026-08-16).

**Defectos del repo corregidos de paso:** `limpiar:fixtures` no tenía
`--env-file=.env` (nunca funcionó por su puerta documentada); y
`scripts/verificar-ac.mjs:95` filtraba `AC-[A-Z]+-\w+`, así que **`AC-H1-1`
desaparecía en silencio** — §9 declaraba 14 criterios y el guard contaba 13.

## Rama de documentación T01 (2026-08-15) — no toca código

**Ojo con el árbol: esta rama NO es `main`.** Es
`agents/medir-documentacion-historias-casos-uso` (`2c396c4`), que tiene a `main`
(`2c9e286`) por ancestro. `docs/data/actores.md` y `docs/data/historias-usuario.md`
**no existen en `main`**. Integrar la rama o dejarla paralela es decisión humana
pendiente.

`docs/data/actores.md` y `docs/data/historias-usuario.md` escritos. Ítem 2 del
Trabajo 01 pasa de **0/80 a 80/80** estimado; total **13/100 → 93/100**.

**Entregable 3 cerrado (I1, 2026-08-15).** `docs/data/casos-uso.md` reescrito:
nueve flujos numerados —ocho casos más el flujo de excepción **E1**, que es el ex
CU-08—, 55 pasos todos citados, traza CU ↔ historia en las dos direcciones y
**cinco huecos de traza declarados sin rellenar**. El más caro es **CU-10 (medir
H1): no le falta pantalla, le falta el actor.** Tres ciclos de auditoría, ocho
hallazgos; el ciclo 3 dio PASA. **Ítem 3 sigue en 3/10**: I1 no lo toca.

**Entregable 4 cerrado (I2, 2026-08-15).** `docs/data/seleccion-prototipo.md`:
se seleccionan **H-01, H-03 y H-05** contra tres ejes, ancladas a `spec.md` §1,
con las siete descartadas puntuadas. **Ítem 3 sube de 3/10 a 10/10 estimado; total
93/100 → 100/100 estimado** — estimación propia, no nota del evaluador.

**El hallazgo que produjo hacer la selección: el prototipo está completo como
producto y vacío como instrumento.** Siete de las diez historias están
construidas; la hipótesis que las justifica nunca se midió. Bajo la regla 1 del
propio documento, lo que sigue no es una historia de la lista: es el instrumento
que le falta a H-01, y **CU-10 no tiene actor**.

**Lección del ciclo, con nombre: U7.** *Toda afirmación sobre el repositorio es
verificable con un comando* — y su forma operativa, que es la que costó dos
ciclos: **no alcanza con medir antes de escribir; hay que buscar todas las
ocurrencias de lo que se acaba de refutar.** Un `grep` del claim, no del dato.
Dos veces un fix corrigió una mitad y dejó viva la otra.

**Y su corolario, que costó un veto en I2:** una transcripción con prompt `$` que
no se corrió es peor que no ponerla. El documento publicaba `21/21` como *«medido
hoy»* siendo un número de la iteración anterior — dentro de la sección que
declara que un PASS viejo no es una medición de hoy. El real era 23/23.

**Entregable 5 cerrado (I3, 2026-08-15).**
`docs/adr/ADR-005-modelo-de-tenant-y-panel-de-administracion.md` y
`docs/SPEC-005-panel-de-administracion.md`, los dos en **PROPUESTO**. Ponen sobre
la mesa la pregunta que ADR-004 nunca adjudicó —**multicliente** (N clientes, un
recinto cada uno) ≠ **multisitio** (un cliente, varios recintos)— con cuatro
alternativas, cada una con condición de reactivación falsable, consecuencias
negativas y verificación por estructura. **Se recomienda la alternativa 2 y NO se
adjudica.**

## HALLAZGO ABIERTO · el gate de alcance no cubre `tenant` ni `plataforma`

**Encontrado auditando I3, reproducido, y NO corregido.** `verificar-alcance.mjs`
no menciona `plataforma` ni una vez, y `tenant` no está en su lista de entidades
prohibidas (`scripts/verificar-alcance.mjs:91`). Con el rol, la entidad y una
pantalla de aprovisionamiento plantados en una copia aislada, el gate da
**`9/9 comprobaciones PASS · ALCANCE: PASS · exit=0`**.

**Un cambio que introduzca multisitio pasa el gate y puede reportar AC-SCOPE en
verde.** Es la familia de INT-12 y del gate de evidencia: la propiedad se
sostiene —en el árbol real no hay `tenant`—, el mecanismo que la vigila no.

**Corregirlo no es agregar `tenant` a una lista** —eso repite el defecto de la
enumeración—: es extender el gate **por exclusión**, como ya se hizo con las
pasarelas, y probarlo con el fallo plantado. Detalle y reproducible en
`LEDGER.md` (2026-08-15).

**Tres hallazgos que sobreviven a esta sesión y valen para el producto:**

1. **No hay `tenant` en el repo** — ni entidad, ni columna, ni rol `plataforma`
   (`src/db/schema.ts:31`, `src/lib/contexto.ts:16`). Lo que existe es aislamiento
   por `estacionamiento_id`.
2. **Ese aislamiento no tiene un solo control negativo.** Ningún verificador
   siembra un segundo estacionamiento: la separación se cumple por construcción
   **y por tener un cliente solo**. Es la casualidad que M-2 corrigió, en otro
   lugar.
3. **ADR-004 nunca adjudicó «N clientes, un recinto cada uno».** Rechazó
   *«multisitio bajo un tenant»* como paquete. La pregunta está **abierta**: no
   habilitada, tampoco resuelta. Es el insumo de **ADR-005**.

**Bug de guard registrado y NO corregido — pero HOY NO SE VE.**
`scripts/verificar-citas.mjs:77` exige `\n` tras la valla ```` ```mermaid ````.
Medido el 2026-08-15: `flujos.md` y `MER.md` están en el árbol de trabajo con
**LF**, no CRLF, así que `verificar:citas` da **21/21** y reporta 3 y 2 diagramas
— no el `PASS · 0 diagramas` del conjunto vacío.

**El defecto está dormido, no corregido.** Probado sobre una copia CRLF sin tocar
el guard: regex actual → **0 bloques**, regex `\r?\n` → 3. Con `core.autocrlf=true`
y sin `.gitattributes`, **un clon nuevo vuelve a CRLF y el guard vuelve a fallar**.
Detalle y medición en `LEDGER.md` (2026-08-15).

## DECISIÓN TOMADA (2026-08-14) · el segundo meta-gate que agota el BoundedLoop

**Resuelto: se acepta como riesgo, igual que INT-12, y se pivotea a FASE D.**
El gate de evidencia queda **FAIL registrado y no reabierto**. La salida técnica
que dejó el auditor —comparar también las filas `NO CORRIDO` contra su celda
esperada, que el generador ya conoce, y sacar la comprobación de marcadores
únicos de la rama `--actualizar`— queda **documentada y no implementada**, igual
que la de INT-12.

Fundamento de la asignación: el costo de oportunidad de seguir endureciendo el
instrumento que vigila instrumentos, contra un propósito —H1— que no tiene un
solo dato.

**Lo que hay que seguir sabiendo mientras el riesgo esté vivo:** el bloque §0 de
este archivo y de la matriz **se puede forjar en las filas que la corrida habitual
no mide** (todo el grupo `navegador`), y el gate saldría verde. Al leer un bloque,
mirar la línea de cobertura: lo que dice `NO CORRIDO` no fue medido hoy, y lo que
dice `PASS` en una fila de `navegador` solo vale si esa corrida usó `--todos`.

**Es el patrón, no el incidente.** INT-12 y el gate de evidencia son los dos
únicos hallazgos que agotaron sus tres ciclos, y los dos verifican **la
verificación misma** —uno la invalidación de caché del deploy, el otro el bloque
de evidencia—. Los dos caen por **falsificabilidad**: en INT-12 el historial se
podía forjar y borrar; acá el bloque se puede forjar **en las filas que la corrida
habitual no mide**.

No es casualidad. Un artefacto que *afirma* el resultado de una verificación se
puede reescribir, y protegerlo exige una raíz de confianza que el propio artefacto
no puede proveer. Cada vuelta de tuerca mueve la falsificación un nivel más arriba
en vez de eliminarla.

**Lo que ya está entregado y no depende de cerrar esto:**

| Verificado | Abierto |
|---|---|
| el bloque **se genera**, no se teclea | un bloque forjado en las filas no medidas pasa |
| `NO CORRIDO` no se lee como PASS | un segundo bloque agregado al archivo pasa invisible |
| un exit≠0 **no puede** rendir PASS | el sello prueba "es un commit", no "es *este* commit" |
| lo truncado se descarta, no se parsea | |
| procedencia desconocida ≠ árbol limpio | |

Respaldo: `evidencia:prueba` 23/23, y **nueve mutantes de un solo punto, cada uno
cazado** por al menos un caso.

**Recomendación (mía, explícita): aceptarlo como riesgo igual que INT-12 y
pivotear a FASE D.** El costo de oportunidad es medible: seguir endureciendo el
instrumento que vigila instrumentos, contra un propósito —H1— que **no tiene un
solo dato**. La alternativa está costeada y es chica (comparar también las filas
no corridas contra su celda esperada, que el generador ya conoce; y sacar la
comprobación de marcadores únicos de la rama `--actualizar`), pero **no la aplico
sin decisión**: la regla dice que un BoundedLoop agotado no se reabre.

**Defecto que esto ya cerró:** el bloque comiteado publicaba 19 filas contra un
catálogo de 21 —faltaba `verificar:temporizador` entero— y el gate no lo decía,
porque caía entre las filas saltadas. Al regenerar sobre `09fcf87` el bloque pasó
a publicar las 21. **Se cerró regenerando, no verificando:** el agujero que lo
permitió sigue abierto, y es el mismo riesgo aceptado de arriba.

## Base de evidencia — generada, no tecleada

<!-- EVIDENCIA:INICIO -->
<!-- Generado por `npm run evidencia`. No editar a mano: se regenera y se desfasa. -->

**Commit:** `1ada8af` · ⚠ **árbol sucio**: esta corrida no describe un estado reproducible · **corrido:** 2026-08-18 · **grupos:** estatico, base, servidor

| Comando | Resultado | Veredicto | Nota |
|---|---|---|---|
| `npm run test` | `exit=0` · 122/122 | PASS |  |
| `npm run verificar:alcance` | `exit=0` · 11/11 | PASS |  |
| `npm run verificar:alcance:prueba` | `exit=0` · 15/15 | PASS |  |
| `npm run evidencia:prueba` | `exit=0` · 23/23 | PASS |  |
| `npm run verificar:ac` | `exit=0` · 9/9 | PASS |  |
| `npm run verificar:citas` | `exit=0` · 51/51 | PASS |  |
| `npm run verificar:verificadores` | `exit=0` · 51/51 | PASS |  |
| `npm run verificar:agentes` | `exit=0` · 40/40 | PASS |  |
| `npm run verificar:metrica` | `exit=0` · 4/4 | PASS |  |
| `npm run verificar:esquema` | `exit=0` · 8/8 | PASS |  |
| `npm run verificar:invariantes` | `exit=0` · 8/8 | PASS |  |
| `npm run verificar:meas1` | `exit=0` · — | PASS |  |
| `npm run verificar:h1` | `exit=1` · — | FAIL | ⚠ **REGRESIÓN, no el entregable.** Se esperaba `banco-vacio` y falló por `control-negativo` |
| `npm run build` | **NO CORRIDO** · grupo `build` | — |  |
| `npm run verificar:salida` | `exit=0` · 11/11 | PASS |  |
| `npm run verificar:concurrencia` | `exit=0` · 7/7 | PASS |  |
| `npm run verificar:frontera` | `exit=0` · 5/5 | PASS |  |
| `npm run verificar:aislamiento` | `exit=0` · 9/9 | PASS |  |
| `npm run verificar:pwa` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:op1` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:a3` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:m4` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:meas2` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:temporizador` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:endurecimiento` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:ui` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:int12` | **NO CORRIDO** · grupo `navegador` | — | gate registrado **FAIL** (LEDGER 2026-08-13). Su PASS no es evidencia: el historial se puede forjar y borrar |

**Cobertura de esta corrida: 17 de 27 comandos.** Los 10 restantes dicen NO CORRIDO a propósito: un bloque que omite lo que no corrió se lee como si todo hubiera pasado.

**Excluidos del catálogo a propósito (1):** `npm run evidencia`. No están medidos acá y esta línea existe para que la cobertura no baje en silencio.
<!-- EVIDENCIA:FIN -->

Los grupos `build`, `servidor` y `navegador` exigen la app levantada. Para la
foto completa: `npm start` en otra consola y `npm run evidencia --todos`, o
`npm run evidencia --todos --url=https://estacionamiento-three.vercel.app`.

**Un `NO CORRIDO` no es un PASS viejo.** Es la ausencia de una medición de hoy.
El veredicto vigente de esos comandos está en `LEDGER.md`.

## La estrategia vigente (2026-08-14) — cinco fases, WIP=1

El diagnóstico que la ordena: el proyecto verifica **propiedades del artefacto**
(¿compila?, ¿existe el campo?, ¿el navegador computa 12px?) y lo hace muy bien
—33 aserciones vigilando a los propios verificadores, un gate probado con el
fallo plantado—. Lo que falta es verificar **propiedades del propósito**.

**AC-MEAS-1 da PASS con cero filas.** Verifica que no haya nulos, no que haya
datos. *Un criterio que pasa sobre el conjunto vacío no puede refutar nada.* H1 y
H2 necesitan verificadores que devuelvan **un número**, no un PASS.

| Fase | Qué | Estado |
|---|---|---|
| **B** | Reparar el registro: LEDGER, STATE, `npm run evidencia` | **cerrada**, con el gate en FAIL (arriba) |
| **C** | Anclar la verificación a la spec | **casi**: `AC-OP-4` y `AC-PDP-1` escritos; falta `AC-OP-3` |
| **D** | **H1: convertir "SIN DATOS" en un número** | **SPEC-D escrita** → `docs/SPEC-D-medicion-de-H1.md`. Es el próximo hito |
| **E** | INT-7: retención parametrizada | pendiente, y **va DESPUÉS de D** — ver abajo |
| **F** | INT-12 | resuelta: riesgo aceptado |

### FASE C — qué se ancló y qué se soltó, a propósito

Regla aplicada, fijada por un veto anterior: *¿el AC hace exigible una afirmación
que ya está en §1–§8, o introduce una nueva?* Lo primero es formalizar; lo segundo
es autorar requisitos, y eso va por ADR.

Suben tres: **AC-OP-3** (temporizador, §5), **AC-OP-4** (ciclo de salida contra la
API real + validación de frontera, §5+§7) y **AC-PDP-1** (barrera de datos reales,
§4+§7). Los dos últimos ya son fila de §9.

**No suben** `verificar:m4`, `verificar:int12`, `verificar:ui` ni
`verificar:endurecimiento`: verifican propiedades que §1–§8 **nunca enunció**.
Queda escrito para que la omisión sea decisión y no olvido.

Medido: `verificar:ac` pasó de **6 verificadores sin AC a 4**, con 13 AC.

### D antes que E — restricción encontrada midiendo, no razonando

El centinela de enmascarado de E **rompe la discriminación fixture/real** de la
que depende H1: `limpiar-fixtures.mjs:22` y `scripts/lib/fixtures.mjs:59` deciden
qué es fixture con un `LIKE 'FIXT%'` **sobre la patente**, así que una fila
enmascarada deja de reconocerse como fixture y **pasa a contar como "cerrada NO
fixture"** — el numerador exacto de H1. Si E corre antes que D, contamina la
métrica con ruido indistinguible de operación real, y el dato original ya no está.

**✅ DECIDIDO (2026-08-14): la retención excluye fixtures.** El mecanismo de INT-7
llevará `AND patente NOT LIKE 'FIXT%'`. No es el atajo barato: una patente
`FIXT01` **no es dato personal**, así que nunca estuvo en el alcance de la Ley
21.719 — y hay que escribir ese fundamento junto al `WHERE`, o el próximo lector
lo va a leer como filtro conveniente.

Con eso **§4 no se enmienda y `AC-DATA-1` no se toca**. La alternativa descartada
—columna `es_fixture` explícita— rompía `AC-DATA-1`, que desde `b933ccb` compara
los 27 campos *ni de más ni de menos*: exigía enmendar la fuente de verdad más
migración, contra el principio de minimización.

Riesgo aceptado y anotado: el discriminador sigue siendo una **convención sobre
el contenido de un campo**, sostenida por `src/lib/fixtures.ts`, que es regla de
aplicación y no del esquema. Moverlo al esquema sería enmienda de §4, por ADR.
Detalle y costeo en `docs/SPEC-D-medicion-de-H1.md` §2.

### Por qué FASE E se puede construir hoy

El VETO 1 de FASE 3 probó que **el esquema no bloquea el enmascaramiento**:
`patente` es `text NOT NULL` sin CHECK de formato, el único índice único es
parcial sobre `estado='activa'` (así que un centinela compartido en filas
cerradas no colisiona) y ninguna FK apunta a `sesion_vehiculo`. Un
`UPDATE … SET patente='XXXXXX' WHERE estado='cerrada' AND salida_at < $plazo`
cumple `spec.md:150` **sin migración**.

Tres documentos culpaban al esquema de un bloqueo que es de decisión. Construir
el mecanismo leyendo el plazo de una variable que **falla cerrado** si no está
definida hace que `{{PLAZO_RETENCION_PATENTE}}` deje de bloquear la
*construcción* y bloquee solo el *encendido*.

**La premisa se verificó empíricamente** (auditoría 2026-08-14, `UPDATE` corrido
en transacción revertida: 3 filas enmascaradas al mismo centinela, sin colisión).
Pero la misma auditoría encontró **cuatro cosas que hay que decidir antes de
escribir una línea de FASE E**:

1. **El centinela rompe la discriminación fixture/real de la que depende FASE D.**
   `limpiar-fixtures.mjs:22` y `scripts/lib/fixtures.mjs:59` borran por
   `patente LIKE 'FIXT%'`. Una fila enmascarada deja de ser reconocible como
   fixture: se vuelve imborrable **y pasa a contar como "sesión cerrada NO
   fixture"**, que es exactamente el numerador con el que hoy se afirma que H1
   está en cero. Enmascarar contaminaría la métrica de H1 con ruido
   indistinguible de operación real.
2. **Las sesiones `activa` vencidas nunca se enmascaran.** El `WHERE
   estado='cerrada'` las excluye por construcción, y **no existe mecanismo que
   las cierre**: no hay cron, no hay `vercel.json`, y `PERMANENCIA_MAXIMA_MS`
   (`src/lib/tiempo.ts:48`) solo satura el monto. Una patente en una sesión que
   quedó activa se retiene **indefinidamente** y `spec.md:150` no se cumple.
3. **Si el enmascarado se extendiera a `activa`, INT-15 lo rechaza**: dos activas
   con el mismo centinela violan `sesion_vehiculo_activa_unica`. Medido.
4. **`'XXXXXX'` no pasa `validarPatente`** (`src/lib/patente.ts:75` exige al menos
   un dígito). Sería un valor que el sistema rechaza en toda frontera de entrada
   y acepta en base. No rompe nada hoy, pero elegirlo tiene que ser a propósito.

## INT-12 — cerrado como riesgo aceptado (2026-08-14)

No se reabrió el BoundedLoop: se decidió. El fundamento, que sigue siendo el del
registro del 2026-08-13:

| | |
|---|---|
| La corrección en `src/lib/version-app.ts` | **sana** — el auditor la aprobó en los ciclos 2 y 3 |
| La propiedad en producción | **observada directamente**, sin depender del verificador |
| El gate `verificar-int12.mjs` | **no confiable** — el historial se puede forjar y borrar |

Evidencia de producción, que no depende del archivo de estado — dos deploys del
mismo commit con el árbol limpio dieron versiones distintas:

```
f77e331 -> dpl_3ZWvRFRhycVvN6wYo1sVm5pNFAKk -> sw.js?v=f77e331-o1sVm5pNFAKk
f77e331 -> dpl_BXaBdNxDgSFiivcbWzcRtmYaY2KP -> sw.js?v=f77e331-WzcRtmYaY2KP
```

**Priorización por riesgo real**, como ya se hizo en M5: un gate de invalidación
de caché pesa menos que H1, que es la razón de existir del proyecto. La salida
técnica que dejó el auditor —guardar la URL inmutable del deployment y
**re-derivar** `{artefacto, versión}` en cada corrida en vez de creerle al
archivo— queda documentada y **no implementada**. Si INT-12 vuelve a doler, ése
es el camino.

Mientras tanto: `npm run evidencia` marca ese comando con la nota de que su PASS
no es evidencia, para que nadie lo lea como verde.

## M6 — capa de presentación · SPEC-004 entregado

Tokens tomados de `_ds/…/colors_and_type.css` vía `DesignSync`. Ningún valor
inventado. Todo SPEC-004 se verifica con `npm run verificar:ui [url]` → 18/18,
local y contra producción.

Ese verificador nació de un defecto que los cuatro AC originales no veían: todo
`globals.css` estaba **sin `@layer`**, y una declaración sin capa le gana a
cualquier capa. `p { font-size: … }` derrotaba a `text-xs` en todos los `<p>`, y
`.cifra` derrotaba a `text-2xl`. **La mitad de las decisiones tipográficas de M6
no se aplicaba, con AC-UI-1/2/3/4 en verde** — tres miran el fuente y el cuarto
mira la CSP. Por eso `verificar-ui.mjs` mide el **estilo computado**.

Pantallas con el sistema aplicado: `login`, operador, panel del dueño, descuadre,
cerrar sesión, plataforma (alta + listado), **`1e` tarifas** y **`1g` reportes**.

**Queda UNA construible: `1l`** (operador · ingreso a pantalla completa), que la
traducción llama *«la mejor expresión de H1 del set»*.

## Estado de hitos

- M0–M4 — **cerrados**. v1 desplegada y verificada punta a punta.
- M5 Endurecimiento — **cerrado en código y desplegado**. INT-12 como riesgo aceptado.
- M6 Presentación — **en curso**. SPEC-004 entregado; `1e` y `1g` construidas y verificadas (2026-08-19/20). **Falta `1l`.**
- M7 Plataforma — **bloqueado** por las precondiciones de ADR-004.

## ADR-004 — decidido (2026-08-13)

**Aceptado parcialmente: alternativa 2, enmienda mínima.** Se abre el cobro de
**suscripción** (dueño → C4A). **Multisitio sigue excluido**: `1d`, `1h`, `1k`,
`1m` siguen rechazadas por el gate. El cobro del estacionamiento al conductor
sigue en efectivo, fuera del sistema — esa línea no se movió.

`AC-SCOPE-1` **ya se reescribió** (FASE A, commit `f98a652`): pasó de una regex en
una celda de tabla —inejecutable, porque `\|` en regex .NET es un pipe literal y
el criterio reportaba PASS incondicionalmente— a `npm run verificar:alcance`, que
escanea **por exclusión** y está probado con el fallo plantado. La frontera
declarada es `src/lib/suscripcion/`, hoy vacía.

## BLOQUEOS HUMANOS (no los resuelve el loop)

1. **`{{BASE_LICITUD}}`** y **`{{PLAZO_RETENCION_PATENTE}}`** — sin ellos, cero
   vehículos reales. `OPERACION_REAL_HABILITADA=false`. FASE E construye el
   mecanismo parametrizado; **encenderlo sigue siendo decisión humana**.
2. **Repositorio público.** `cherrera0001/p4rkc0ntr0l` sigue **público**. El
   decisor eligió pasarlo a privado: dos clics en `Settings → General → Danger
   Zone`. Sin `gh` ni token en el entorno, no se puede hacer desde acá.
3. **H1 nunca se midió.** AC-MEAS-1 pasa, pero cada corrida de navegador limpia
   sus fixtures. El numerador de H1 está vacío. El `6,2 s` de las maquetas
   `1g`/`1k` es un valor **inventado**. Es FASE D.
4. **`{{PRECIO_SUSCRIPCION_UF}}`** — sin él no hay nada que cobrar, y sin cobro
   H2 no se puede medir.
5. **Redondeo del monto** — neutro (`Math.round`), pendiente de confirmación.
6. **Duración de sesión: 12 h** — decisión de operación, en `src/lib/sesion-token.ts`.
7. **Permanencia máxima facturable: 30 días** — techo técnico, en `src/lib/tiempo.ts`.
8. **El monto crece con la duración del corte de señal.** El cierre calcula
   `salida_at = ahora` en el servidor, así que una sesión que no se pudo cerrar
   durante veinte minutos sin señal se factura veinte minutos más cara.
   **El conductor paga la falta de señal.** Corregirlo exige elegir cuál instante
   es el facturable, y esa elección es del decisor. Declarado en `spec.md` §5.

## Cómo entrar a la app

`operador@fixture.invalid` o `duena@fixture.invalid`, con `CLAVE_ACCESO` de
`.env` — la misma para los dos. Patente de prueba: cualquiera que empiece con
`FIXT` y tenga al menos un dígito (`FIXT01`). La semilla no crea patentes: las
sesiones las crea el operador.

## Comandos

```
npm run evidencia                     # regenera los bloques de §0 (--todos, --url=, --actualizar)
npm test                              # 122 unitarias
npm run build · npm run lint
npm run sembrar

# Alcance y contrato
npm run verificar:alcance             # AC-SCOPE-1/2/3 (por exclusión)
npm run verificar:alcance:prueba      # el gate, con el fallo plantado
npm run verificar:ac                  # todo AC de §9 cita un comando que existe

# Datos
npm run verificar:esquema             # AC-DATA-1 (compara los 27 campos)
npm run verificar:invariantes         # AC-DATA-2 · INT-15/16/17
npm run verificar:meas1               # AC-MEAS-1

# Con la app levantada
npm run verificar:salida [url]        # ciclo ingreso/salida + control de acceso
npm run verificar:op1  [url]          # AC-OP-1 (offline real por CDP)
npm run verificar:meas2 [url]         # AC-MEAS-2 e2e
npm run verificar:pwa  [url]          # AC-PWA-1
npm run verificar:a3   [url]          # A-3: la patente real no toca el dispositivo
npm run verificar:m4   [url]          # M-4: purga de copias locales
npm run verificar:endurecimiento [url]# INT-2/4/8/11/12/14/15, A-1, C-1, B-2
npm run verificar:ui   [url]          # SPEC-004 por estilo computado
npm run verificar:int12 [url]         # riesgo aceptado: su PASS no es evidencia

# Guards del proceso (no van en §9, a propósito)
npm run verificar:citas               # las citas archivo:línea resuelven
npm run verificar:verificadores       # los verificadores no mueren en silencio
npm run limpiar:fixtures
```

Requieren `DATABASE_URL`, `CLAVE_ACCESO` y `SESSION_SECRET`. Sin `[url]` corren
contra `localhost:3000`. **Todos los scripts que tocan la base ya traen
`--env-file=.env`**.

**6 de los 9** verificadores de navegador llaman `limpiarFixtures()` **al
iniciar** (`a3`, `m4`, `meas2`, `op1`, `endurecimiento` y **`temporizador`**; no
`pwa`, `ui` ni `int12`) — mecanizado el 2026-08-12, porque era una precondición
que dependía de que alguien se acordara y produjo dos FAIL falsos.
`verificar-salida.mjs:10` declara que a propósito no limpia al inicio.

> **Acá decía «5 de los 8», y quedó viejo.** Re-medido el 2026-08-16: importan
> `puppeteer-core` **nueve** y llaman `limpiarFixtures()` **seis**. El que faltaba
> en las dos cuentas es `scripts/verificar-temporizador.mjs:208`, que entró
> después de aquella medición y hace las dos cosas. **No es un dígito: es un
> borrador de banco que no figuraba en ningún inventario**, y la FASE D se iba a
> diseñar contra esa lista. Lo encontró la auditoría de FASE D, ciclo 2.

**No confundir con "la base queda en cero".** Limpian al **iniciar**: cada tanda
borra las filas de la anterior y deja las suyas puestas. Hoy la base tiene 3
sesiones cerradas (`FIXT01/02/03`). Ninguna corrida acumula, que es lo que
impide medir H1 — pero el mecanismo no es el que la matriz describía hasta hoy.

Los scripts de navegador conviene espaciarlos unos segundos: en corridas seguidas
se observa contención entre instancias de Edge. Un FAIL aislado en una tanda
secuencial se re-corre solo antes de darlo por real.

Todo comando node/npm/npx/git necesita el prefijo de PATH de `CLAUDE.md` §7
mientras no se reinicie Claude Code.
