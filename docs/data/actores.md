# Inventario de actores — verificado

> Un actor se declara **documentado** solo si `spec.md` o un documento derivado
> lo nombra; **construido** solo con `archivo:línea` que lo pruebe. La ausencia
> se prueba con el barrido que la muestra, no con una afirmación.
>
> Fecha: 2026-08-15 · Árbol: `2c9e286`

---

## 1. Tabla

| Actor | ¿Documentado? | ¿Construido? | ¿Tiene historia? | Evidencia |
|---|---|---|---|---|
| **Operador** | sí — `spec.md` §5 | sí | sí, desde hoy | enum `rol_usuario` (`src/db/schema.ts:31`); `exigirRol("operador")` (`src/app/api/sesiones/route.ts:43`); pantalla (`src/app/pantalla-operador.tsx:294`) |
| **Dueño** | sí — `spec.md` §6 | sí | sí, desde hoy | mismo enum; redirección de quien no lo es (`src/app/dueno/page.tsx:41`); panel (`src/app/dueno/page.tsx:38`) |
| **Sistema (sincronización)** | sí — `docs/data/casos-uso.md:16` | sí | no aplica: no es usuario | `src/lib/cola-local.ts:201`, `src/lib/cola-local.ts:286` |
| **Administrador de plataforma** | **NO** | **NO** | propuesta, bloqueada | ver §2 |
| **Conductor** | mencionado, **no es actor del sistema** | no, y es deliberado | no corresponde | AC-SCOPE-1 lo nombra como el sujeto que **no** paga dentro del sistema (`spec.md` §9). No tiene cuenta, ni pantalla, ni fila |

---

## 2. El actor faltante, con su prueba de ausencia

**Quien aprovisiona y configura un estacionamiento cliente no existe en el
repositorio: ni como rol, ni como ruta, ni como historia.**

Tres barridos lo prueban:

```
1) El enum de roles tiene dos valores, no tres
   src/db/schema.ts:31 → pgEnum("rol_usuario", ["operador", "dueño"])

2) No hay ninguna ruta de administración
   $ find src/app -type f
   → 17 archivos. api/login, api/sesiones, api/sesiones/[id]/salida,
     dueno/, login/, offline/, y los componentes. Ninguna de admin.

3) "admin" en el código son tres comentarios sobre infraestructura
   $ grep -rniE "\badmin|aprovision|onboarding|provisioning|superusuario" src/
   src/lib/auth.ts:9       "...que administrar en contra del criterio rector"
   src/lib/auth.ts:32      "...es otra tabla que administrar"
   src/lib/limite-intentos.ts:17  "...una tabla o un Redis más que administrar"
   → cero código.
```

### Quién hace hoy ese trabajo

`scripts/sembrar.mjs`. El alta de un estacionamiento, su tarifa inicial y sus
usuarios la ejecuta **un humano con `DATABASE_URL` y una terminal**:

| Acto | Cita |
|---|---|
| crear el `estacionamiento` | `scripts/sembrar.mjs:130` |
| crear su primera `tarifa` | `scripts/sembrar.mjs:151` |
| crear los usuarios con su rol | `scripts/sembrar.mjs:176` |

El actor existe en la operación real del piloto; lo que no existe es su
representación en el producto. **Ese es el hueco**, y es de producto, no de
documentación: no hay historia, no hay spec, no hay código.

---

## 3. `tenant` en el repo — qué dice la evidencia

La premisa *«el modelo ya declara aislamiento por tenant»* **no se sostiene
contra el árbol**. No hay entidad `tenant`, ni columna `tenant_id`, ni rol
`plataforma`.

| Dónde | Qué dice |
|---|---|
| `src/db/schema.ts:33` | la tabla raíz es `estacionamiento`; no hay tabla sobre ella |
| `src/lib/contexto.ts:16` | *«La v1 sigue siendo de un solo estacionamiento: **esto no es multitenancy ni la prepara**»* |
| `docs/data/MER.md:84` | el diagrama anota `estacionamiento_id` como *«sin tenant - ADR-004 alt.2»* |
| `docs/data/MER.md:148` | `TENANT` / `SITIO` → **no pasa** |
| `docs/adr/ADR-004-multisitio-y-suscripcion.md:35` | en el bloque de la **decisión aceptada**: *«Sigue excluido — Multisitio / entidad `tenant` / rol `plataforma`»* |
| `scripts/verificar-alcance.mjs:101` | el gate en ejecución rechaza un conmutador de `tenant` por expresión regular |

### Lo que sí existe: aislamiento por `estacionamiento_id`

No es tenancy, pero tampoco es nada. Es una **corrección de seguridad**
(hallazgos M-1 y M-2) y está aplicada en todos los caminos de datos:

| Camino | Cita |
|---|---|
| el rol y el estacionamiento se releen de la base en cada petición | `src/lib/auth.ts:96` |
| lista de activas del operador | `src/app/api/sesiones/route.ts:58` |
| inserción de un ingreso | `src/app/api/sesiones/route.ts:169` |
| pertenencia antes de cerrar una salida | `src/app/api/sesiones/[id]/salida/route.ts:66` |
| tarifa vigente | `src/app/api/sesiones/[id]/salida/route.ts:84` |
| ocupación e ingresos del panel | `src/app/dueno/page.tsx:55`, `src/app/dueno/page.tsx:67` |

**Y el hallazgo que importa: ese aislamiento no tiene un solo control negativo.**
Ningún verificador siembra un segundo estacionamiento, así que ninguno prueba que
un usuario de A no vea los datos de B:

```
$ grep -rniE "(segundo|otro).{0,40}estacionamiento" scripts/*.mjs scripts/lib/*.mjs
→ ninguna coincidencia relativa a un segundo estacionamiento.
$ grep -niE "otro estacionamiento|ajena|pertenen|cruz" scripts/verificar-salida.mjs
→ 0 líneas.
```

La propiedad se cumple **por construcción y por tener un solo cliente sembrado**.
Es exactamente la forma de la casualidad que `src/lib/contexto.ts:6` describe
para el defecto que M-2 corrigió: *«Con un solo estacionamiento sembrado el
resultado coincidía por casualidad, y esa casualidad es toda la separación que
había.»*

---

## 4. La distinción tenant / sucursal — estado real

La distinción **tenant** (un negocio cliente, aislado) ≠ **sucursal** (un cliente
con varios recintos) es válida y útil. Lo que hay que decir con precisión es qué
hizo el repo con ella:

**ADR-004 nunca la adjudicó.** Su título es *«Multisitio bajo un tenant»*
(`docs/adr/ADR-004-multisitio-y-suscripcion.md:1`) y su alternativa 1 propone la
entidad `tenant` **explícitamente como soporte de 1..N sitios**
(`docs/adr/ADR-004-multisitio-y-suscripcion.md:95`). La decisión rechazó ese
paquete completo. **No evaluó por separado el caso «N clientes, un recinto cada
uno»**, que es el que la doctrina SaaS necesita y el que ninguna de las tres
alternativas consideradas describe (`docs/adr/ADR-004-multisitio-y-suscripcion.md:152`).

Consecuencia operativa, en los dos sentidos:

- **No está permitido por omisión.** El texto aceptado excluye la entidad
  `tenant` y el rol `plataforma` **por nombre**, y el gate los rechaza hoy. Nadie
  puede construirlos citando esta distinción.
- **No está rechazado por argumento.** La razón escrita para excluir es *«un
  dueño con tres estacionamientos prueba H1 y H2 con uno»*
  (`docs/adr/ADR-004-multisitio-y-suscripcion.md:36`) — un argumento sobre
  **multisitio**, que no dice nada sobre tener dos clientes distintos.

Por eso el siguiente entregable es un ADR y no una implementación: la pregunta
está abierta, y abrirla es decisión del humano.

---

## 5. Ley 21.719 — qué dato personal aparece con este actor

Precisión que conviene no perder: la ley protege datos de **personas naturales**.
Los datos de un negocio (razón social, capacidad, zona horaria) no son dato
personal por sí mismos; los de las personas que lo operan, sí.

| Dato | ¿Personal? | Hoy |
|---|---|---|
| `patente` | **sí** | `src/db/schema.ts:116`. Retención y licitud sin resolver — INT-7 |
| `usuario.email` | **sí** — identifica a una persona natural | `src/db/schema.ts:51`. **Sin plazo de retención declarado en ninguna parte** |
| `usuario.rol`, `usuario.estacionamiento_id` | asociados a esa persona | `src/db/schema.ts:53` |
| nombre, capacidad, zona horaria del estacionamiento | no, por sí mismos | `src/db/schema.ts:37` |

**Brecha nueva que este inventario deja escrita:** el proyecto tiene plazo de
retención pendiente para la patente y **ninguno, ni siquiera pendiente, para los
datos del operador**. Si el alta de clientes se construye, ese vacío se
multiplica por cliente. Placeholder propuesto: `{{PLAZO_RETENCION_USUARIO}}`.
