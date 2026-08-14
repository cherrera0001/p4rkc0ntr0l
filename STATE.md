# STATE.md — cursor de reanudación

> Archivo **sobrescribible**, corto por diseño. Puntero O(1) para retomar sin
> releer `LEDGER.md` entero. El ledger es append-only y la verdad histórica:
> ante discrepancia, manda el ledger.

**Actualizado:** 2026-08-14

**URL viva: https://estacionamiento-three.vercel.app** — responde 200.

| | |
|---|---|
| **Último hito cerrado** | M5 — Endurecimiento (código y deploy) |
| **Hito en curso** | M6 — capa de presentación · **FASE B de la estrategia nueva** |
| **Bloqueo activo** | ninguno técnico. Quedan los **bloqueos humanos** de más abajo |
| **INT-12** | **riesgo aceptado por decisión humana (2026-08-14)**. Ya no detiene el hito |
| **Próximo paso** | FASE C — anclar la verificación a la spec (9 huérfanos, 6 verificadores sin AC) |

## Base de evidencia — generada, no tecleada

<!-- EVIDENCIA:INICIO -->
<!-- Generado por `npm run evidencia`. No editar a mano: se regenera y se desfasa. -->

**Commit:** `b933ccb` · ⚠ **árbol sucio**: esta corrida no describe un estado reproducible · **corrido:** 2026-08-14 · **grupos:** estatico, base

| Comando | Resultado | Veredicto | Nota |
|---|---|---|---|
| `npm run test` | `exit=0` · 122/122 | PASS |  |
| `npm run verificar:alcance` | `exit=0` · 9/9 | PASS |  |
| `npm run verificar:alcance:prueba` | `exit=0` · 15/15 | PASS |  |
| `npm run verificar:ac` | `exit=0` · 5/5 | PASS |  |
| `npm run verificar:citas` | `exit=0` · 17/17 | PASS |  |
| `npm run verificar:verificadores` | `exit=0` · 33/33 | PASS |  |
| `npm run verificar:esquema` | `exit=0` · 8/8 | PASS |  |
| `npm run verificar:invariantes` | `exit=0` · 8/8 | PASS |  |
| `npm run verificar:meas1` | `exit=0` · — | PASS |  |
| `npm run build` | **NO CORRIDO** · grupo `build` | — |  |
| `npm run verificar:salida` | **NO CORRIDO** · grupo `servidor` | — |  |
| `npm run verificar:pwa` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:op1` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:a3` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:m4` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:meas2` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:endurecimiento` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:ui` | **NO CORRIDO** · grupo `navegador` | — |  |
| `npm run verificar:int12` | **NO CORRIDO** · grupo `navegador` | — | gate registrado **FAIL** (LEDGER 2026-08-13). Su PASS no es evidencia: el historial se puede forjar y borrar |

**Cobertura de esta corrida: 9 de 19 comandos.** Los 10 restantes dicen NO CORRIDO a propósito: un bloque que omite lo que no corrió se lee como si todo hubiera pasado.
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
| **B** | Reparar el registro: LEDGER al día, STATE al día, `npm run evidencia` | **en curso** |
| **C** | Anclar la verificación a la spec: 9 huérfanos + 6 verificadores sin AC | siguiente |
| **D** | **H1: convertir "SIN DATOS" en un número.** Consulta de mediana, banco que acumula, maqueta `1l` | pendiente |
| **E** | INT-7: mecanismo de retención **parametrizado**, que falla cerrado si el plazo no está definido | pendiente |
| **F** | INT-12 | **resuelta: riesgo aceptado** |

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
cerrar sesión. Faltan las 3 construibles: `1e` (tarifas), `1g` (reportes), `1l`
(ingreso a pantalla completa). `1l` y `1g` son parte de FASE D.

## Estado de hitos

- M0–M4 — **cerrados**. v1 desplegada y verificada punta a punta.
- M5 Endurecimiento — **cerrado en código y desplegado**. INT-12 como riesgo aceptado.
- M6 Presentación — **en curso**. SPEC-004 entregado; faltan 3 pantallas.
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

Los cinco verificadores de navegador llaman `limpiarFixtures()` al iniciar
(`scripts/lib/fixtures.mjs`) — mecanizado el 2026-08-12, porque era una
precondición que dependía de que alguien se acordara y produjo dos FAIL falsos.
Eso mismo es lo que impide acumular datos de H1: ver FASE D.

Los scripts de navegador conviene espaciarlos unos segundos: en corridas seguidas
se observa contención entre instancias de Edge. Un FAIL aislado en una tanda
secuencial se re-corre solo antes de darlo por real.

Todo comando node/npm/npx/git necesita el prefijo de PATH de `CLAUDE.md` §7
mientras no se reinicie Claude Code.
