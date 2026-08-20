# spec.md — Sistema de Gestión de Estacionamientos (v1 · piloto)

> **Documento base para Claude Code.** Es la fuente de verdad del alcance, la
> arquitectura, el modelo de datos y los criterios de aceptación de la v1.
> Todo lo que Claude Code construya se valida contra este archivo. Un requisito
> que no esté aquí, con su criterio de aceptación verificable, **no se construye**.

**Proyecto:** SaaS mínimo para operar estacionamientos privados hoy gestionados a mano.
**Autor / decisor:** Cristóbal Herrera — C4A · Cyber Security For All SpA
**Fecha:** 2026-08-08
**Estado:** base inicial (v1 piloto)
**Relacionados:** ADR-001 (alcance por exclusión, aprobado) · ADR-002 (stack, ratificar) · SPEC-001/002/003 (contenidas en este documento)

---

## 0. Cómo usar este documento (instrucciones para Claude Code)

1. **Spec-driven.** Antes de escribir código, lee este archivo completo. Cada
   capacidad tiene un criterio de aceptación con comando de verificación. No se
   da por hecho nada que no sea verificable.
2. **WIP = 1.** Se cierra y verifica un hito antes de abrir el siguiente
   (ver §10). No trabajar dos hitos en paralelo.
3. **Gate de alcance.** Está prohibido introducir pago, LPR/cámara, reservas o
   multisitio (ver §2). Cualquier PR que los agregue debe rechazarse hasta que
   exista un ADR que enmiende ADR-001.
4. **No inventar valores.** Los `{{placeholder}}` son decisiones humanas
   pendientes. No los rellenes con supuestos: si un valor falta, detente y
   pídelo. No inventes nombres, métricas ni datos de prueba realistas que
   parezcan reales.
5. **Datos personales.** La patente es dato personal bajo la Ley 21.719. Aplica
   minimización, validación de entrada en toda frontera y consultas
   parametrizadas. Nada de secretos hardcodeados.

---

## 1. Propósito e hipótesis

El sistema existe para **probar o refutar dos hipótesis**, no para lograr
paridad de producto. El riesgo central es **adopción, no escala**.

- **H1 — velocidad:** un operador registra entrada + salida más rápido que en el
  cuaderno.
- **H2 — disposición a pagar:** un dueño paga una suscripción mensual en UF por
  ver ingresos y ocupación que hoy no puede verificar.

**Definición de "validado"** (a resolver antes de cerrar el piloto):

- H1 se valida si el tiempo de registro es ≤ `{{UMBRAL_H1_SEGUNDOS}}` contra una
  línea base de cuaderno de `{{LINEA_BASE_CUADERNO_SEGUNDOS}}`.
- H2 se valida si `{{UMBRAL_H2_DUEÑOS}}` dueños pagan `{{PRECIO_SUSCRIPCION_UF}}`
  UF/mes dentro de `{{PLAZO_PILOTO}}`.

> El techo de precio de referencia es ~0,8 UF/mes (soluciones locales
> equivalentes). Competir por features antes de validar adopción es terreno
> perdido. `{{PRECIO_SUSCRIPCION_UF}}` es decisión de negocio, no de esta spec.

---

## 2. Alcance (ADR-001)

### Dentro de la v1
1. Registro de patente al ingreso.
2. Temporizador de permanencia.
3. Cálculo automático de precio a la salida.
4. Panel de visibilidad para el dueño (ocupación e ingresos observados).

### Explícitamente fuera de la v1
- Integración de pago o pasarela. **El cobro es manual, en efectivo, fuera del sistema.**
- Barreras físicas.
- Cámaras / reconocimiento de patente (LPR).
- Reserva de cupos.
- Operación multisucursal.

### Gate de alcance (obligatorio)
Un control de estructura rechaza cualquier cambio que agregue módulos de pago,
LPR, reservas o multisitio sin un ADR que enmiende o reemplace ADR-001. Se
verifica en §9 (AC-SCOPE-*).

---

## 3. Arquitectura (ADR-002 — ratificar)

Criterio rector: **lo más simple de orquestar y administrar; un proveedor, una
factura, deploy inmediato.**

| Capa | Decisión |
|------|----------|
| Frontend + API | Next.js (App Router) como **PWA**. La API son Route Handlers serverless en el mismo repo. |
| Hosting | Vercel. `git push` a `main` → deploy automático → URL en vivo. |
| Base de datos | **Postgres en Railway, vía TCP proxy público** (ADR-003, enmienda a ADR-002). Decisión original: Neon vía Marketplace de Vercel. Se cambió porque ya existía una instancia provisionada en Railway. Costo asumido: se rompe "un proveedor, una factura". |
| ORM | Drizzle (esquema tipado + migraciones). Driver: `postgres` (postgres-js) sobre TCP. |
| Auth | Mínima, dos roles: `operador` y `dueño`. Sin proveedor de pago. |
| Offline | **Offline-first (no opcional):** service worker + IndexedDB local + sincronización al reconectar. Cubre el **ingreso**, que es lo que mide H1; la **salida requiere conexión** (§5). |

**Por qué offline-first:** el operador registra de pie, con conectividad
intermitente. Si la app se cae sin señal, muere la adopción (H1). El registro
debe funcionar sin red y sincronizar después.

**Sin Stripe / sin pasarela:** excluido por ADR-001. La suscripción no se cobra
dentro de la app durante el piloto.

---

## 4. Modelo de datos — SPEC-001 (minimización)

Principio: se recolecta **solo lo que responde H1/H2**. Sin entidades de pago,
sucursal ni reserva.

### Entidades

**Estacionamiento**
- `id` (uuid, PK)
- `nombre` (texto)
- `capacidad_total` (entero)
- `zona_horaria` (texto, ej. `America/Santiago`)
- `created_at` (timestamp)

**Tarifa**
- `id` (uuid, PK)
- `estacionamiento_id` (FK → Estacionamiento)
- `valor_hora` (entero, en pesos)
- `fraccion_minutos` (entero, unidad mínima de cobro)
- `monto_minimo` (entero)
- `vigente_desde` (timestamp)

**SesionVehiculo** — el corazón de la v1
- `id` (uuid, PK)
- `estacionamiento_id` (FK)
- `operador_id` (FK → Usuario)
- `patente` (texto, normalizada; **dato personal**)
- `entrada_at` (timestamp)
- `salida_at` (timestamp, nullable)
- `monto_calculado` (entero, nullable — se calcula a la salida)
- `tecleo_inicio_at` (timestamp — inicio del ingreso de patente, para H1)
- `tecleo_fin_at` (timestamp — fin del ingreso de patente, para H1)
- `estado` (`activa` | `cerrada`)
- `sync_estado` (`local` | `sincronizada` — para offline-first)

**Usuario**
- `id` (uuid, PK)
- `email` (texto, único)
- `rol` (`operador` | `dueño` | `plataforma`)
- `estacionamiento_id` (FK, **nulo si y solo si el rol es `plataforma`**)
- `created_at` (timestamp)

> **`plataforma` es el rol de C4A** (ADR-005 alternativa 2, aceptado el
> 2026-08-17): da de alta clientes. Hasta esa fecha esa operación —la de mayor
> privilegio del sistema— se hacía con `DATABASE_URL` en la mano y un script.
> **No accede a `patente` por ninguna ruta** (AC-ISO-2).
>
> La nulabilidad de `estacionamiento_id` **no es «nullable a secas»**: la base
> hace cumplir `pertenencia_por_rol`, o sea nulo exactamente cuando el rol es
> `plataforma`. Sin esa invariante, un `operador` sin estacionamiento filtraría
> contra `null` y las seis cláusulas de aislamiento del producto dejarían de
> aislar. Verificado por comportamiento contra la base, no por el DDL.

> **Prohibido en el esquema:** entidades `Pago`, `Transaccion`, `Sucursal`,
> `Reserva`. Verificado en AC-DATA-1.

### Retención y base de licitud (a resolver)
- **Plazo de retención de `patente`:** `{{PLAZO_RETENCION_PATENTE}}`. Vencido el
  plazo, la patente se elimina o se enmascara; el registro agregado (ocupación,
  monto) puede conservarse sin la patente.
- **Base de licitud del tratamiento de la patente:** `{{BASE_LICITUD}}`
  (candidatas a evaluar: ejecución del servicio de estacionamiento / interés
  legítimo del responsable). No asumir consentimiento por defecto.
- La minimización es un requisito estructural, no una recomendación.

---

## 5. Flujo operativo — SPEC-002

Un solo operador, un solo estacionamiento, en una pantalla.

### Ingreso
1. El operador abre la app (ya autenticado, sesión persistente).
2. Toca "Nuevo ingreso": se marca `tecleo_inicio_at`.
3. Ingresa la patente (teclado optimizado, normalización automática).
4. Al confirmar: se marca `tecleo_fin_at`, se crea `SesionVehiculo` con
   `entrada_at = ahora`, `estado = activa`, `sync_estado = local`.

**AC-OP-1 (ingreso offline).** Con el navegador en modo sin conexión, un ingreso
se registra y persiste en IndexedDB; al reconectar, `sync_estado` pasa a
`sincronizada`. *Verificación: `npm run verificar:op1`* (§9).

### Permanencia
- El temporizador muestra el tiempo transcurrido por cada sesión activa.

### Salida y cálculo
1. El operador selecciona una sesión activa y toca "Salida".
2. `salida_at = ahora`; `monto_calculado` se computa desde `Tarifa`
   (valor_hora, fraccion_minutos, monto_minimo); `estado = cerrada`.
3. La app muestra el monto para que el operador **cobre en efectivo** (fuera del sistema).

> **La salida requiere conexión; el ingreso no.** El `monto_calculado` se computa
> en el servidor con la tarifa vigente, porque un cliente que estuvo sin red
> puede tener una tarifa vieja — y mostrar un monto equivocado al cobrar en
> efectivo es peor que pedir señal un momento.
>
> Sin conexión el vehículo **queda `activa` y la salida no se registra**. No hay
> reintento automático: el operador vuelve a tocar *Salida* al reconectar.
>
> **Y ahí el monto SÍ cambia: crece con la duración del corte.** El cierre calcula
> `salida_at = ahora` en el servidor, así que una sesión que no se pudo cerrar
> durante veinte minutos sin señal se factura veinte minutos más cara. La
> idempotencia del cierre cubre otro caso —volver a tocar *Salida* sobre una
> sesión **ya cerrada**, cuando la respuesta se perdió— y no éste.
>
> **Consecuencia de negocio, declarada y sin resolver: el conductor paga la
> falta de señal.** Es una decisión pendiente, no un defecto de implementación:
> corregirlo exige elegir qué instante es el facturable —cuándo el operador tocó
> *Salida*, o cuándo el servidor lo registró— y esa elección es del decisor. Ver
> la lista de decisiones abiertas.
>
> Esta asimetría existe desde M2 y vivía solo en `LEDGER.md`. Se escribe acá
> porque una restricción de producto que no está en la spec es una restricción
> que el próximo lector no encuentra.

**AC-OP-2 (cálculo correcto).** Dada una tarifa y una duración conocidas, el
`monto_calculado` coincide con el valor esperado, incluido el `monto_minimo` y
el redondeo por `fraccion_minutos`. *Verificación: `npm test`* (§9).

---

## 6. Instrumentación de medición — SPEC-003

La medición **es parte del producto**, no un extra. Sin ella el piloto entrega
la app pero no la evidencia sobre H1/H2.

### H1 — velocidad de registro
- Cada `SesionVehiculo` cerrada debe tener `tecleo_inicio_at` y `tecleo_fin_at`.
- La duración del tecleo = `tecleo_fin_at − tecleo_inicio_at` es la métrica de H1.

> **Qué cubre esta métrica y qué no (2026-08-16).** §1 enuncia H1 sobre **entrada
> + salida**. Esta métrica mide **solo el ingreso**: `tecleo_inicio_at` se marca al
> tocar *Nuevo ingreso* (`src/app/pantalla-operador.tsx:280`) y `tecleo_fin_at` al
> confirmar (`src/app/pantalla-operador.tsx:328`).
>
> **El ciclo de salida no está instrumentado.** `registrarSalida()`
> (`src/app/pantalla-operador.tsx:346`) no marca ningún instante: el único
> timestamp de la salida es `salida_at`, que el servidor calcula al cerrar
> (`src/app/api/sesiones/[id]/salida/route.ts:83`) y que mide **cuándo ocurrió**,
> no **cuánto tardó el operador**.
>
> Las dos secciones convivieron así desde M2 sin que nada lo detectara. Se escribe
> acá para que quien lea un número de `verificar:h1` sepa qué mitad de H1 tiene
> delante.
>
> **Por qué no se instrumenta la salida ahora.** Agregar timestamps exige campos
> nuevos, y `AC-DATA-1` compara los **27 exactos** de §4: sería enmendar la fuente
> de verdad más una migración, contra el principio de minimización. **Y no hace
> falta para el piloto:** en la app la salida es un toque sin tecleo, así que el
> tiempo del operador se toma **fuera de banda**, con el mismo cronómetro que
> `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` necesita de todos modos. El método está en
> `docs/PROTOCOLO-medicion-H1.md`.
>
> **Qué dispararía el ADR.** Si el piloto muestra que la salida pesa en H1 **y**
> que la medición fuera de banda es demasiado ruidosa para decidir, entonces sí:
> instrumentarla es enmienda de §4 y va por ADR. Hoy no hay dato que lo sostenga,
> y proponerlo sin ese dato sería construir sobre una hipótesis.

**AC-H1-2 (la métrica del código es la de esta sección).** La expresión que
`verificar:h1` usa para calcular la duración es exactamente la que este párrafo
declara. *Verificación: `npm run verificar:metrica`* (§9).

> **El criterio está escrito; su verificación no se sostiene, y eso se dice acá.**
> Tres ciclos de auditoría terminaron en VETO y el hito quedó detenido (LEDGER
> 2026-08-17). El último bypass publicó **10 s sobre un tecleo real de 40 s con el
> criterio en verde**: un señuelo aliasado `AS mediana_referencia` secuestra el
> ancla y la columna real aplica un tope. Mientras el guard sea un regex sobre el
> texto del fuente más una sonda de un solo punto, deja afuera más superficie de
> la que cubre. **Un PASS de `verificar:metrica` no autoriza a leer §6 como
> garantizada.**

> **Por qué hace falta un criterio para esto.** Hoy el código y §6 coinciden **por
> casualidad, no por mecanismo**: nada comprobaba que siguieran diciendo lo mismo.
> Cambiar el SQL a `salida_at − entrada_at` habría convertido a §6 en mentira sin
> que ningún comando lo notara — la fuente de verdad describiendo algo que el
> sistema dejó de hacer.

**AC-MEAS-1.** Toda sesión cerrada tiene ambos timestamps de tecleo no nulos.
*Verificación: `npm run verificar:meas1`* (§9).

**AC-H1-1 (la métrica, no su ausencia).** El sistema publica la **mediana** del
tiempo de tecleo con su **tamaño de muestra**, separando las tres poblaciones:
operación real, banco de prueba, y lo que dejan los verificadores. *Verificación:
`npm run verificar:h1`* (§9).

> **Por qué AC-MEAS-1 no alcanzaba, y por qué este criterio es de otra especie.**
> AC-MEAS-1 **no puede fallar por ausencia de datos**: sus dos guardas son un
> `count(*)` sobre un `WHERE` —vacuamente verdadero sobre el conjunto vacío— y una
> lectura de `information_schema`, que no depende de las filas. *Un criterio
> universal —«todo X cumple P»— es automáticamente verdadero si no hay ningún X.*
>
> Cuando lo que importa es que **existan** X, el criterio tiene que ser
> **existencial**, y su salida no es un PASS: es un número. AC-H1-1 **falla con la
> base vacía**, y eso es lo que hace visible que H1 —la hipótesis por la que este
> proyecto existe (§1)— nunca se midió.
>
> **Medir no requiere umbral; comparar sí.** Por eso este criterio entrega el
> número y **no** el veredicto sobre H1: `{{UMBRAL_H1_SEGUNDOS}}`,
> `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` y `{{N_MINIMO_H1}}` siguen sin resolver (§12).

### H2 — visibilidad que el dueño valora
El panel del dueño (§ siguiente) se alimenta de datos ya registrados; no requiere
tabla adicional. Se derivan de `SesionVehiculo`:
- Ocupación actual = sesiones `activa`.
- Ingresos observados del período = suma de `monto_calculado` de sesiones cerradas.
- **Descuadre visible:** diferencia entre ocupación observada y sesiones
  registradas (hace visible, sin impedirlo, que un vehículo se cobre por fuera).

### Panel del dueño
- Ocupación en tiempo (aprox.) real.
- Ingresos observados por día.
- Indicador de descuadre.

**AC-MEAS-2.** El panel refleja exactamente las sesiones registradas por el
operador en el hito anterior. *Verificación: `npm run verificar:meas2`* (§9).

---

## 7. Protección de datos (Ley 21.719)

- La **patente es dato personal**. Aplica minimización (§4), retención acotada y
  base de licitud definida antes de operar con datos reales.
- Vigencia plena de la ley: **1 de diciembre de 2026**. El piloto debe nacer
  alineado, no remediado después.
- Superficie mínima por diseño: al no haber pago ni LPR, se recolecta menos.
- Validación de entrada en toda frontera (la patente ingresada), consultas
  parametrizadas (Drizzle), sin secretos en el repositorio.

---

## 8. Requisitos no funcionales

- **PWA instalable:** manifiesto válido + service worker; instalable en móvil.
- **Offline-first:** el **ingreso** del operador (§5) funciona sin conexión. La
  **salida** requiere red y no se reintenta sola — ver la nota de §5.
- **N clientes, un recinto cada uno** (ADR-005 alt. 2, aceptado 2026-08-17).
  Sin jerarquia sobre `estacionamiento`: **multisitio** —un cliente con varios
  recintos— sigue fuera, y lo hace cumplir AC-SCOPE-4 por exclusion.
- **Simplicidad de operación:** deploy por `git push`; sin infraestructura que
  administrar más allá de Vercel + la base gestionada.

> **Corrección de proveedor (2026-08-13).** Esta sección y §10 decían "Neon".
> ADR-003 movió la base a **Postgres en Railway** el 2026-08-09 y estas dos
> menciones quedaron sin actualizar. §3 ya lo reflejaba.
>
> **~~Deuda declarada~~ — SALDADA y medida (2026-08-20).** Esta sección decía que
> el deploy corría por **CLI de Vercel** y que el repositorio remoto *«existe pero
> no está conectado al proyecto de Vercel»*. **Es falso hoy**, y se comprobó
> intentando conectarlo:
>
> ```
> $ vercel git connect --yes
> > cherrera0001/p4rkc0ntr0l is already connected to your project.
> ```
>
> El `git push` de las 7 unidades de hoy disparó un despliegue **Ready ·
> Production · 23 s**, y las rutas nuevas responden en la URL viva
> (`/dueno/tarifas` 307 · `/dueno/reportes` 307 · `/api/tarifas` 405). El
> criterio *«deploy por `git push`»* **está cumplido**.
>
> Se deja escrito cómo se descubrió, porque es el modo de falla que este
> documento persigue: **una deuda declarada que nadie volvió a medir se lee como
> vigente para siempre.** No hay comando que vigile esta afirmación; si el
> proyecto se desconectara, `spec.md` volvería a mentir sin que nada lo note.

---

## 9. Criterios de aceptación globales (con verificación)

| ID | Criterio | Verificación | Tipo |
|----|----------|--------------|------|
| AC-SCOPE-1 | **El conductor no paga dentro del sistema.** El cobro del estacionamiento sigue siendo en efectivo, fuera de la app. Ninguna pasarela vive fuera de la frontera declarada de suscripción, y el flujo del estacionamiento no la importa. | `npm run verificar:alcance` → todas las comprobaciones PASS | universal |
| AC-SCOPE-2 | El esquema no define `Pago`/`Transaccion`/`Sucursal`/`Reserva`. | `npm run verificar:alcance` → todas las comprobaciones PASS | universal |
| AC-SCOPE-3 | No existe módulo de integración LPR/cámara. | `npm run verificar:alcance` → todas las comprobaciones PASS | universal |
| AC-SCOPE-4 | **Multisitio sigue fuera, y ahora lo hace cumplir un comando.** El modelo no tiene ninguna entidad por encima de `estacionamiento` que agrupe varios recintos bajo un mismo dueño: ni `tenant`, ni `empresa`, ni `organizacion`, ni sus llaves foráneas. **No prohíbe tener varios clientes** —eso es multicliente y ADR-005 lo habilita—: prohíbe la jerarquía. Cierra el hueco que ADR-005 §2.5 reprodujo, donde el gate daba 9/9 PASS con `tenant` plantado. | `npm run verificar:alcance` → todas las comprobaciones PASS | universal |
| AC-DATA-1 | El modelo de datos coincide con §4 (entidades y campos). | `npm run verificar:esquema` → todas las comprobaciones PASS | universal |
| AC-DATA-2 | Las invariantes del modelo §4 se hacen cumplir **en la base**, declaradas en la migración y no solo en la aplicación: un vehículo no está dos veces adentro del mismo estacionamiento; `salida_at ≥ entrada_at`; `tecleo_fin_at ≥ tecleo_inicio_at`; `monto_calculado ≥ 0`; `capacidad_total > 0`; `valor_hora ≥ 0`; `fraccion_minutos > 0`; `monto_minimo ≥ 0`. | `npm run verificar:invariantes` → todas las comprobaciones PASS | universal |
| AC-OP-1 | Ingreso offline persiste y sincroniza. | `npm run verificar:op1` → todas las comprobaciones PASS | existencial |
| AC-OP-2 | Cálculo de precio correcto (mínimo + fracción). | `npm test` → 0 fallos | universal |
| AC-OP-4 | El ciclo de §5 se cumple **contra la API real**, no solo en la fórmula aislada: el ingreso crea la sesión, la salida la cierra, y el `monto_calculado` se computa con la **tarifa vigente de la base** y se persiste. Y la frontera valida: una patente inválida se rechaza y una inyección no altera el esquema (§7). | `npm run verificar:salida` → todas las comprobaciones PASS | existencial |
| AC-OP-5 | **Una sesión se cierra una sola vez.** N pedidos de salida simultáneos sobre la misma sesión activa producen **un solo cierre**: un único `salida_at` y un único `monto_calculado`, idénticos en todas las respuestas y sin cambiar en la base después de la ráfaga. Formaliza la idempotencia del cierre que §5 ya afirma. **Se enuncia sobre lo que se observa desde afuera, no sobre cómo se implemente**: sirve igual con un `WHERE` condicional, con una transacción o con un lock. | `npm run verificar:concurrencia` → todas las comprobaciones PASS | existencial |
| AC-API-1 | **Ninguna entrada malformada de la frontera de la API produce un 5xx.** Cualquier valor degenerado, en cualquier campo que la API lea del cuerpo o de la ruta, se responde con un rechazo de cliente; nunca con 5xx. No es cosmética: un 5xx es *recuperable* para la cola local del operador y además **corta el lote**, así que un dato que la base nunca va a aceptar bloquearía la cola entera del turno — y con ella la evidencia de H1. Formaliza §7, *«validación de entrada en toda frontera»*. | `npm run verificar:frontera` → todas las comprobaciones PASS | universal |
| AC-ISO-1 | **Ningun dato de un cliente es legible ni alcanzable desde otro.** Con **dos** estacionamientos sembrados, un usuario de A no obtiene ningun recurso de B por ningun camino: ni en el listado, ni cerrando una salida sabiendo el id. La patente es dato personal (§7): un cruce no es un defecto de interfaz, es una comunicacion de datos a un tercero. **Y exige ver lo propio**, o «no ve lo de B» seria cierto por vacio. | `npm run verificar:aislamiento` -> todas las comprobaciones PASS | existencial |
| AC-ISO-2 | **El rol `plataforma` no obtiene ninguna patente por ninguna ruta.** Es el rol con mas privilegio del sistema —da de alta clientes— y por eso el que mas hay que acotar. Minimizacion, §4 y §7. | `npm run verificar:aislamiento` -> todas las comprobaciones PASS | universal |
| AC-ADM-1 | **El alta deja al cliente operativo, o no deja nada.** Un alta exitosa produce estacionamiento con `capacidad_total > 0` y zona horaria valida, **una** tarifa vigente, un `dueno` y un `operador`. Las cuatro filas se escriben en una transaccion: un alta a medias dejaria un estacionamiento que no puede cobrar una salida. | `npm run verificar:aislamiento` -> todas las comprobaciones PASS | existencial |
| AC-PDP-1 | **No se opera con datos reales antes de resolver la base de licitud.** Con `OPERACION_REAL_HABILITADA=false`, una patente que no es fixture no se guarda en el dispositivo, no entra a la cola de sincronización, no se reintenta y no llega a la base. | `npm run verificar:a3` → todas las comprobaciones PASS | existencial |
| AC-MEAS-1 | Sesiones cerradas con timestamps de tecleo completos. | `npm run verificar:meas1` → todas las comprobaciones PASS | universal |
| AC-H1-1 | **La métrica de H1 existe y tiene muestra.** `npm run verificar:h1` publica la **mediana del tiempo de tecleo** y el **tamaño de muestra**, separando banco de prueba de operación real y marcando como no-evidencia lo que dejan los verificadores. **Falla si no hay datos**: *«no pude medirlo» no es «está bien»*. No concluye sobre H1: medir no requiere umbral, comparar sí. | `npm run verificar:h1` → publica el tamaño de muestra y la mediana por población; exit≠0 si no hay ninguna sesión de banco ni real | existencial |
| AC-H1-2 | **La métrica del código es la que §6 declara.** Toda expresión con que `verificar:h1` calcula la duración del tecleo coincide con la que `spec.md` §6 define. Sin esto, cambiar el SQL convierte a §6 en mentira sin que ningún comando lo note. | **NO VERIFICADO** (LEDGER 2026-08-17). `npm run verificar:metrica` en verde **no** prueba «toda expresión»: cubre la mediana por su forma exacta más un punto de la consulta real. El mínimo, el máximo, el estadístico y toda transformación monótona quedan fuera — los tres huecos están reproducidos en el ledger | universal |
| AC-MEAS-2 | El panel del dueño refleja las sesiones registradas. | `npm run verificar:meas2` → todas las comprobaciones PASS | existencial |
| AC-PWA-1 | PWA instalable: manifiesto con los campos de instalabilidad (name/short_name, start_url, display, iconos 192 y 512 que existen) **y** service worker registrado, activado y controlando la página. | `npm run verificar:pwa` → todas las comprobaciones PASS | universal |
| AC-BUILD-1 | El proyecto compila. | `npm run build` sin errores | universal |

> **La columna «Tipo»: universal o existencial (2026-08-16).**
>
> - **universal** — la forma es *«todo X cumple P»*. **Pasa sobre el conjunto
>   vacío**: si no hay ningún X, es automáticamente verdadero.
> - **existencial** — exige que **exista** al menos un X. No puede pasar sobre la
>   nada; su salida útil es un número, no un veredicto.
>
> **Por qué la columna existe.** `AC-MEAS-1` estuvo meses en verde sin un solo
> dato de operación: sus dos guardas son un `count(*)` sobre un `WHERE` —vacuamente
> verdadero sobre cero filas— y una lectura de `information_schema`, que no depende
> de las filas. El criterio hacía exactamente lo que decía; **lo que faltaba era la
> obligación de preguntárselo.** Nadie lo notó hasta que FASE D fue a buscar el
> número de H1 y no había ninguno.
>
> `npm run verificar:ac` exige que **cada AC declare su tipo**, y que **al menos
> uno sea existencial**: si todos fueran universales, §9 entero pasaría sobre un
> sistema sin datos, que es exactamente el estado del que este proyecto salió.
>
> **Es una declaración de quien escribe el AC, no una medición.** El guard
> comprueba que esté, no la re-deriva. Decirlo importa: afirmar que está medida
> sería el defecto que estas notas persiguen.
>
> Nueve universales y cinco existenciales hoy. **Que un AC sea universal no lo
> vuelve malo** —«el proyecto compila» no puede ser otra cosa—; lo que era malo era
> no saber cuáles podían aprobar la nada.

> **Verificadores soltados a propósito.** El espejo de esta tabla: un verificador
> que ningún AC cita es un huérfano, y desde el 2026-08-16 **un huérfano no
> declarado hace fallar `verificar:ac`**. Nadie está obligado a subir un
> verificador a §9 —eso sería especificar retroactivamente, que es autorar
> requisitos— pero **todos están obligados a declararlo**, con su motivo, en
> `scripts/verificar-ac.mjs`. Antes se reportaban como `INFO · decisión pendiente`,
> y el contador creció de 5 a 6 sin que nada fallara.

> **Cada criterio cita el COMANDO, no un número.** Los conteos derivan y crecen
> con cada comprobación que se agrega; un AC que dijera "13/13" quedaría falso al
> día siguiente. `npm run verificar:ac` comprueba que ningún criterio apunte a un
> script inexistente o a una herramienta ausente.

> **Enmienda de AC-PWA-1 (2026-08-09).** La redacción original verificaba con
> *"auditoría PWA (Lighthouse)"*. Lighthouse **eliminó la categoría PWA**: la
> versión 13.4.1 solo define `performance` en su configuración por defecto. El
> criterio era inverificable con cualquier Lighthouse actual, en cualquier
> máquina. Se reescribió para describir **la propiedad a comprobar** en lugar de
> la herramienta, y se implementó un verificador propio sobre CDP. Evidencia del
> diagnóstico y de los tres intentos fallidos: `LEDGER.md`, entrada
> *M1 · AC-PWA-1 · FAIL tras 3 intentos*.
>
> Lección general: un criterio de aceptación que se ata al nombre de una
> herramienta externa caduca cuando la herramienta cambia. Describir la
> propiedad; sugerir la herramienta.

> **Enmienda de AC-SCOPE-1 (2026-08-13).** ADR-004 se aceptó en su alternativa 2:
> se habilita el cobro de **suscripción** (dueño → C4A) y **multisitio sigue
> excluido**. El criterio anterior era un `grep` de marcas de pasarela sobre
> `package.json`, y no distinguía los dos cobros: en cuanto entrara una pasarela
> de suscripción empezaría a dar positivo **por diseño**.
>
> Se reescribió describiendo **la propiedad**: *el conductor no paga dentro del
> sistema*. La verificación pasó de una expresión regular en esta tabla a
> `npm run verificar:alcance`, que escanea **por exclusión** —toda la superficie
> del producto, exceptuando la frontera declarada `src/lib/suscripcion/`— en vez
> de enumerar archivos.
>
> Dos razones, las dos medidas y no supuestas:
>
> 1. **La regex en una celda de tabla era inejecutable.** El pipe va escapado
>    (`\|`) para no romper la tabla, y copiado tal cual a PowerShell `\|` es un
>    pipe **literal**: el patrón nunca matchea. Comprobado:
>    `Select-String "next\|react"` → 0 líneas; `"next|react"` → 9. Un criterio
>    que reporta PASS incondicionalmente es peor que no tener criterio.
> 2. **Enumerar archivos deja agujeros por construcción.** Una ruta nueva
>    —`src/app/api/cobro/route.ts`— evade cualquier lista blanca.
>
> El gate se prueba **con el fallo plantado** (`npm run verificar:alcance:prueba`):
> ruta nueva que le cobra al conductor, dependencia sin frontera, pasarela dentro
> de su frontera (que debe **pasar**), importación cruzada, entidad prohibida,
> captura de imagen, y falsos positivos que no deben disparar. Esa prueba
> encontró un defecto real del gate antes de escribirlo acá, y después encontró
> tres bypasses más que la primera versión del gate tenía.
>
> *(Esta enmienda decía `8/8`. Hoy son 15/15. **El número quedó desfasado dentro
> del párrafo que argumenta que un criterio debe citar el comando y no el
> número** — corregido el 2026-08-14 quitándolo, que es lo que el propio
> argumento exige.)*
>
> **Un gate que solo se probó contra un repo limpio no se probó.**

> **Anclaje de verificadores huérfanos (FASE C, 2026-08-14).** El repo tenía
> verificadores que comprueban propiedades reales y **ningún criterio escrito que
> los exija**: un refactor podía borrarlos sin violar nada. La regla que decide
> cuáles suben a §9 la fijó un veto anterior y es la del proyecto:
>
> > **¿el AC hace exigible una afirmación que ya está en §1–§8, o introduce una
> > afirmación nueva?** Lo primero es formalizar. Lo segundo es autorar
> > requisitos, y eso no lo hace un loop: lo decide el humano, por ADR.
>
> Suben **tres**, porque los tres hacen exigible texto que ya estaba escrito:
>
> - **AC-OP-3** ← §5, *"El temporizador muestra el tiempo transcurrido por cada
>   sesión activa"*. Era **la única capacidad del núcleo sin una sola aserción en
>   todo el repo**: `duracion()` no se exporta, ningún test la importa, y
>   `verificar-m4.mjs` dice explícitamente que no prueba el temporizador.
> - **AC-OP-4** ← §5, el ciclo de salida y el cálculo con la tarifa vigente, más
>   la validación de frontera de §7.
> - **AC-PDP-1** ← §4 y §7, *"base de licitud definida antes de operar con datos
>   reales"*. La barrera existía y se verificaba; lo que faltaba era el criterio
>   que la vuelve obligatoria.
>
> **No suben**, y queda dicho para que la omisión sea una decisión visible y no un
> olvido: el endurecimiento completo, la purga del dispositivo (M-4), la capa de
> presentación, la cota del reloj del cliente e INT-12. Los cinco verifican
> propiedades que `spec.md` §1–§8 **nunca enunció**: nacen de la revisión de
> seguridad y de la traducción de diseño, ambas posteriores a este documento.
> Escribirlas acá sería inventar requisitos con forma de formalización. Si se
> quieren exigibles, va por ADR.
>
> Tampoco suben los guards de proceso (`verificar:citas`,
> `verificar:verificadores`, `verificar:ac`, `evidencia:prueba`,
> `verificar:alcance:prueba`): meter un guard de documentación en §9 convertiría
> documentos derivados en criterio permanente de la v1 — el subproducto
> ascendiendo al contrato que audita. Ya está declarado en `verificar-ac.mjs`.

> **Enmienda de la columna de verificación (2026-08-13).** Seis de los diez
> criterios citaban prosa —*"prueba unitaria"*, *"revisión del esquema Drizzle"*,
> *"prueba end-to-end"*, *"inspección de estructura del repo"*— mientras existían
> verificadores ejecutables que ya los cubrían y que `LEDGER.md` ya citaba como
> su evidencia. Se reapuntaron al comando que los verifica. **No se agregó ningún
> requisito**: cada criterio dice lo mismo que decía, y ahora se puede correr.

---

## 10. Secuencia de construcción (hitos, WIP = 1)

Cada hito cierra con sus criterios de aceptación verificados antes de abrir el siguiente.

- **M0 — Bootstrap.** Repo Next.js + `CLAUDE.md` con el gate de alcance +
  `.gitignore`. Sin código de app. → cierra con estructura lista.
- **M1 — Esquema + scaffold.** PWA (manifiesto + service worker), Postgres + Drizzle,
  esquema de §4. → cierra con AC-DATA-1, AC-SCOPE-1/2, AC-BUILD-1, AC-PWA-1.
- **M2 — Rebanada del operador (offline).** Flujo completo de §5 con
  instrumentación de tecleo (§6). → cierra con AC-OP-1, AC-OP-2, AC-MEAS-1.
- **M3 — Panel del dueño.** Visibilidad y descuadre (§6). → cierra con AC-MEAS-2.
- **M4 — Deploy.** Conexión a Vercel + Postgres en Railway (ADR-003) +
  variables de entorno. → cierra con URL en vivo y un registro de prueba
  end-to-end.

---

## 11. Restricciones para Claude Code (qué NO hacer)

- **No** agregar pago, pasarela, LPR/cámara, reservas ni multisitio (gate ADR-001).
- **No** hardcodear valores de negocio: `{{PRECIO_SUSCRIPCION_UF}}`, umbrales de
  H1/H2, plazos → son `{{placeholder}}` hasta que se resuelvan.
- **No** inventar nombres, métricas ni datos que parezcan reales.
- **No** tratar offline-first como opcional.
- **No** guardar secretos en el repositorio; usar variables de entorno.
- **No** avanzar dos hitos a la vez (WIP = 1).

---

## 12. Cuestiones abiertas (placeholders a resolver con el humano)

| Placeholder | Qué es | Bloquea |
|-------------|--------|---------|
| `{{PRECIO_SUSCRIPCION_UF}}` | Ancla de precio de la suscripción (techo ref. ~0,8 UF/mes) | Validación de H2 |
| `{{UMBRAL_H1_SEGUNDOS}}` / `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` | Objetivo y línea base de tiempo de registro | Definición de "validado" H1 |
| `{{N_MINIMO_H1}}` | Tamaño de muestra a partir del cual una mediana de tecleo significa algo | Leer el número de AC-H1-1 como evidencia, no la medición en sí |
| `{{UMBRAL_H2_DUEÑOS}}` / `{{PLAZO_PILOTO}}` | Nº de dueños pagando y plazo | Definición de "validado" H2 |
| `{{PLAZO_RETENCION_PATENTE}}` | Ventana de retención de la patente | SPEC-001 / cumplimiento |
| `{{BASE_LICITUD}}` | Base de licitud del tratamiento de la patente | SPEC-001 / cumplimiento |
| `{{EQUIPO_REVISOR}}` | Revisor(es) del proyecto | Gobernanza |

---

*Este documento es la base inicial. Cualquier cambio de alcance se hace por ADR
que enmiende ADR-001, no editando este archivo en silencio.*
