# STATE.md — cursor de reanudación

> Archivo **sobrescribible**, corto por diseño. Puntero O(1) para retomar sin
> releer `LEDGER.md` entero. El ledger es append-only y la verdad histórica:
> ante discrepancia, manda el ledger.

**Actualizado:** 2026-08-09

**URL viva: https://estacionamiento-three.vercel.app**

| | |
|---|---|
| **Último hito cerrado** | M4 — Deploy (v1 completa) |
| **Hito en curso** | M5 — Endurecimiento |
| **Próximo AC pendiente** | **M-4** (purga de copias locales) |
| **Punto de reanudación** | Gate A-2 levantado. El concilio abre M-4. |

## ✅ GATE TERMINAL A-2 — CERRADO

Credencial rotada y verificada en las dos direcciones: la expuesta
(`36e1f8c4`) devuelve `28P01`; la vigente (`1b199545`) conecta. Vercel
actualizado y redeployado; producción verificada con la credencial nueva.

## M5 — endurecimiento

Fuente de verdad: `docs/revision-seguridad-2026-08-09.md`. Orden fijo por riesgo
real, **no se reordena**:

| # | Hallazgo | Estado |
|---|---|---|
| 1 | **A-3** — la barrera no protegía el dispositivo | **PASS** (verificado en local y en producción) |
| 2 | **M-4** — sin purga de copias locales sincronizadas/rechazadas | pendiente |
| 3 | **C-1** — login sin freno de fuerza bruta | pendiente |
| 4 | **A-1** — sesiones sin vencimiento ni revocación server-side | pendiente |
| 5 | **M-1 + M-2** — IDOR latentes: contexto por "primera fila" en vez de por usuario | pendiente |

Tras **cada** corrección: regresión completa. Si rompe un AC previo es FAIL.

## Estado de hitos

- M0–M4 — **cerrados**. v1 desplegada y verificada punta a punta.
- M5 Endurecimiento — **en curso**, 1 de 5 cerrado.

## BLOQUEOS HUMANOS (no los resuelve el loop)

1. **A-2 — credencial de Postgres sin rotar.** Verificado por huella: la que
   quedó en los logs de runtime de Vercel (`36e1f8c4`) sigue siendo la vigente.
   Ningún fix de código la resuelve.
2. **`{{BASE_LICITUD}}`** y **`{{PLAZO_RETENCION_PATENTE}}`** — sin ellos el
   sistema no puede recibir vehículos reales. `OPERACION_REAL_HABILITADA=false`.
   Nota: M-4 y A-3 condicionan qué puede prometer la política de retención,
   porque hasta ahora no había forma de purgar las copias del dispositivo.
3. **Deploy por `git push`** — hoy corre por CLI. Falta conectar un remoto de
   GitHub al proyecto `c4-all/estacionamiento`.
4. **Redondeo del monto** — neutro (`Math.round`), pendiente de confirmación
   comercial.

## Comandos de verificación

```
npm test                      # 39 unitarias
npm run build
npm run sembrar
npm run verificar:a3   [url]  # A-3: la patente real no toca el dispositivo
npm run verificar:op1  [url]  # AC-OP-1 (offline real por CDP)
npm run verificar:salida [url]# ciclo ingreso/salida + control de acceso
npm run verificar:meas1       # AC-MEAS-1
npm run verificar:meas2 [url] # AC-MEAS-2 e2e
npm run verificar:pwa  [url]  # AC-PWA-1
npm run verificar:esquema     # AC-DATA-1
npm run limpiar:fixtures
```

Requieren `DATABASE_URL`, `CLAVE_ACCESO` y `SESSION_SECRET` en el entorno. Sin
`[url]` corren contra `localhost:3000`. Los scripts de navegador conviene
espaciarlos unos segundos entre sí: en corridas seguidas se observó contención
entre instancias de Edge.

Todo comando node/npm/npx/git necesita el prefijo de PATH de `CLAUDE.md` §7
mientras no se reinicie Claude Code (`git` ya tiene shim en `~/.local/bin`).
