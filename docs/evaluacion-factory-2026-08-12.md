# Evaluación por rol y avance real — 2026-08-12

> Pedido del decisor: *"evaluar de forma completa en cada rol existente en el
> proceso de factory de una app PWA; aún no veo que funcione correctamente; qué
> pasó con los módulos definidos y el diseño de Claude Design; ¿qué porcentaje
> real de avance existe?"*
>
> Documento de estado, no de plan. Todo lo que afirma está medido con comando y
> tiene su evidencia en `LEDGER.md`. Lo que no está medido, se dice que no lo está.

---

## 0. La respuesta corta

**El sistema funciona. Lo que no existe es el producto que muestran las maquetas.**

Son dos cosas distintas y por eso conviven "todo verde" y "no veo que funcione":

- Contra `spec.md` —el contrato firmado— los diez criterios de aceptación están
  en PASS, verificados con comando contra la URL viva.
- Contra las catorce maquetas de Claude Design, **cero están construidas**. Lo
  que se desplegó es el esqueleto funcional: HTML semántico, sin capa de
  presentación.

El login funciona en producción, con los dos roles, comprobado el 2026-08-12:

```
operador@fixture.invalid -> HTTP 200 · {"rol":"operador","destino":"/"}
duena@fixture.invalid    -> HTTP 200 · {"rol":"dueño","destino":"/dueno"}
```

---

## 1. Avance real — con el denominador explícito

Un porcentaje sin denominador no dice nada. Hay cinco denominadores razonables y
dan números muy distintos. Los cinco son verdaderos a la vez.

| # | Denominador | Avance | Qué falta |
|---|---|---|---|
| A | **`spec.md` v1** — el contrato | **~95 %** | Deploy por `git push` (§8, hoy es CLI). Retención y base de licitud (§4) son placeholders humanos. |
| B | **Endurecimiento** (M5, posterior a la spec) | **~95 %** | 20 de 21 hallazgos cerrados. INT-7 abierto por bloqueo humano. Producción 29/30. |
| C | **Operable con vehículos reales** | **0 %** | `OPERACION_REAL_HABILITADA=false`. No lo desbloquea código: faltan `{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}`, y después hay que **construir** el mecanismo de retención (INT-7). |
| D | **Capa de diseño** (14 maquetas) | **0 % construido · 100 % traducido** | 6 construibles sin ADR, 6 fuera de ADR-001, 2 mixtas. Traducidas a SPEC-004/005 en `docs/diseno-2026-08-12-traduccion.md`. |
| E | **Producto vendible** (H2: el dueño paga) | **bloqueado** | Exige ADR-004 (multisitio + cobro de suscripción), hoy en estado **propuesto**. |

**El número honesto depende de qué estás mirando:**

- Si el objetivo es *"un piloto que pruebe H1 con un operador real"* → **~90 %**.
  Lo que falta es decisión, no código.
- Si el objetivo es *"la plataforma de las maquetas"* → **~25 %**. El motor está;
  la carrocería y la mitad de las pantallas requieren enmendar ADR-001.

---

## 2. Evaluación por rol

### 2.1 Producto / spec-driven — **sólido**

Diez criterios de aceptación, todos con comando y evidencia. Ninguno se declaró
PASS por razonamiento.

Lo que este rol hizo bien y no es habitual: **enmendar un criterio en vez de
falsearlo.** AC-PWA-1 pedía "auditoría PWA (Lighthouse)"; Lighthouse eliminó la
categoría PWA. En vez de declarar PASS con otra herramienta, se registró el FAIL,
se escribió la enmienda visible en `spec.md` §9 y se construyó un verificador
propio sobre CDP.

**Deuda:** ocho `{{placeholder}}` sin resolver, seis de ellos de negocio. Dos
—`{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}`— bloquean la operación real.
Ninguno se rellenó con supuestos, que es lo correcto, pero llevan cuatro días
abiertos.

### 2.2 Diseño (UX/UI) — **el hueco real**

Aquí está la brecha entre lo que se ve y lo que se esperaba.

Las catorce maquetas de Claude Design se **leyeron, auditaron y tradujeron**, y no
se implementaron. La razón está registrada: el archivo de origen declara en su
primera tarjeta que no cabe en ADR-001. Se aplicó `CLAUDE.md` §1 — detenerse,
decirlo, pedir el ADR — en lugar de construir "una versión chica".

| Estado | Maquetas |
|---|---|
| **DENTRO** del gate — construibles ya | `1b` `1c` `1e` `1g` `1l` `1n` |
| **MIXTAS** — cabe la mitad | `1a` `1f` |
| **FUERA** — exigen ADR-004 | `1d` `1h` `1i` `1j` `1k` `1m` |

La auditoría del diseño encontró tres defectos que **no** conviene arrastrar:

1. **`1e` contradice AC-OP-2.** El simulador de tarifas calcula `18.667` donde el
   sistema cobra `19.000` (9 h 20 con fracción de 15). Es prorrateo puro sin
   aplicar la fracción. La maqueta está mal, no el sistema — y es la pantalla
   donde el dueño fija su tarifa: si simula distinto de lo que cobra, decide
   sobre una cuenta falsa.
2. **`tecleo mediano 6,2 s`** aparece en `1g` y `1k` como si H1 estuviera medido.
   No hay ninguna medición. Es el valor inventado más peligroso del set, porque
   convierte la hipótesis del proyecto en un hecho de pantalla.
3. **Dos dependencias externas** (`fonts.googleapis.com` por `@import`,
   `unpkg.com/lucide@latest` sin versión fijada) incompatibles con la CSP de
   INT-2 y con la minimización. Hay que autoalojar.

**Veredicto del rol:** el trabajo de diseño está hecho como *especificación*
(SPEC-004 presentación, SPEC-005 comportamiento, AC-UI-1..4, AC-UX-1..8) y
**nada** como código. Es el hito M6, y M6 no se abrió porque el gate terminal
estaba —y sigue— abierto.

### 2.3 Arquitectura — **correcta y declarada**

Next.js 16.3.0 App Router · Route Handlers · Vercel · Postgres en Railway por TCP
proxy público · Drizzle sobre postgres-js · auth de dos roles.

Dos decisiones que se documentaron en vez de esconderse:

- **ADR-003** cambió Neon por Railway y asumió por escrito el costo: se rompe
  "un proveedor, una factura" y la base queda expuesta a internet.
- **La salida requiere conexión.** El monto se calcula en el servidor con la
  tarifa vigente, porque un cliente que estuvo sin red puede tener una tarifa
  vieja y mostrar un monto equivocado al cobrar en efectivo es peor que pedir
  señal un momento. El ingreso —lo que mide H1— sí funciona sin red.

**Deuda declarada:** la auth es separación de roles, no identidad. Una clave
compartida. Alcanza para dos roles en un estacionamiento; no alcanza para
multiusuario real, y `1f` (usuarios y permisos) lo va a exigir.

### 2.4 Implementación — **completa para el alcance v1**

Módulos que existen y están probados:

| Módulo | Qué resuelve |
|---|---|
| `src/lib/tarificacion.ts` | AC-OP-2 — fracción, mínimo, redondeo. Función pura. |
| `src/lib/patente.ts` | Frontera de dato personal (`spec.md` §7). |
| `src/lib/cola-local.ts` | IndexedDB + sincronización + purga (A-3, M-4). |
| `src/lib/auth.ts` · `sesion-token.ts` | Cookie HMAC, `exp` firmado, revocación. |
| `src/lib/limite-intentos.ts` | C-1 — freno de fuerza bruta, 429 + `Retry-After`. |
| `src/lib/tiempo.ts` | INT-14 — cota del reloj del cliente. |
| `src/lib/errores.ts` | INT-1 — saneo; recorre `cause` hasta el driver. |
| `src/proxy.ts` | INT-2 — CSP con nonce por petición. |
| `src/app/pantalla-operador.tsx` | `spec.md` §5 — ingreso, permanencia, salida. |
| `src/app/dueno/page.tsx` | `spec.md` §6 — ocupación, ingresos, descuadre. |

97 pruebas unitarias en 24 suites. `tsc --noEmit` y `eslint` limpios.

**Lo que NO existe:** capa de presentación (M6), exportación CSV, versionado de
tarifas por UI, reportes, gestión de usuarios. Todo eso es diseño traducido y no
construido.

### 2.5 Datos / data-driven — **el modelo es correcto; la medición todavía no midió nada**

El esquema coincide campo por campo con `spec.md` §4 y ahora se verifica
mecánicamente (4 tablas, 3 enums, 4 FKs, columnas de tecleo `NOT NULL`).
Minimización respetada: sin `Pago`, `Transaccion`, `Sucursal`, `Reserva`.

**Pero la instrumentación no produjo datos.** AC-MEAS-1 comprueba que *toda sesión
cerrada tenga los timestamps de tecleo*, y pasa. Lo que no existe es una sola
medición real: cada corrida de verificación limpia sus fixtures, y la base termina
en `sesiones restantes: 0`. El numerador de H1 sigue vacío.

Esto es lo que hace tan grave el `6,2 s` de la maqueta: pone un número donde el
proyecto todavía no tiene ninguno.

### 2.6 QA / verificación — **el rol que más maduró, y el que más falló**

Once verificadores ejecutables, no once descripciones. Contra la URL viva, no solo
contra localhost.

Y sin embargo, este rol produjo los dos peores defectos del proyecto — los dos de
la misma familia: **una comprobación que no puede fallar se lee como aprobación.**

1. **`verificar-endurecimiento.mjs` moría a mitad de corrida.** Un 500 con cuerpo
   vacío lo mataba en `r.json()`. Reportó "10 FAIL" contra producción donde había
   **19**. Ese número se leyó durante dos días como el estado de producción, y era
   el punto donde el script se cayó. Peor: el sesgo apunta siempre a subestimar,
   porque cuanto más rota está la cosa medida, antes se cae el medidor.
2. **`verificar-esquema.mjs` no emitía veredicto.** Volcaba el esquema y salía con
   `exit=0` pasara lo que pasara. Cinco entradas del ledger dicen "AC-DATA-1: PASS"
   apoyadas en un humano mirando un volcado.

Los dos están corregidos y —esto es lo que importa— convertidos en mecanismo:

- `scripts/verificar-verificadores.mjs` — guard estático sobre los diez
  verificadores: ninguno llama `.json()` crudo, todos emiten veredicto.
- `scripts/lib/fixtures.mjs` — limpieza al inicio de los cinco verificadores de
  navegador. Cerró una deuda que `LEARNINGS.md` tenía anotada como "sin mecanizar"
  y que ya había producido dos FAIL falsos.

**Deuda del rol:** la comprobación de minimización de INT-4 pasa como
`(sin sesiones activas: no concluyente)`. Es honesta en el detalle, pero **PASA sin
concluir** — la misma familia de defecto, todavía abierta.

### 2.7 Seguridad y privacidad — **el rol con más trabajo hecho**

Dos revisiones adversariales (12 y luego 20+ hallazgos). Veinte cerrados con
verificador propio. La credencial se rotó dos veces por `ALTER USER` sobre la base
viva —no editando variables, que no habría rotado nada— y se verificó por huella
que la vieja quedara muerta.

La barrera de datos reales es **de código, no de documentación**: con
`OPERACION_REAL_HABILITADA=false` una patente real no llega al servidor y **ni
siquiera se escribe en el dispositivo** (A-3). Una advertencia depende de que
alguien la lea; esto no.

**Lo que sigue abierto:**

- **INT-7** — no existe mecanismo de retención. Y resolver los dos placeholders no
  alcanza: `patente NOT NULL` impide hoy el enmascaramiento que `spec.md:150`
  promete. Hace falta migración + tarea de purga.
- La base sigue expuesta a internet por el proxy público (por diseño, ADR-003).
- `.env` vive en una carpeta sincronizada por OneDrive, con la credencial en claro.

### 2.8 Deploy / SRE — **funciona, pero no como pide la spec**

URL viva y verificada punta a punta. Cuatro variables como secretos, ninguna en el
repo. Pero el deploy corre por **CLI de Vercel**, no por `git push` como pide
`spec.md` §8. Y hasta hoy, M5 entero llevaba dos días **sin commitear**: producción
servía el código anterior al endurecimiento mientras el ledger decía "cerrado".

Esa brecha —"cerrado en código" ≠ "cerrado en producción"— es la que el gate
terminal existe para hacer visible, y funcionó: hoy se midió 10/29 contra la URL
viva y se corrigió desplegando.

**Lección que este rol pagó cara:** un hito no está cerrado hasta que está
desplegado. "Cerrado en código" es un estado intermedio, no un cierre.

### 2.9 Gobernanza — **el rol que sostuvo al resto**

`LEDGER.md` append-only con evidencia de comando. `STATE.md` como puntero de
reanudación. `LEARNINGS.md` con lecciones generalizables. Gate ADR-001 verificado
con `grep` en cada cierre. Concilio de tres roles donde el implementador no cierra
su propio trabajo.

Es lo que permite que este documento exista: cada afirmación se puede rastrear a
una salida de comando fechada.

---

## 3. Los tres bloqueos que no resuelve el código

1. **`{{BASE_LICITUD}}` + `{{PLAZO_RETENCION_PATENTE}}`** → sin ellos, cero
   vehículos reales. Y después hay que construir INT-7.
2. **ADR-004 (multisitio + cobro de suscripción)** → en estado *propuesto*.
   Mientras diga eso, seis de las catorce pantallas están bloqueadas. La
   alternativa recomendada a evaluar primero es la enmienda mínima: cobro de
   suscripción **sin** multisitio.
3. **Repositorio remoto** → destino `cherrera0001/p4rkc0ntr0l`. Decisión del
   decisor: pasarlo a **privado** antes de empujar, porque el árbol contiene los
   dos informes de vulnerabilidades.

---

## 4. Qué sigue, en orden

1. **Cerrar el gate terminal** — falta INT-12 en producción (29/30). En curso.
2. **M6 — capa de presentación.** Las 6 pantallas construibles sin ADR, con los
   tres defectos del diseño corregidos: la fórmula de `1e`, el `6,2 s` inventado,
   y autoalojar fuentes e íconos.
3. **Decidir ADR-004** — desbloquea o cancela las otras 6.
4. **Resolver los placeholders de cumplimiento** y construir INT-7.
5. **Medir H1 de verdad** — el piloto todavía no tiene un solo dato de tecleo real.
