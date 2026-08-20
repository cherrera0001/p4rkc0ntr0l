@AGENTS.md

# CLAUDE.md — reglas operativas del repo

`spec.md` es la fuente de verdad. Este archivo es su versión ejecutable: lo que
hay que leer antes de tocar código y lo que hace que un cambio se rechace.

**Ante cualquier conflicto entre este archivo y `spec.md`, manda `spec.md`.**

`AGENTS.md` (importado arriba) lo escribe y lo regenera Next.js; contiene reglas
de la versión de Next instalada. No lo borres: `next dev` lo vuelve a crear.

---

## 1. Gate de alcance (ADR-001) — bloqueante

Estos módulos **no se construyen** en la v1. Un cambio que los introduzca se
rechaza, sin excepción, hasta que exista un ADR que enmiende o reemplace ADR-001:

| Prohibido | Incluye |
|-----------|---------|
| Pago / pasarela | Stripe, MercadoPago, Webpay, Transbank, Flow, Khipu, cualquier SDK de cobro; entidades `Pago` / `Transaccion` |
| LPR / cámara | OCR de patentes, captura de imagen, `getUserMedia` para lectura de placas |
| Reservas | Cupos reservados, agenda, entidad `Reserva` |
| Multisitio | Multitenancy, selector de sucursal, entidad `Sucursal` |
| Barreras físicas | Control de barrera, integraciones con hardware de acceso |

**El cobro es manual, en efectivo, fuera del sistema.** La app solo muestra el
monto a cobrar.

Si una tarea parece exigir algo de esta tabla: detenerse, decirlo, y pedir el ADR.
No implementar "una versión chica" ni dejar el hook preparado "por si acaso".

### Enmienda vigente — ADR-004, aceptado parcialmente (2026-08-12)

Se enmendó **una** fila, y solo en un sentido: se habilita **cobro de la
suscripción** (el dueño le paga a C4A por el servicio). Todo lo demás de la tabla
sigue igual, y **multisitio siguió excluido**: ADR-004 se aceptó en su
alternativa 2, no completo.

La distinción que hay que sostener, porque es la que el gate tiene que seguir
haciendo cumplir:

| | Permitido | Prohibido |
|---|---|---|
| Pago de **suscripción** (dueño → C4A) | sí, dentro de `src/lib/suscripcion/` | — |
| Pago del **estacionamiento** (conductor → local) | — | **sí, sin excepción.** Sigue siendo efectivo, fuera del sistema |

**AC-SCOPE-1 ya se reescribió** (2026-08-13, commit `f98a652`). El criterio dejó
de ser un `grep` de marcas de pasarela —que habría dado positivo por diseño en
cuanto entrara una de suscripción— y pasa a describir **la propiedad**: *el
conductor no paga dentro del sistema*.

La frontera declarada es `src/lib/suscripcion/`, **hoy vacía**. Lo que el gate
hace cumplir, y que costó tres bypasses reproducidos descubrir:

- fuera de la frontera, ninguna superficie del producto cobra ni importa pasarela
  —**por exclusión**, no por lista blanca: una ruta de nombre neutro como
  `api/cobro-salida/` evadía la versión enumerada—;
- **dentro** de la frontera tampoco puede vivir el cobro del conductor: no puede
  importar el dominio del estacionamiento (tarifa, sesión), porque eso *es*
  cobrarle al conductor.

### Verificación del gate (AC-SCOPE-1/2/3)

```
npm run verificar:alcance          # los tres criterios, por exclusión
npm run verificar:alcance:prueba   # el gate corrido CON EL FALLO PLANTADO
```

**Los tres `grep` que esta sección publicaba se retiraron el 2026-08-14.** No por
estilo: en PowerShell la traducción con el pipe escapado —`"next\|react"`— es un
pipe **literal** en regex .NET y **nunca matchea**. Medido: `\|` → 0 líneas,
`|` → 9. El gate reportaba PASS incondicionalmente, incluso con `stripe` y
`transbank-sdk` plantados en `package.json`. *Un criterio que siempre pasa es
peor que no tener criterio.*

Además enumeraban archivos, y una ruta nueva —`src/app/api/cobro/route.ts`—
evade cualquier lista blanca. `verificar:alcance` escanea **por exclusión**: toda
la superficie del producto salvo la frontera declarada `src/lib/suscripcion/`,
que además no puede importar el dominio del estacionamiento (tarifa, sesión),
porque eso *es* cobrarle al conductor.

**No lo edites a mano para "actualizarlo".** El criterio vive en `spec.md` §9 y
la propiedad la hace cumplir el script. Si necesitás cambiar el alcance, va por
ADR.

---

## 2. WIP = 1

Un hito a la vez. No se abre el siguiente hasta que los criterios de aceptación
del actual estén **verificados con su comando**, no razonados.

| Hito | Entregable | Cierra con |
|------|-----------|-----------|
| M0 | Repo + `CLAUDE.md` + `.gitignore`. Sin código de app. | estructura lista |
| M1 | PWA (manifiesto + SW), Neon + Drizzle, esquema §4 | AC-DATA-1, AC-SCOPE-1/2, AC-BUILD-1, AC-PWA-1 |
| M2 | Rebanada del operador offline + instrumentación de tecleo | AC-OP-1, AC-OP-2, AC-MEAS-1 |
| M3 | Panel del dueño (ocupación, ingresos, descuadre) | AC-MEAS-2 |
| M4 | Deploy en Vercel + Railway DB (ADR-003) | URL en vivo + registro e2e |
| M5 | Endurecimiento según `docs/revision-seguridad-2026-08-09.md` | A-3, M-4, C-1, A-1, M-1, M-2 verificados + regresión en verde |

**M5 — cerrado en código el 2026-08-10.** El orden se siguió por riesgo real, no
por severidad nominal: A-3 → M-4 → INT-1 → C-1 → INT-14 → A-1 → M-1/M-2 → resto.
La fuente pasó a ser `docs/revision-integral-2026-08-09.md`, que reemplaza y
amplía a `docs/revision-seguridad-2026-08-09.md`.

Tras **cada** corrección se corre la regresión completa. Si una corrección rompe
un AC previo es FAIL: se arregla o se revierte, no se cierra igual.

**Estado al 2026-08-20: M0–M5 cerrados y DESPLEGADOS. M7 y M8 PASS. M6 en curso.**

> **2026-08-20, tarde — ÁRBOL EN ROJO Y SIN COMMITEAR. Leé `STATE.md` antes de
> tocar nada.** La regresión corrida hoy sobre el árbol de trabajo da **dos FAIL
> que el ledger no registra**: `verificar:metrica` **3/4** (MET-1: la resta
> `salida_at - entrada_at` de `verificar-reportes.mjs`, sin commitear, se lee como
> métrica de H1 divergente — y **tapa** el FAIL por banco vacío de
> `verificar:h1`) y `verificar:frontera` **4/5** (503 en
> `POST /api/sesiones/[id]/salida`, **sin diagnosticar**: a mano, como `operador`,
> da 400). **No commitees sobre rojo.** Orden: MET-1 → el 503 → commit → `1l`.
>
> Y una regla de operación que costó una corrida entera: **los verificadores de
> navegador exigen `npm run build` + `npm start`.** Con `next dev`,
> `verificar:ui` da 12/21 y el fallo es del servidor, no del código.

De las pantallas construibles del diseño (`docs/diseno-2026-08-12-traduccion.md`
§1) quedan **una**: `1l`, el ingreso del operador a pantalla completa. `1e`
(tarifas) y `1g` (reportes) se construyeron el 2026-08-19/20, cada una con su
verificador —`verificar:tarifas` y `verificar:reportes`—, los dos **declarados
como huérfanos con su motivo** en `scripts/verificar-ac.mjs`: hacen exigible una
maqueta, no una afirmación de `spec.md` §1–§8, y subirlos a §9 sería autorar
requisitos.

**Dos hallazgos del concilio quedan ABIERTOS y bloqueados por decisión humana**,
no por falta de trabajo: el 404 de `POST /api/sesiones` mal clasificado por la
cola local (corregirlo cambia «bloqueo permanente» por «pérdida de ingresos si la
ruta 404ea durante un deploy») y el DoS de cuenta del login. Están en `LEDGER.md`
con su evidencia reproducida.
**URL viva: https://estacionamiento-three.vercel.app — sirve el código endurecido
y la capa de presentación.** Medido contra la URL viva:
`verificar:endurecimiento` da **30/30** (por la mañana daba 10/29).

**INT-12 — RIESGO ACEPTADO por decisión humana (2026-08-14). Ya no detiene el
hito.** La corrección del módulo es sana y la propiedad se observó en producción
—dos deploys del mismo commit, versiones distintas—, pero el **gate**
`verificar-int12.mjs` no es confiable: su historial se puede inventar y borrar.
INT-12 **no se declara verificado**: se cierra como riesgo aceptado, que no es lo
mismo. Priorización por riesgo real, el mismo criterio que ordenó M5. La salida
técnica que dejó el auditor —re-derivar `{artefacto, versión}` de la URL
inmutable del deployment en vez de creerle al archivo— queda documentada y **no
implementada**. Detalle en `LEDGER.md` (2026-08-14) y en `STATE.md`.

Único hallazgo del informe integral sin cerrar: **INT-7** (mecanismo de retención
de patente), bloqueado por `{{PLAZO_RETENCION_PATENTE}}` y `{{BASE_LICITUD}}`.

El sistema solo acepta patentes de prueba: `OPERACION_REAL_HABILITADA=false`.
Encenderlo exige resolver antes `{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}`.

El estado autoritativo vive en `LEDGER.md` (append-only). Si esta tabla y el
ledger discrepan, manda el ledger.

---

## 3. Placeholders — no inventar valores

Los `{{placeholder}}` de `spec.md` §12 son decisiones humanas pendientes.
No rellenarlos con supuestos, ni con valores "razonables", ni con ejemplos que
parezcan reales. Si un valor falta: detenerse y pedirlo.

Sin resolver hoy: `{{PRECIO_SUSCRIPCION_UF}}`, `{{UMBRAL_H1_SEGUNDOS}}`,
`{{LINEA_BASE_CUADERNO_SEGUNDOS}}`, `{{UMBRAL_H2_DUEÑOS}}`, `{{PLAZO_PILOTO}}`,
`{{PLAZO_RETENCION_PATENTE}}`, `{{BASE_LICITUD}}`, `{{EQUIPO_REVISOR}}`.

Tampoco inventar datos de prueba que parezcan reales (patentes, nombres de
estacionamientos, montos de operación). Los fixtures deben verse como fixtures.

---

## 4. Datos personales (Ley 21.719)

La **patente es dato personal**. Vigencia plena de la ley: **1 de diciembre de 2026**.

- Minimización: solo los campos de `spec.md` §4. No agregar campos "por si sirven".
- Validación de entrada en **toda** frontera donde entre una patente.
- Consultas parametrizadas siempre (Drizzle); nunca SQL concatenado.
- Sin secretos en el repo: todo por variable de entorno. `.env*` está en `.gitignore`.
- `{{PLAZO_RETENCION_PATENTE}}` y `{{BASE_LICITUD}}` deben resolverse **antes**
  de operar con datos reales.

---

## 5. Arquitectura (ADR-002)

Next.js (App Router) como PWA · Route Handlers como API · Vercel · **Postgres en
Railway vía TCP proxy público** (ADR-003, enmienda a ADR-002) · Drizzle con
driver `postgres` (postgres-js) · auth mínima con dos roles (`operador`,
`dueño`).

**Offline-first no es opcional.** El flujo del operador (`spec.md` §5) debe
funcionar sin red: service worker + IndexedDB + sincronización al reconectar.
Un cambio que rompa el registro sin conexión es un cambio que rompe H1.

### Versión de Next.js

Instalada: **Next.js 16.3.0** con React 19.2.8. Es posterior al conocimiento
base del modelo y **tiene cambios de API**. Antes de escribir código de app,
consultar los docs incluidos en `node_modules/next/dist/docs/`. No escribir
Next.js de memoria.

---

## 6. Antes de dar un hito por cerrado

1. Ejecutar los comandos de verificación de `spec.md` §9 que le corresponden.
2. Reportar la salida real. Si algo falla o no se pudo correr, decirlo — no
   describirlo como verificado.
3. Registrar PASS/FAIL con evidencia en `LEDGER.md` (append-only).
4. Actualizar el estado en §2 de este archivo y escribir en `LEARNINGS.md`.

---

## 7. Entorno de desarrollo

Windows + PowerShell. Los comandos de `spec.md` §9 están escritos en sintaxis
POSIX; traducirlos a PowerShell al ejecutarlos (ver §1).

Node 24.19.0, npm 11.17.0 y Git 2.55.0.3 están instalados, pero el proceso de
Claude Code conserva un PATH anterior a la instalación. **Todo comando que use
node/npm/npx/git debe ir prefijado con:**

```powershell
$env:PATH = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path','User')
```

Al reiniciar Claude Code este prefijo deja de ser necesario.

El repo está bajo OneDrive. Advertencia registrada en `LEDGER.md`; por decisión
explícita **no se mueve**.
