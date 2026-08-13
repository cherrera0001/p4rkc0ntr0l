# STATE.md — cursor de reanudación

> Archivo **sobrescribible**, corto por diseño. Puntero O(1) para retomar sin
> releer `LEDGER.md` entero. El ledger es append-only y la verdad histórica:
> ante discrepancia, manda el ledger.

**Actualizado:** 2026-08-12

**URL viva: https://estacionamiento-three.vercel.app**
**Atención: producción sirve el código ANTERIOR al endurecimiento. Falta desplegar.**
**Comprobado el 2026-08-12, no supuesto: 19 comprobaciones de endurecimiento en FAIL
contra la URL viva** (antes se creía que eran 10; el verificador moría a mitad de
corrida y el número reportado era el punto del crash, no el estado de producción).

| | |
|---|---|
| **Último hito cerrado** | M5 — Endurecimiento (código) |
| **Hito en curso** | ninguno — **M6 bloqueado por gate terminal ABIERTO** |
| **Próximo paso** | commitear M5, conectar remoto, desplegar, y volver a correr el comando de abajo |
| **Punto de reanudación** | Todo el informe integral corregido salvo INT-7, que es bloqueo humano |

## GATE TERMINAL de M6 — ABIERTO (reverificado 2026-08-12)

Tres partes. Dos cierran, una no. Detalle y evidencia en `LEDGER.md`.

| Parte | Estado |
|---|---|
| A-2 — credencial rotada vía `ALTER USER` (huella `1b199545`, ≠ expuesta `36e1f8c4`) | **PASS** |
| Sincronía con Railway (`verificar:esquema` → 4/4, `AC-DATA-1: PASS`, exit=0) | **PASS** |
| Producción endurecida | **FAIL — 10/29** |

El único comando que hay que volver a poner en verde:

```
node --env-file=.env scripts/verificar-endurecimiento.mjs https://estacionamiento-three.vercel.app
```

**No es una regresión de código**: el mismo verificador, mismo árbol, da 30/30
PASS en local. Es el deploy que falta. Ninguna corrección levanta este gate.

Lo que hoy está expuesto en la URL viva, medido y no estimado:

- **INT-4** — al dueño **no** se le niega la lista de patentes, y la API devuelve
  la fila entera de cada sesión (11 campos) en vez de tres. Es lo más grave: dato
  personal de más, a quien no le corresponde, en un sistema en línea.
- **INT-14** — un ingreso con el reloj adelantado responde 500 y deja la sesión
  incerrable; un reloj atrasado factura `$504.250`.
- **INT-15** — el doble toque responde 500.
- **INT-2 / INT-8 / INT-12 / C-1 / A-1 / B-2** — sin CSP, sin cierre de sesión,
  caché `-v1`, sin freno de fuerza bruta, cookie sin `exp`, sin chequeo de origen.

Mientras esté abierto: **no se toca `src/`**. Los tres defectos de la capa de
diseño (`1e`, `6,2 s`, fuentes e íconos externos) son ítems de M6 y quedan sin
corregir.

## M5 — endurecimiento

Fuentes: `docs/revision-seguridad-2026-08-09.md` y, sobre ella,
`docs/revision-integral-2026-08-09.md`.

| Hallazgo | Estado |
|---|---|
| **A-3** — la barrera no protegía el dispositivo | **PASS** |
| **M-4** — sin purga de copias locales | **PASS** (ciclo 2, 29/29) |
| **INT-1** — el driver reimprimía la credencial en los logs | **PASS** |
| **C-1** — login sin freno de fuerza bruta | **PASS** |
| **INT-14** — timestamps del cliente sin cota | **PASS** |
| **A-1 + M-3** — sesión sin vencimiento ni revocación | **PASS** |
| **INT-11 + INT-12 + INT-3** — shell envenenable y caché sin versionar | **PASS** |
| **M-1 + M-2 + INT-4 + B-3** — contexto por usuario y minimización | **PASS** |
| **INT-15 + INT-16 + INT-17** — invariantes e índices en la base | **PASS** |
| **INT-19 + INT-20** — captura de errores y configuración distinguible | **PASS** |
| **INT-2** — CSP y Permissions-Policy | **PASS** |
| **INT-8 + B-4** — cierre de sesión que limpia el dispositivo | **PASS** |
| **INT-9, B-1, B-2, PRV-obs-1** — hallazgos bajos | **PASS** |
| **INT-7** — mecanismo de retención de patente | **BLOQUEADO** (humano) |
| **OFF-obs-4** — reconciliación no atómica | anotado, sin corregir |

Tras **cada** corrección: regresión completa. Si rompe un AC previo es FAIL.

## Estado de hitos

- M0–M4 — **cerrados**. v1 desplegada y verificada punta a punta.
- M5 Endurecimiento — **cerrado en código**, pendiente de deploy.

## BLOQUEOS HUMANOS (no los resuelve el loop)

1. **`{{BASE_LICITUD}}`** y **`{{PLAZO_RETENCION_PATENTE}}`** — sin ellos el
   sistema no puede recibir vehículos reales. `OPERACION_REAL_HABILITADA=false`.
   Y como señala INT-7, decidirlos **no alcanza**: no hay mecanismo que los
   aplique, y `patente NOT NULL` impide el enmascaramiento que `spec.md:150`
   promete. Hace falta una migración y una tarea de purga.
2. **Deploy por `git push`** — hoy corre por CLI. Destino indicado por el decisor
   el 2026-08-12: `https://github.com/cherrera0001/p4rkc0ntr0l` (existe, vacío,
   **público**). **Remoto NO configurado y nada empujado**, a la espera de una
   decisión: el árbol contiene `docs/revision-seguridad-2026-08-09.md` y
   `docs/revision-integral-2026-08-09.md` — la revisión de vulnerabilidades de un
   sistema con URL viva cuyos hallazgos producción todavía **no tiene
   corregidos**. Además, M5 entero sigue sin commitear (24 modificados, 19
   nuevos): hoy no hay nada que empujar.
3. **Redondeo del monto** — neutro (`Math.round`), pendiente de confirmación
   comercial.
4. **Duración de sesión: 12 h** — elegida, no heredada de `spec.md`. Es decisión
   de operación; se cambia en `src/lib/sesion-token.ts`.
5. **Permanencia máxima facturable: 30 días** — techo técnico contra un reloj
   roto, no una regla de negocio. Se cambia en `src/lib/tiempo.ts`.
6. **ADR-004 — multisitio y cobro de suscripción** (2026-08-12). La capa de
   diseño importada exige enmendar ADR-001. Borrador en
   `docs/adr/ADR-004-multisitio-y-suscripcion.md`, estado **propuesto**: 6 de
   sus 14 pantallas están bloqueadas hasta que alguien decida. Traducción
   completa en `docs/diseno-2026-08-12-traduccion.md`. Lo construible sin ADR
   es M6 (capa de presentación + 6 pantallas) y va **después** del deploy.

## Comandos de verificación

```
npm test                              # 97 unitarias
npm run build
npm run lint
npm run sembrar
npm run verificar:a3   [url]          # A-3: la patente real no toca el dispositivo
npm run verificar:m4   [url]          # M-4: purga de copias locales
npm run verificar:op1  [url]          # AC-OP-1 (offline real por CDP)
npm run verificar:salida [url]        # ciclo ingreso/salida + control de acceso
npm run verificar:meas1               # AC-MEAS-1
npm run verificar:meas2 [url]         # AC-MEAS-2 e2e
npm run verificar:pwa  [url]          # AC-PWA-1
npm run verificar:esquema             # AC-DATA-1
npm run verificar:invariantes         # INT-15/16/17 (solo lectura)
npm run verificar:endurecimiento [url]# INT-2/4/8/11/12/14/15, A-1, C-1, B-2
npm run verificar:verificadores       # guard sobre los propios verificadores
npm run limpiar:fixtures
```

Requieren `DATABASE_URL`, `CLAVE_ACCESO` y `SESSION_SECRET` en el entorno; los
dos verificadores nuevos ya traen `--env-file=.env`. Sin `[url]` corren contra
`localhost:3000`. Los scripts de navegador conviene espaciarlos unos segundos
entre sí: en corridas seguidas se observó contención entre instancias de Edge
(y una vez, un `EBUSY` al borrar el perfil temporal de puppeteer).

~~Antes de correr los verificadores de navegador: `npm run limpiar:fixtures`.~~
**Ya no hace falta: mecanizado el 2026-08-12.** Los cinco verificadores de
navegador (`a3`, `m4`, `op1`, `meas2`, `endurecimiento`) llaman `limpiarFixtures()`
al iniciar, vía `scripts/lib/fixtures.mjs`. Era una precondición que dependía de
que alguien se acordara, y produjo FAIL falsos dos veces (`op1` el 2026-08-10,
`m4` el 2026-08-12). Se sigue pudiendo limpiar a mano al terminar una tanda.

Todo comando node/npm/npx/git necesita el prefijo de PATH de `CLAUDE.md` §7
mientras no se reinicie Claude Code (`git` ya tiene shim en `~/.local/bin`).
