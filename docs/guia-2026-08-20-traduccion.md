# Traducción de la guía de arquitectura (Directus + Qdrant) a este repo

**Fecha:** 2026-08-20
**Origen:** guía de un starter público — Next.js 16 (App Router, Server
Components) · Directus 11 sobre PostgreSQL · Directus Sync · Qdrant · stacks
Docker aislados por worktree · skills en `.agents/skills`.
**Decisión humana que la habilita:** *«qdrant y directus mantener, pero Vercel se
queda acá»* (2026-08-20). Es enmienda a ADR-006, hoy PROPUESTO.

**Qué es este documento.** La guía llega como README de otro proyecto: describe
un stack completo y homogéneo, con Docker Compose y un *journal* como demo. Este
archivo lo convierte en lo que el repo sabe consumir — afirmaciones verificables,
frontera declarada, y una partición explícita entre lo que cabe en el gate y lo
que no. **No implementa nada.**

**Qué NO es.** No es una aprobación de ADR-006 ni una declaración de viabilidad:
§3 explica qué medición sigue faltando y por qué no se pudo correr hoy.

---

## 1. Veredicto de gate (ADR-001) — bloqueante

La guía trae un modelo de datos propio. **Dos de sus entidades no entran, y no
por criterio de estilo:**

| De la guía | Gate | Veredicto |
|---|---|---|
| `parking_transactions` | ADR-001 prohíbe la entidad `Transaccion`; `AC-SCOPE-2` lo hace cumplir | **FUERA.** El cobro del conductor es en efectivo, fuera del sistema |
| `parking_lots` como agrupador de varios recintos | `AC-SCOPE-4`: el modelo no puede tener ninguna entidad **por encima** de `estacionamiento` | **FUERA.** Es multisitio. ADR-005 se aceptó en su alternativa 2: multicliente sí, multisitio no |
| `parking_spots` | por **debajo** de `estacionamiento` | admisible como modelo, pero **hoy no hay AC que lo pida**: agregarlo es autorar requisitos |
| `parking_sessions` | ya existe como `sesion_vehiculo` | **ya está.** No se renombra |
| journal / blog / `/map` `/reports` `/layouts` | — | **demo del starter, no producto.** Traerlas es autorar requisitos |

`npm run verificar:alcance` da **11/11 PASS** hoy. Ninguna de las decisiones de
este documento lo mueve; las dos filas «FUERA» existen precisamente para que no
se mueva.

**El modelo real de este repo son cuatro tablas** —`estacionamiento`, `usuario`,
`tarifa`, `sesion_vehiculo`— y `AC-DATA-1` exige que no haya ninguna más.

---

## 2. La traducción de infraestructura — el problema que la guía no tiene

La guía asume **una sola máquina con Docker Compose**: Next, Directus, Postgres y
Qdrant conviven, con puertos `18701`–`18708` y `pnpm dev` levantando todo. Este
repo no tiene esa forma y la decisión fue explícita: **Vercel se queda.**

### 2.1 · Directus no puede correr en Vercel, y esto es lo central

Directus 11 es un **servidor Node de larga vida con estado en disco**: subidas de
archivos, extensiones, y un proceso que no termina entre peticiones. Las
funciones de Vercel son **efímeras y sin sistema de archivos persistente**. No es
una limitación que se sortee con configuración.

**Traducción:** Directus va donde ya vive la base.

```
Navegador
   |
   +--> Next.js  (Vercel)          <- se queda, ADR-002
   |        |
   |        +--> Postgres (Railway)  <- ADR-003, ya existe
   |        +--> Qdrant  (servicio con estado)
   |
   +--> Directus (Railway)  --> Postgres (Railway), ESQUEMA PROPIO
```

**Costo que esto arrastra, y hay que decirlo:** ADR-003 ya asumió romper «un
proveedor, una factura» al mover la base a Railway. Esto lo profundiza: se pasa
de **un servicio desplegado a tres**, cada uno con su actualización y su
superficie de ataque. La guía no paga ese costo porque su Docker Compose local no
es un despliegue.

### 2.2 · Qdrant: mismo problema, misma solución

Servicio con estado en disco. No corre en Vercel. Va a Railway o a un Qdrant
gestionado.

### 2.3 · Lo que directamente **no traduce**

| De la guía | Por qué no |
|---|---|
| `pnpm dev` levantando el stack; `pnpm down` | **medido: no hay Docker ni pnpm en este entorno.** El repo usa npm 11 y Node 24 |
| Puertos `18701`–`18708` | son de desarrollo local con Compose. Acá no hay stack local |
| Worktrees paralelos con `--offset N` | presuponen contenedores por worktree. Sin Docker, no aplican |
| `pnpm install` / `packageManager: pnpm@10` | cambiar de gestor no aporta nada verificable y rompe todos los comandos de `spec.md` §9 |
| Node 20.9+ | este repo corre Node **24.19.0**. El piso de la guía es más bajo, no un requisito |

---

## 3. Directus contra `AC-DATA-1` — la frontera declarada

**Esto ya está resuelto en ADR-006 §2.3 y no se re-decide acá.** Se transcribe
porque es la condición de entrada:

1. Directus **con sus tablas en un esquema propio**, no en `public`.
2. `AC-DATA-1` hoy **solo mira `public`** (`verificar-esquema.mjs:25`,
   `WHERE table_schema = 'public'`). O sea que no vería a Directus **por un punto
   ciego, no porque la propiedad se conserve.** Usar ese punto ciego a propósito
   es el patrón que este repo persigue desde AC-SCOPE-1.
3. Por eso, **la adopción va acompañada o no va**: `AC-DATA-1` pasa a mirar
   **todos** los esquemas, y el esquema de la consola queda **declarado con su
   motivo**, igual que los verificadores huérfanos de `verificar-ac.mjs`.

> *Nadie está obligado a tener solo las cuatro tablas; todos están obligados a
> declarar qué agregan.*

### 3.1 · La medición que zanja esto SIGUE SIN CORRER

ADR-006 la nombra: levantar Directus contra un esquema propio **de una base de
descarte** y comprobar que no crea nada en `public`, y que
`npm run verificar:esquema` da `8/8`.

**No se pudo correr el 2026-08-20.** Medido: `docker` y `pnpm` **no están
instalados** en el entorno de desarrollo. Y correrla contra la base de Railway es
exactamente lo que ADR-006 evitó al pedir una base de descarte: **si Directus
ignorara el ajuste de esquema, el daño cae en producción**, que es el caso que se
está tratando de descartar.

**Por lo tanto la alternativa 1 de ADR-006 queda VIABLE-SIN-VERIFICAR.** No es
un rechazo y no es una aprobación. Lo que falta es un entorno con Docker o una
base descartable.

---

## 4. Qdrant — el problema que la guía no puede ver

La guía indexa *published posts*: contenido editorial, público por definición.
**Este producto no tiene contenido editorial.** Su corpus natural sería
`sesion_vehiculo`, y ahí aparece el choque:

> **La patente es dato personal** (`CLAUDE.md` §4, Ley 21.719, vigencia plena el
> 1 de diciembre de 2026). Indexarla en Qdrant la **replica en un segundo
> almacén, con su propia retención**, mientras `{{PLAZO_RETENCION_PATENTE}}` y
> `{{BASE_LICITUD}}` siguen sin resolver (INT-7, único hallazgo del informe
> integral sin cerrar).

**Regla, y no admite excepción por conveniencia:**

- **Qdrant no indexa `sesion_vehiculo`, ni `patente`, ni nada derivado de ellas.**
- Un *embedding* no es anonimización: es una representación del texto de origen.

### 4.1 · La pregunta abierta que decide si Qdrant entra ahora o después

Si el índice no puede contener sesiones ni patentes, **¿qué contiene?** Hoy, en
este repo, la respuesta honesta es **nada**: no hay corpus. Los candidatos
lícitos, todos por decidir y ninguno existente:

- documentación de ayuda para el operador (no personal, útil, hay que escribirla);
- texto de políticas y condiciones de tarifa (no personal);
- el propio `spec.md` / `LEDGER.md` como base de búsqueda interna (no es producto).

**Adoptar Qdrant hoy es desplegar infraestructura con el corpus vacío.** No es un
argumento en contra de la decisión tomada: es la secuencia. Primero el corpus,
después el índice.

### 4.2 · Lo que la guía aporta acá y sí se adopta tal cual

Dos ideas suyas son **disciplina de verificación**, no stack, y son buenas:

| Idea de la guía | Por qué encaja |
|---|---|
| *Seam* de embeddings con proveedor `local` determinista por defecto | el sistema corre **sin ninguna clave de API**. Es exactamente el criterio de `spec.md` sobre fixtures que se ven como fixtures |
| La firma del proveedor guardada junto al índice, y **409 explícito** si el índice y la consulta no coinciden | *falla ruidosamente en vez de devolver vacío en silencio*. Es la misma regla que hizo reescribir AC-SCOPE-1 y los `grep` con el pipe escapado: **un criterio que siempre pasa es peor que no tener criterio** |

---

## 5. Lo que la guía aporta y este repo NO tiene

Un solo ítem, y es real. **Medido: no existe ningún escáner de secretos en la
suite** (`verificar-ac.mjs` no lo tiene).

```
git grep -nE '/Users/|/home/|gh[opsu]_|sk-[A-Za-z0-9]|BEGIN (RSA |OPENSSH )?PRIVATE KEY'
```

El repositorio es **público** (`githubRepoVisibility: public`, devuelto por el MCP
de Vercel el 2026-08-20) y trata dato personal. Esto no toca el alcance, no
necesita ADR y es barato. **Es lo primero que debería entrar.**

---

## 6. Lo que este repo ya tiene, y la guía no mejora

No se adopta por adoptar. Estas piezas de la guía ya están resueltas acá, y mejor:

| La guía propone | Acá ya existe |
|---|---|
| JSON commiteado como fuente de verdad del esquema y los permisos | `spec.md` como fuente de verdad + Drizzle + `verificar:esquema` (AC-DATA-1) |
| Personas/políticas de Directus (`Internal User`, `Operations Chief`, `Configurator`) | tres roles —`operador`, `dueño`, `plataforma`— con **aislamiento verificado 12/12** por exclusión, y control negativo con dos clientes |
| *Validation is local-first, CI as secondary safety net* | ya es la práctica del repo; conviene **escribirla** en `spec.md` §9 |
| Solo `.env.example` commiteado | ya está: `.env*` en `.gitignore` |
| Skills de repo en `.agents/skills` | `.claude/commands/loop.md` + los agentes del concilio |

---

## 7. Los criterios que esta adopción EXIGE (spec.md §9)

Enunciados, **no implementados**. Ninguno se declara verificado.

| AC | Afirmación | Tipo |
|---|---|---|
| `AC-DATA-1` *(ampliado)* | el escaneo mira **todos** los esquemas, no solo `public`, y cada esquema extra está **declarado con su motivo** | universal |
| `AC-CONSOLA-1` | levantada la consola, **`public` sigue teniendo exactamente las cuatro tablas** de `spec.md` §4 | universal |
| `AC-VECTOR-1` | ningún punto del índice vectorial contiene una patente ni un campo derivado de `sesion_vehiculo` | universal |
| `AC-VECTOR-2` | si la firma del proveedor de *embeddings* no coincide con la del índice, la búsqueda responde **409**, nunca vacío | existencial |
| `AC-SECRET-1` | el árbol no contiene claves, tokens ni rutas absolutas de la máquina | universal |

Cada uno **debe probarse con el fallo plantado** antes de contar (`METAS.md` §7).

---

## 8. Secuencia (WIP = 1) y bloqueos

| Orden | Qué | Estado |
|---|---|---|
| 1 | `AC-SECRET-1` — el escáner de secretos | **desbloqueado.** No toca alcance ni necesita ADR |
| 2 | Adjudicar **ADR-006** con la decisión tomada (alternativa 1) | **decisión humana ya dada**; falta escribirla en el ADR |
| 3 | La medición de ADR-006 §2.3 (Directus en esquema propio) | **BLOQUEADA**: sin Docker y sin base de descarte (§3.1) |
| 4 | `AC-DATA-1` ampliado a todos los esquemas | depende de 3 |
| 5 | Directus desplegado en Railway | depende de 3 y 4 |
| 6 | Definir el **corpus** de Qdrant | **BLOQUEADA por decisión humana** (§4.1): hoy no hay corpus lícito |
| 7 | Qdrant + el *seam* de embeddings | depende de 6 |

**Placeholders que esto no resuelve y que siguen bloqueando el encendido:**
`{{PLAZO_RETENCION_PATENTE}}` y `{{BASE_LICITUD}}`. Un segundo almacén de datos
los hace **más** urgentes, no menos: hoy la retención hay que responderla para una
base; con Qdrant, para dos.
