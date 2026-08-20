# ADR-006 — Consola de administración de datos (Directus u otra)

**Estado:** **PROPUESTO — pendiente de adjudicación.**
**Fecha del borrador:** 2026-08-20
**Decisor:** Cristóbal Herrera
**Enmienda propuesta a:** ADR-002 (criterio rector: un proveedor, lo más simple de
orquestar) y, según la alternativa que se elija, a `spec.md` §9 **AC-DATA-1**.

> **Este ADR no decide.** Se escribe porque la pregunta se hizo tres veces y la
> respuesta que se dio fue siempre el rechazo medido del 2026-08-19, que resolvía
> *una* alternativa —Directus en el esquema `public`— y dejaba las otras sin
> evaluar. Un rechazo de una alternativa no es una decisión sobre el problema.

---

## 1. El problema, dicho sin la herramienta adentro

**Hoy no hay forma de ver los datos del sistema sin una terminal.** Ni el modelo,
ni las filas, ni el estado de los roles. Quien quiera mirar necesita
`DATABASE_URL` y saber SQL.

Eso tiene tres consecuencias reales, no hipotéticas:

1. **El acto de mayor privilegio se ejerce por el camino menos auditable.** Lo
   mismo que SPEC-005 §1 dijo del alta de clientes: no queda registro de quién
   miró qué.
2. **No se puede delegar.** Cualquier revisión de datos exige a alguien con la
   credencial de la base.
3. **La necesidad no desaparece por rechazarla.** Se resuelve igual, peor, a mano.

---

## 2. Lo que ya está medido, y lo que quedó sin medir

### 2.1 · Medido el 2026-08-19 — Directus en el esquema `public` **rompe AC-DATA-1**

Reproducido con **dos** de sus ~25 tablas de sistema plantadas:

```
FAIL · AC-DATA-1 · están las cuatro tablas de spec.md §4, y ninguna más ·
       directus_collections, directus_permissions, estacionamiento,
       sesion_vehiculo, tarifa, usuario
7/8 comprobaciones PASS · exit=1
```

Borradas, vuelve a `8/8 · exit=0`. **Esto es un hecho y no está en discusión.**

### 2.2 · Lo que NO se midió, y es de lo que depende esta decisión

- **¿Directus puede vivir fuera de `public`?** Postgres tiene esquemas; Directus
  tiene configuración de conexión. Si sus tablas se pueden aislar en un esquema
  propio —o en **otra base**—, la premisa del rechazo cambia por completo.
  **No lo verifiqué. No lo doy por cierto ni por falso.**
- **¿Cuánto cuesta operarlo?** Un servicio más, con su despliegue, su
  actualización y su superficie de ataque.

### 2.3 · MEDIDO HOY, y cambia la forma de la decisión

**AC-DATA-1 solo mira el esquema `public`:**

```
scripts/verificar-esquema.mjs:25
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
```

Consecuencia directa: **Directus con sus tablas en un esquema propio NO haría
fallar AC-DATA-1.** El rechazo del 2026-08-19 midió la instalación por defecto
—en `public`— y esa medición sigue siendo válida para ese caso y solo para ése.

**Pero eso no es una aprobación, y la diferencia es el punto entero de este
párrafo:** el guard no lo vería porque **tiene un punto ciego**, no porque la
propiedad se conserve. Usar deliberadamente el punto ciego de un criterio es
exactamente el patrón que este repo persigue desde AC-SCOPE-1.

**Por eso, si se adopta la alternativa 1, va acompañada o no va:** `AC-DATA-1`
tiene que pasar a mirar **todos** los esquemas, y el esquema de la consola tiene
que quedar **declarado con su motivo** —igual que los verificadores huérfanos de
`verificar-ac.mjs` y que las restas de otro dominio de `scripts/lib/metrica.mjs`—.
La regla es la misma que este proyecto ya aplicó dos veces: *nadie está obligado
a tener solo las cuatro tablas; todos están obligados a declarar qué agregan.*

**La prueba que zanja la primera pregunta** sigue pendiente y ahora es más chica:
levantar Directus apuntando a un esquema propio de una base de descarte y
comprobar que **no crea nada en `public`**.

**La prueba que zanja las dos primeras, y que hay que correr antes de decidir:**
levantar Directus contra un esquema aparte de una base de descarte, y correr
`npm run verificar:esquema` contra ella. Si da `8/8`, la alternativa 1 es viable.
Si da FAIL, queda descartada con medición y no con argumento.

---

## 3. Alternativas

| # | Alternativa | ¿Rompe AC-DATA-1? | ¿Alcanza `patente`? | ¿Segunda autenticación? | Costo |
|---|---|---|---|---|---|
| **1** | **Directus con sus tablas en un esquema propio** | **no lo detectaría** — AC-DATA-1 solo mira `public` (§2.3). Exige ampliar el criterio y declarar el esquema | **sí**, por diseño | sí | servicio nuevo + despliegue |
| **2** | **Directus contra una base espejo de solo lectura** | no toca la base del producto | sí, sobre la copia | sí | servicio + replicación + desfase |
| **3** | **MCP de Postgres en solo lectura** | **no** — no instala nada | sí | **no** — usa la misma credencial | configuración; sin UI para no técnicos |
| **4** | **Pantalla propia de solo lectura dentro del producto** | no | **acotable por diseño** | **no** — la sesión que ya existe | trabajo de producto; queda auditada por los mismos comandos |
| **5** | **Consola de Railway / cliente SQL** *(estado actual)* | no | sí | la del proveedor | cero; exige saber SQL |

### Lo que distingue a la 4 de todas las demás

Las alternativas 1, 2, 3 y 5 **miran la base por fuera de las rutas**. Ninguna
pasa por las seis cláusulas de aislamiento, ni por `AC-ISO-2`, ni por la
transacción del alta. Son consolas de base de datos, y por eso ven `patente`
completa aunque el producto entero esté diseñado para que casi nadie la vea.

La 4 es la única en la que **la visibilidad queda bajo los criterios que ya
existen**: se le puede exigir que no muestre patentes, y un comando lo verifica.
Es también la más cara.

---

## 4. La pregunta que hay que responder, y no es «¿Directus sí o no?»

> **¿Quién necesita ver qué, y con qué registro de que lo vio?**

Tres respuestas posibles, y cada una elige sola su alternativa:

| Si la necesidad es… | Entonces |
|---|---|
| **que vos veas datos ocasionalmente** | alternativa **5** o **3**. No hace falta un servicio |
| **que alguien no técnico administre contenido** | alternativa **1** o **2**, y hay que resolver §2.2 antes |
| **que el producto muestre su propia operación** | alternativa **4**, y es trabajo de producto con su AC |

---

## 5. Consecuencias que la decisión arrastra

- **Ley 21.719.** Cualquier consola sobre la base alcanza `patente`, que es dato
  personal. Hoy el riesgo es bajo **solo porque `OPERACION_REAL_HABILITADA=false`
  y la base tiene fixtures**. Con operación real, una consola sin registro de
  acceso es tratamiento sin trazabilidad.
- **AC-ISO-2 se vuelve parcialmente decorativo.** El criterio dice que el rol de
  plataforma no obtiene patentes *por ninguna ruta*; una consola no es una ruta.
  Si se adopta, hay que decir explícitamente que el criterio cubre el producto y
  no la administración de la base.
- **Se rompe más el criterio rector de ADR-002.** Ya son dos proveedores; con
  Directus autoalojado son tres piezas que administrar.

---

## 6. Qué hace falta para cerrar este ADR

1. Correr la prueba de §2.2 y **pegar su salida**.
2. Responder la pregunta de §4.
3. Elegir alternativa y, si es la 1 o la 2, escribir cómo se registra el acceso.

**Mientras tanto no se construye ninguna**, y el estado actual —alternativa 5—
sigue siendo el vigente por omisión, con su limitación declarada: exige terminal
y no deja registro.
