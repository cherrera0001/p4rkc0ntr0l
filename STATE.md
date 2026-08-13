# STATE.md — cursor de reanudación

> Archivo **sobrescribible**, corto por diseño. Puntero O(1) para retomar sin
> releer `LEDGER.md` entero. El ledger es append-only y la verdad histórica:
> ante discrepancia, manda el ledger.

**Actualizado:** 2026-08-13

**URL viva: https://estacionamiento-three.vercel.app**
**Producción sirve el código endurecido Y la capa de presentación de M6.**
Medido, no supuesto: `verificar-endurecimiento` da **30/30 contra la URL viva**
(esta mañana daba 10/29).

| | |
|---|---|
| **Último hito cerrado** | M5 — Endurecimiento (código y deploy) |
| **Hito en curso** | M6 — capa de presentación |
| **Commit en producción** | `1288861` · endurecimiento + INT-12 + presentación |
| **Bloqueo activo** | **INT-12 — FAIL registrado. BoundedLoop agotado (3 vetos).** |
| **Próximo paso** | Decisión humana: rediseñar el gate de INT-12, o seguir con producto |

## INT-12 — **FAIL** (2026-08-13) · el hito se detiene

Tres ciclos, tres vetos, ninguno trivial. La regla del concilio manda registrar
FAIL y detener. **Pero conviene ser preciso sobre qué falla:**

| | |
|---|---|
| La corrección en `src/lib/version-app.ts` | **sana** — el auditor la aprobó en los ciclos 2 y 3 |
| La propiedad en producción | **observada directamente**, sin depender del verificador |
| El gate `verificar-int12.mjs` | **FAIL** — no es una red confiable |
| INT-12 como hallazgo | **NO cerrado** |

La evidencia de producción no depende del archivo de estado: dos deploys del
mismo commit con el árbol limpio dieron versiones distintas, leídas de la URL con
la que el navegador registró el worker.

```
f77e331 -> dpl_3ZWvRFRhycVvN6wYo1sVm5pNFAKk -> sw.js?v=f77e331-o1sVm5pNFAKk
f77e331 -> dpl_BXaBdNxDgSFiivcbWzcRtmYaY2KP -> sw.js?v=f77e331-WzcRtmYaY2KP
```

Lo que no se sostiene es el mecanismo que debería seguir comprobándolo solo:

1. **El historial se puede inventar.** Dos objetos JSON a mano dan 13/13 PASS,
   afirmando *"cada deploy renombra el caché"* sobre versiones que nunca
   existieron. Pasar de un booleano a dos objetos no cambió la raíz de
   confianza.
2. **La invariante "nunca se borran" ya se violó, y la violé yo**: los controles
   negativos exigen historial vacío, así que borré el archivo. Está
   gitignoreado, no deja rastro, y "borrado" es indistinguible de "primera
   corrida".
3. **El PASS no distingue un deploy de un rebuild ocioso**: sin variables de
   Vercel la versión sale del instante del build, así que dos `npm run build`
   sin cambiar nada dan PASS.

**Salida concreta que dejó el auditor** (no implementada): guardar en cada
observación la **URL inmutable del deployment** —`https://<id>.vercel.app`, que
Vercel mantiene viva— y **re-derivar** `{artefacto, versión}` de ella en cada
corrida en vez de creerle al archivo. Una entrada forjada no re-deriva; un
historial borrado se reconstruye. Más: dejar de gitignorear el archivo, y
asertar que la página y los `fetch` vinieron del mismo deployment.

**Corrección de un reporte anterior:** este archivo decía `int12 13/13` en local.
Hoy el comando devuelve **12/13, exit=1**. El 13/13 fue real cuando se midió y se
citó como estado actual después de borrar el historial. El de producción sí se
sostiene y se reprodujo.

## INT-12 — cómo llegó hasta acá

El auditor vetó el ciclo 1: `resolverVersionApp` retornaba en el primer
candidato, y el primero era el commit, así que **dos deploys del mismo SHA daban
la misma versión** → mismo caché → `activate` no purgaba → sobrevivía el shell
viejo. Lo reprodujo en un sandbox con tres builds.

El ciclo 2 **compone** en vez de elegir: la unicidad sale del identificador del
deploy (o del hash de su URL, o del instante del build) y el commit queda solo
como traza legible. **La trazabilidad no participa de la unicidad.**

Verificado contra la URL viva con el escenario exacto del veto — dos deploys
seguidos del mismo commit, árbol limpio:

```
a3a3b6b -> deploy 1: a3a3b6b-eHiyYFJWGq9B
a3a3b6b -> deploy 2: a3a3b6b-adnw9t9YTCMj
PASS · artefacto 406k2a → m4nwa1 · versión distinta   12/12 · INT-12: PASS
```

Con el código anterior los dos habrían dado `a3a3b6b12345`.

El verificador también cambió, porque era donde el ciclo 1 mentía: compara la
huella del **artefacto servido** contra una línea base persistida por origen, y
sin línea base **falla** con *"no pude comprobarlo, que no es lo mismo que esté
bien"* — antes imprimía una NOTA y salía 0. Está en `package.json` como
`verificar:int12`.

**No se declara cerrado hasta el PASA del auditor.** El implementador no cierra
su propio trabajo.

## M6 — capa de presentación · SPEC-004 entregado

Tokens tomados de `_ds/…/colors_and_type.css` del proyecto de Claude Design vía
`DesignSync`. Ningún valor inventado.

**Todo SPEC-004 se verifica con un comando: `npm run verificar:ui [url]` → 18/18,
local y contra producción.**

Ese verificador nació de un defecto que los cuatro AC originales no veían: **todo
`globals.css` estaba sin `@layer`**, y una declaración sin capa le gana a
cualquier capa. Tailwind pone sus utilidades en `@layer utilities`, así que
`p { font-size: … }` derrotaba a `text-xs` en todos los `<p>` del producto y
`.cifra` derrotaba a `text-2xl`. **La mitad de las decisiones tipográficas de M6
no se aplicaba, con AC-UI-1/2/3/4 en verde** — tres miran el fuente y el cuarto
mira la CSP.

Por eso `verificar-ui.mjs` mide el **estilo computado por el navegador**. Control
negativo real, mismo dominio, diez minutos de diferencia:

```
producción con el defecto   9/18   text-xs → 16px · .cifra.text-2xl → 44px
producción corregida       18/18   text-xs → 12px · .cifra.text-2xl → 24px
```

Pantallas con el sistema aplicado: `login`, operador, panel del dueño, descuadre,
cerrar sesión. Falta el resto de las 6 construibles: `1e` (tarifas), `1g`
(reportes), `1l` (ingreso a pantalla completa).

**El otro defecto que M6 corrigió y explicaba lo que se veía:** `globals.css` era
la plantilla por defecto de Next, con `font-family: Arial`. La app cargaba Geist
por `next/font/google` y lo descartaba en la línea siguiente.

## Estado de hitos

- M0–M4 — **cerrados**. v1 desplegada y verificada punta a punta.
- M5 Endurecimiento — **cerrado en código y desplegado**, salvo INT-12 (vetado).
- M6 Presentación — **en curso**. SPEC-004 entregado; faltan pantallas.
- M7 Plataforma — **bloqueado** por las precondiciones de ADR-004.

## ADR-004 — decidido (2026-08-13)

**Aceptado parcialmente: alternativa 2, enmienda mínima.** Se abre el cobro de
**suscripción** (dueño → C4A). **Multisitio sigue excluido**: `1d`, `1h`, `1k`,
`1m` siguen rechazadas por el gate. El cobro del estacionamiento al conductor
sigue en efectivo, fuera del sistema — esa línea no se movió.

**Hasta que `AC-SCOPE-1` se reescriba en `spec.md` §9, no entra ninguna
dependencia de pasarela.** Hoy es un `grep` de `webpay|flow` que empezaría a dar
positivo por diseño.

## BLOQUEOS HUMANOS (no los resuelve el loop)

1. **`{{BASE_LICITUD}}`** y **`{{PLAZO_RETENCION_PATENTE}}`** — sin ellos, cero
   vehículos reales. `OPERACION_REAL_HABILITADA=false`. Y decidirlos **no
   alcanza**: INT-7 no tiene mecanismo, y `patente NOT NULL` impide el
   enmascaramiento que `spec.md:150` promete. Hace falta migración + purga.
2. **Repositorio público.** `cherrera0001/p4rkc0ntr0l` tiene el código empujado
   (`main`, commit `57fe4c5`) y sigue **público** (`privado: False`, comprobado
   por API). El decisor eligió pasarlo a privado; requiere dos clics en
   `Settings → General → Danger Zone`. Sin `gh` ni token en el entorno, no se
   puede hacer desde acá. Riesgo hoy menor que ayer: los informes describen
   hallazgos ya corregidos **y desplegados**; lo que sigue abierto es INT-7.
3. **H1 nunca se midió.** AC-MEAS-1 pasa, pero cada corrida limpia sus fixtures y
   la base queda en `sesiones restantes: 0`. El numerador de H1 está vacío. El
   `6,2 s` de las maquetas `1g`/`1k` es un valor **inventado**.
4. **`{{PRECIO_SUSCRIPCION_UF}}`** — sin él no hay nada que cobrar, y sin cobro
   H2 no se puede medir.
5. **Redondeo del monto** — neutro (`Math.round`), pendiente de confirmación.
6. **Duración de sesión: 12 h** — decisión de operación, en `src/lib/sesion-token.ts`.
7. **Permanencia máxima facturable: 30 días** — techo técnico, en `src/lib/tiempo.ts`.

## Cómo entrar a la app

`operador@fixture.invalid` o `duena@fixture.invalid`, con `CLAVE_ACCESO` de
`.env` — la misma para los dos. Patente de prueba: cualquiera que empiece con
`FIXT` y tenga al menos un dígito (`FIXT01`). La semilla no crea patentes: las
sesiones las crea el operador.

## Comandos de verificación

```
npm test                              # 109 unitarias
npm run build · npm run lint
npm run sembrar
npm run verificar:a3   [url]          # A-3: la patente real no toca el dispositivo
npm run verificar:m4   [url]          # M-4: purga de copias locales
npm run verificar:op1  [url]          # AC-OP-1 (offline real por CDP)
npm run verificar:salida [url]        # ciclo ingreso/salida + control de acceso
npm run verificar:meas1               # AC-MEAS-1
npm run verificar:meas2 [url]         # AC-MEAS-2 e2e
npm run verificar:pwa  [url]          # AC-PWA-1
npm run verificar:esquema             # AC-DATA-1 (ahora con veredicto propio)
npm run verificar:invariantes         # INT-15/16/17 (solo lectura)
npm run verificar:endurecimiento [url]# INT-2/4/8/11/12/14/15, A-1, C-1, B-2
npm run verificar:int12 [url]         # INT-12: artefacto ≠ ⇒ versión ≠
npm run verificar:ui [url]            # SPEC-004 por estilo computado
npm run verificar:verificadores       # guard sobre los propios verificadores
npm run limpiar:fixtures
```

Requieren `DATABASE_URL`, `CLAVE_ACCESO` y `SESSION_SECRET`. Sin `[url]` corren
contra `localhost:3000`. **Todos los scripts que tocan la base ya traen
`--env-file=.env`**: no traerlo hacía que `npm run sembrar` no leyera una sola de
las variables que su propia documentación anuncia.

`verificar:int12` necesita **dos corridas separadas por un deploy**: la primera
registra la línea base del origen y **falla** diciendo que no pudo comprobarlo;
la segunda verifica que un artefacto distinto trajo una versión distinta.

~~Antes de correr los verificadores de navegador: `npm run limpiar:fixtures`.~~
**Mecanizado el 2026-08-12:** los cinco verificadores de navegador llaman
`limpiarFixtures()` al iniciar (`scripts/lib/fixtures.mjs`). Era una precondición
que dependía de que alguien se acordara y produjo dos FAIL falsos.

Los scripts de navegador conviene espaciarlos unos segundos: en corridas seguidas
se observa contención entre instancias de Edge. Un FAIL aislado en una tanda
secuencial se re-corre solo antes de darlo por real.

Todo comando node/npm/npx/git necesita el prefijo de PATH de `CLAUDE.md` §7
mientras no se reinicie Claude Code.
