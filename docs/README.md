# Mapa de la documentación

Este proyecto documenta **con evidencia de comando**, no con prosa. Si un
documento afirma un estado, en algún lado está la salida real que lo sostiene.

Este mapa existe para que no haya que abrirlos todos.

> *Acá decía «Son 23 archivos». Se quitó el número el 2026-08-15: eran 26 antes de
> esa sesión y 28 después. Es la misma regla que `spec.md` §9 aplica a los
> criterios de aceptación —**citar el comando, no el conteo**—, porque un número
> escrito a mano queda falso al día siguiente y nadie lo nota.*

---

## Por dónde empezar, según lo que necesites

### «Quiero entender qué es esto en 5 minutos»

→ [`../README.md`](../README.md)

Qué resuelve, cómo está construido, cómo correrlo y qué falta.

### «Voy a tocar el código»

Leé estos tres, **en este orden**:

| # | Archivo | Qué te da |
|---|---|---|
| 1 | [`../CLAUDE.md`](../CLAUDE.md) | **Las reglas que hacen que un cambio se rechace.** El gate de alcance, WIP=1, el entorno. Empezá acá o vas a perder trabajo |
| 2 | [`../spec.md`](../spec.md) | La fuente de verdad: alcance, modelo, flujo, criterios de aceptación |
| 3 | [`../STATE.md`](../STATE.md) | Dónde está todo **hoy**. Puntero corto, se sobrescribe |

> Ante conflicto entre `CLAUDE.md` y `spec.md`, **manda `spec.md`**.
> Ante conflicto entre `STATE.md` y `LEDGER.md`, **manda el ledger**.

### «Necesito entender el modelo de datos»

| Archivo | Qué contiene |
|---|---|
| [`data/inventario.md`](data/inventario.md) | Lo que existe **hoy** en código, campo por campo, con cita `archivo:línea`. Y las derivas código↔spec |
| [`data/MER.md`](data/MER.md) | Entidades, relaciones y cardinalidad. **Y qué se descartó, con su razón** |
| [`data/MR.md`](data/MR.md) | Tablas, dominios, normalización, y la desnormalización deliberada con su costo |
| [`data/casos-uso.md`](data/casos-uso.md) | Flujos numerados paso a paso, cada paso citado, y la traza caso ↔ historia. **Y los cinco huecos de traza**, incluido el peor: medir H1 no tiene actor |
| [`data/flujos.md`](data/flujos.md) | Tres diagramas: ciclo de vida de la sesión, outbox offline, descuadre |
| [`data/actores.md`](data/actores.md) | Quién usa el sistema, verificado. **Y el actor que falta:** quien aprovisiona un cliente |
| [`data/historias-usuario.md`](data/historias-usuario.md) | 10 historias de usuario derivadas de `spec.md` §5/§6; 2 fuera de alcance, a propósito |
| [`data/seleccion-prototipo.md`](data/seleccion-prototipo.md) | Qué se construye primero y por qué, contra tres ejes. **Y las siete descartadas, con su puntaje** |
| [`adr/ADR-005-modelo-de-tenant-y-panel-de-administracion.md`](adr/ADR-005-modelo-de-tenant-y-panel-de-administracion.md) | **PROPUESTO.** N clientes vs. multisitio — la pregunta que ADR-004 no adjudicó. **Y el hueco del gate de alcance, reproducido** |
| [`SPEC-005-panel-de-administracion.md`](SPEC-005-panel-de-administracion.md) | **PROPUESTO y bloqueado.** Qué habría que construir si se acepta ADR-005 |

**Dónde está lo bueno:** `MER.md` §5 (qué se rechazó y por qué), `MR.md` §4 (la
tarifa que no se registra y qué se rompe por eso), `flujos.md` §2 (la resolución
de conflictos asimétrica).

### «Quiero saber qué está construido y qué no»

→ [`data/matriz-trazabilidad.md`](data/matriz-trazabilidad.md)

Una fila por capacidad, con cuatro estados: especificado+construido+verificado,
construido sin verificar, especificado sin construir (deuda), y construido sin
especificar (huérfano). La columna *¿Verificado?* se pobló con **salida real de
comandos**, no con lectura.

Si vas a leer una sola sección: **§5, la fila de H1**. Es el hallazgo de fondo.

### «Por qué esto se decidió así»

| Archivo | Decisión |
|---|---|
| [`adr/ADR-003-base-de-datos-en-railway.md`](adr/ADR-003-base-de-datos-en-railway.md) | Postgres en Railway en vez de Neon, y qué se rompe con eso |
| [`adr/ADR-004-multisitio-y-suscripcion.md`](adr/ADR-004-multisitio-y-suscripcion.md) | **Aceptado parcialmente**: cobro de suscripción sí, multisitio no |
| [`../LEDGER.md`](../LEDGER.md) | **Append-only.** Toda decisión y verificación, con su comando y su salida |

`LEDGER.md` son ~2.900 líneas y es la verdad histórica del proyecto. No se lee
entero: se busca. Cada entrada lleva fecha, hito, criterio, comando y resultado.

### «Qué aprendió este proyecto»

→ [`../LEARNINGS.md`](../LEARNINGS.md)

Lecciones **generalizables**, no el relato. Con una regla propia: la lección que
no se vuelve mecanismo se repite, así que varias terminaron siendo un comando.

Las que más rinden:

- *Un verificador que se muere miente hacia el lado optimista.*
- *Un resultado se recalcula, no se recuerda* — y **recalcular sobre datos
  confiados no es verificar, es volver a creer con más pasos.**
- *Un criterio sobre el fuente no verifica el resultado* (el caso del CSS que
  daba verde mientras el navegador aplicaba otra cosa).
- *Ausente y corrupto no son lo mismo.*

### «Qué se revisó de seguridad»

| Archivo | Alcance |
|---|---|
| [`revision-seguridad-2026-08-09.md`](revision-seguridad-2026-08-09.md) | Primera revisión adversarial: 12 hallazgos |
| [`revision-integral-2026-08-09.md`](revision-integral-2026-08-09.md) | La que reemplaza a la anterior: 20+ hallazgos |

> **Estado:** todos los hallazgos de estos informes están **corregidos y
> desplegados** —producción da 30/30— salvo **INT-7** (mecanismo de retención de
> patente), que está bloqueado por dos decisiones humanas, e **INT-12**, cuya
> corrección funciona pero cuyo *gate* automático quedó registrado como FAIL.

### «Y el diseño visual»

| Archivo | Qué es |
|---|---|
| [`diseno-2026-08-12-traduccion.md`](diseno-2026-08-12-traduccion.md) | Las 14 maquetas traducidas a especificación verificable, con su veredicto de alcance |
| [`evaluacion-factory-2026-08-12.md`](evaluacion-factory-2026-08-12.md) | Evaluación por rol del proceso, y el avance real con denominador explícito |

La traducción **encontró tres defectos en el diseño de origen**, y conviene
conocerlos antes de construir esas pantallas: el simulador de tarifas contradice
el cálculo real del sistema, un tiempo de tecleo aparece como si estuviera
medido cuando es inventado, y el sistema de diseño trae dos dependencias de CDN
incompatibles con la política de seguridad.

---

## Cómo está organizado el repo

```
├── README.md                    ← puerta de entrada
├── CLAUDE.md                    ← reglas operativas: leer antes de tocar código
├── spec.md                      ← fuente de verdad del alcance y los criterios
├── STATE.md                     ← dónde está todo hoy (se sobrescribe)
├── LEDGER.md                    ← append-only: qué se hizo y con qué evidencia
├── LEARNINGS.md                 ← lecciones generalizables
│
├── docs/
│   ├── README.md                ← este mapa
│   ├── adr/                     ← decisiones de arquitectura
│   ├── data/                    ← modelo de datos y trazabilidad
│   ├── revision-*.md            ← revisiones de seguridad
│   └── diseno-*.md              ← traducción de la capa de diseño
│
├── src/
│   ├── app/                     ← pantallas y Route Handlers
│   ├── db/                      ← esquema Drizzle
│   ├── lib/                     ← dominio: tarificación, patente, tiempo, auth
│   └── proxy.ts                 ← CSP con nonce por petición
│
├── scripts/                     ← verificadores: casi tanto código como el producto
│   ├── verificar-*.mjs          ← uno por criterio
│   └── lib/                     ← utilidades compartidas
│
└── drizzle/                     ← migraciones generadas
```

---

## Las tres convenciones que explican todo lo demás

**1 · Nada se declara verificado sin un comando y su salida.**
Un docstring no es evidencia. `LEDGER.md` pega la salida real, incluidos los
FAIL. Cuando un número reportado dejó de reproducirse, se corrigió por escrito en
vez de editarlo en silencio.

**2 · Las lecciones se vuelven mecanismo o se repiten.**
Por eso hay guards que no verifican el producto sino el proceso: que los
verificadores no mueran en silencio, que las citas de la documentación resuelvan,
que ningún criterio se ate al nombre de una herramienta.

**3 · Los valores de negocio no se inventan.**
Los `{{placeholder}}` de `spec.md` §12 son decisiones humanas pendientes. Nunca
se rellenan con supuestos "razonables". Y los datos de prueba **se ven como datos
de prueba**: dominios `.invalid`, montos redondos, patentes con prefijo `FIXT`.
Hay un chequeo que falla si alguien intenta sembrar algo que parezca real.
