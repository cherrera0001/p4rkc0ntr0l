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
| **Hito en curso** | M6 — capa de presentación (SPEC-004 entregado) |
| **Bloqueo activo** | **INT-12 vetado por el auditor.** Ciclo 2 de 3. |
| **Próximo paso** | Recibir la corrección del implementador, reauditar, redesplegar |

## INT-12 — VETADO (2026-08-13)

Los 30/30 contra producción son reales, pero **el verificador de INT-12 no mide
la propiedad que INT-12 exige.** El auditor reprodujo el bypass en un sandbox:

`resolverVersionApp` retorna en el primer candidato, y el primero es el commit.
**Dos deploys del mismo SHA producen la misma versión** → mismo caché → el
`activate` del worker no purga nada → sobrevive el shell viejo. Es INT-12 textual,
con mejor cara: se pasó de "versión vacía" a "versión válida pero constante".

Alcanzable hoy: el remoto ya está configurado, así que `VERCEL_GIT_COMMIT_SHA`
deja de venir vacío y pasa a ser **la** fuente. Un *Redeploy* del mismo commit
—lo normal tras rotar un secreto o cambiar una variable— publica un artefacto
distinto con versión idéntica.

Qué se pidió corregir:

1. Componer la versión en vez de retornar en el primer candidato: única **por
   deploy** y a la vez trazable.
2. La comparación con la versión anterior deja de ser opcional (hoy sin
   `--anterior` imprime NOTA y sale 0).
3. `verificar-int12.mjs` entra a `package.json`. Un verificador que nadie corre
   no es una red.
4. Prueba del caso mismo-SHA / deployment id distinto. Hoy no existe: el test de
   "dos deploys distintos" solo varía el SHA y asume la conclusión.
5. Secundario: `next.config.ts` se evalúa más de una vez por build con
   `Date.now()` distinto.

## M6 — capa de presentación · SPEC-004 entregado

Tokens tomados de `_ds/…/colors_and_type.css` del proyecto de Claude Design vía
`DesignSync`. Ningún valor inventado.

| AC | Estado | Comando |
|---|---|---|
| AC-UI-1 · cero literales hex en `.tsx` | **PASS** | `Select-String "#[0-9A-Fa-f]{6}"` sobre `src\**\*.tsx` |
| AC-UI-2 · escala tipográfica por token | **PASS** | `Select-String "font-size:\s*\d"` sobre `.tsx` |
| AC-UI-3 · cero recursos de terceros | **PASS** | `Select-String "fonts.googleapis\|unpkg\|cdn."` sobre `src\`,`public\` |
| AC-UI-4 · la CSP sigue en verde | **PASS** | `verificar:endurecimiento` → 30/30 |

Pantallas con el sistema aplicado: `login`, operador, panel del dueño, descuadre,
cerrar sesión. Falta el resto de las 6 construibles: `1e` (tarifas), `1g`
(reportes), `1l` (ingreso a pantalla completa).

**Defecto que M6 corrigió y explicaba lo que se veía:** `globals.css` era la
plantilla por defecto de Next, con `font-family: Arial`. La app cargaba Geist por
`next/font/google` y lo descartaba en la línea siguiente.

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
npm run verificar:verificadores       # guard sobre los propios verificadores
npm run limpiar:fixtures
```

Requieren `DATABASE_URL`, `CLAVE_ACCESO` y `SESSION_SECRET`. Sin `[url]` corren
contra `localhost:3000`.

~~Antes de correr los verificadores de navegador: `npm run limpiar:fixtures`.~~
**Mecanizado el 2026-08-12:** los cinco verificadores de navegador llaman
`limpiarFixtures()` al iniciar (`scripts/lib/fixtures.mjs`). Era una precondición
que dependía de que alguien se acordara y produjo dos FAIL falsos.

Los scripts de navegador conviene espaciarlos unos segundos: en corridas seguidas
se observa contención entre instancias de Edge. Un FAIL aislado en una tanda
secuencial se re-corre solo antes de darlo por real.

Todo comando node/npm/npx/git necesita el prefijo de PATH de `CLAUDE.md` §7
mientras no se reinicie Claude Code.
