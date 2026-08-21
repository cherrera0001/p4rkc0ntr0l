# PROMPT — Roles, casos de uso, permisos y navegación de ParkControl

**Fecha:** 2026-08-21 · **Estado:** listo para ejecutar · **Forma:** `/loop`, concilio, WIP = 1

---

## 0. Cómo se ordenó esta instrucción, y por qué en este orden

La instrucción original traía seis preguntas en el orden en que aparecen cuando
uno piensa en voz alta:

> ¿Cuántos roles existen? ¿Qué casos de uso? ¿Qué permisos y opciones de menú
> debería tener cada uno? ¿Qué skill sumar o mejorar? ¿Qué otros roles o agentes
> desplegar para que la plataforma sea robusta?

Ese orden no se puede ejecutar, porque cada respuesta depende de la anterior:
**no se decide un menú sin saber los permisos, ni los permisos sin los casos de
uso, ni los casos de uso sin saber cuántos roles hay de verdad.** Y las dos
últimas preguntas no son del producto sino del taller que lo construye, así que
van al final: qué agente falta se sabe recién cuando se ve qué hueco quedó.

Reordenado queda así, y este es el orden en que el loop tiene que trabajar:

| # | Pregunta | Depende de | Fuente que manda |
|---|---|---|---|
| P1 | ¿Cuántos roles existen hoy? | nada | el motor de la base |
| P2 | ¿Qué hace hoy cada rol? | P1 | el árbol de rutas |
| P3 | ¿Qué tiene permitido cada rol? | P2 | lo que la ruta hace cumplir |
| P4 | ¿Qué navegación le corresponde? | P3 | decisión de producto |
| P5 | ¿Qué roles faltan? | P3, P4 | H1 y H2, no la completitud |
| P6 | ¿Qué skill sumar o mejorar? | P1 a P5 | los huecos del trabajo |
| P7 | ¿Qué agentes desplegar? | P6 | los huecos del concilio |

**Regla de orden dura: no se abre una pregunta sin haber cerrado la anterior con
su evidencia.** Es el mismo WIP = 1 que gobierna los hitos.

---

## 1. Frenos, antes de tocar nada

1. `spec.md` es la fuente de verdad. Ante conflicto con `CLAUDE.md`, manda `spec.md`.
2. **Gate ADR-001** (`CLAUDE.md` §1): ni cobro del conductor, ni LPR, ni reservas,
   ni multisitio, ni barreras. ADR-004 abrió solo el cobro de suscripción y
   **dejó multisitio afuera**. Un rol nuevo que necesite multisitio para existir
   no se diseña acá: se detiene y se pide el ADR.
3. **Los `{{placeholder}}` no se rellenan.** Si una respuesta necesita
   `{{PLAZO_RETENCION_USUARIO}}` o `{{ACTOR_BAJA_USUARIO}}`, se declara el bloqueo
   y se sigue con lo que no depende de él.
4. **Ley 21.719.** La patente es dato personal. Cualquier rol nuevo se evalúa
   además por lo que **no** debe poder ver, no solo por lo que necesita.
5. **Voz del producto:** marca ParkControl, español de Chile con tuteo, sin em
   dash y sin la palabra «piloto» en texto visible. Exigible con
   `npm run verificar:tono`.
6. **U7:** toda afirmación sobre el repositorio se sostiene con un comando y su
   salida real pegada. Un número copiado del ledger y publicado como medido hoy
   ya costó un veto.

---

## 2. Objetivo único del loop

Producir **`docs/SPEC-006-roles-permisos-y-navegacion.md`**: la matriz de roles,
casos de uso, permisos y navegación de ParkControl, derivada del sistema real y
**acompañada de un verificador que falle cuando la matriz y el código
discrepen**.

No es un documento descriptivo. Un documento que describe permisos y no los
verifica es exactamente el patrón que este repositorio ya persiguió tres veces:
el mecanismo que existe, se ve correcto y no está conectado a nada.

---

## 3. Las preguntas, con su método de respuesta

### P1 · ¿Cuántos roles existen hoy?

Medir en **tres fuentes independientes** y reportar las tres:

1. el tipo `Rol` en `src/lib/sesion-token.ts`;
2. la restricción de la tabla `usuario` en `src/db/schema.ts` y su reflejo en
   `docs/MODELO-datos.md`, que se extrae del motor;
3. **el motor**: `SELECT rol, count(*) FROM usuario GROUP BY rol`.

Si las tres discrepan, **manda el motor**: el DDL dice lo que alguien quiso, el
motor dice lo que hay. Es la misma regla que ya aplica `verificar:esquema`.

**Trampa conocida:** `plataforma` no pertenece a ningún recinto y su
`estacionamiento_id` es nulo por invariante de base (`pertenencia_por_rol`).
Un rol no es solo un nombre: es un nombre más su pertenencia.

### P2 · ¿Qué hace hoy cada rol?

Derivar del **árbol de rutas** (`src/app/**`), no de `docs/data/casos-uso.md`.
Recién después contrastar contra ese documento y contra
`docs/data/historias-usuario.md`, y reportar cada diferencia como hallazgo: o el
documento quedó viejo, o hay una ruta que nadie especificó.

Para cada caso de uso: quién lo dispara, qué ruta lo sirve, qué exige
(`sesionActual`, rol, pertenencia), qué escribe y si funciona sin señal.
**La asimetría offline es parte de la respuesta:** el ingreso se registra sin
red, la salida no, porque el monto lo calcula el servidor con la tarifa vigente.

### P3 · ¿Qué tiene permitido cada rol?

Matriz **rol × recurso × operación**, derivada de lo que la ruta hace cumplir.

Advertencia que ya está escrita en el código y hay que respetar: `PERMISOS` en
`src/lib/roles.ts` es **descriptivo**, no autoritativo. Si la tabla y la ruta
discrepan, manda la ruta y la tabla está mal. La matriz nueva se deriva de las
rutas y del aislamiento por `estacionamiento_id`, y **usa `roles.ts` como
contraste, nunca como fuente**.

Tres propiedades a verificar por exclusión, no por enumeración:

- ninguna ruta de producto sirve datos de otro recinto (aislamiento);
- el rol `plataforma` no llega a una patente por ninguna ruta (AC-ISO-2);
- ninguna ruta nueva nace sin control por el solo hecho de tener un nombre que
  la lista blanca no previó. Una ruta llamada `api/resumen-diario/` evade
  cualquier enumeración escrita a mano, igual que `api/cobro-salida/` evadió al
  gate de alcance.

### P4 · ¿Qué navegación le corresponde a cada rol?

Punto de partida honesto: **hoy no hay menú.** Hay un destino por rol
(`DESTINO_POR_ROL` en `src/lib/roles.ts`) y navegación por enlaces dentro de cada
pantalla. La pregunta real es si eso alcanza, y para quién no alcanza.

Reglas para responderla:

- **Esconder un botón no es negar un permiso.** Ya está dicho en `roles.ts` y no
  se negocia: si un rol llega a una pantalla ajena, el servidor lo redirige.
  La navegación es comodidad; la autorización es la ruta.
- El operador registra de pie y con una mano. Cada opción de menú que se le
  agregue compite con H1. **La carga de la prueba la tiene quien quiera agregar
  una opción**, no quien quiera dejarla afuera.
- Toda opción propuesta se justifica contra H1 o H2. Si no responde a ninguna de
  las dos, no entra, aunque la maqueta la muestre.

### P5 · ¿Qué roles faltan para que la plataforma sea robusta?

Candidatos a evaluar, **cada uno con su veredicto y su motivo escrito**, no una
lista de deseos:

| Candidato | Qué resolvería | Qué hay que responder antes |
|---|---|---|
| Soporte / mesa de ayuda | entrar a mirar sin poder tocar | ¿ve patentes? Si sí, choca con la minimización |
| Encargado de datos personales | Ley 21.719: retención, borrado, respuesta al titular | bloqueado por `{{PLAZO_RETENCION_PATENTE}}` y `{{BASE_LICITUD}}` |
| Supervisor de turno | cerrar el turno, firmar el descuadre | ¿es un rol o es una pantalla del dueño? |
| Administrativo / contable | exportar para contabilidad | exportar CSV es exfiltración si incluye patente |

Y el que ya está a medio nacer y hay que decidir: **`usuario.estado`
(activo / suspendido)**. Sin estado no se puede dar de baja a un operador, porque
la clave de acceso es compartida y la llave de `sesion_vehiculo.operador_id`
impide borrar la fila. Pero agregar la columna **rompe AC-DATA-1**, que compara
los 27 campos ni de más ni de menos. Por lo tanto: **no se implementa en este
loop**; se redacta la enmienda y se pide la decisión.

### P6 · ¿Qué skill sumar o mejorar?

Evaluar contra los huecos que aparezcan en P1 a P5, no contra un catálogo.
Punto de partida propuesto, para confirmar o descartar con argumento:

- **Mejorar `/loop`**, no reemplazarlo. Hoy su ciclo es *implementar, auditar,
  verificar, aprender, cerrar*. Le falta un paso previo explícito de
  **derivación**: para trabajo de matriz (permisos, roles, contratos) el primer
  entregable no es un diff sino una tabla derivada del sistema, y hoy el
  protocolo no tiene lugar donde ponerla.
- **`/goal` no existe en este repositorio.** Sólo existe `.claude/commands/loop.md`.
  Crear un segundo comando que también ordene el trabajo abre dos protocolos que
  se contradicen el día que uno quede viejo, que es justamente el defecto que
  `/loop` documenta en su propio encabezado. Recomendación: **una sola puerta,
  `/loop`, con este archivo como entrada.** Si se quiere `/goal`, que sea un alias
  que lea el mismo protocolo, nunca una copia.

### P7 · ¿Qué agentes desplegar?

El concilio tiene hoy nueve definiciones en `.claude/agents/`: árbitro, auditor
adversarial, expertos de API, backend, frontend, QA y seguridad, implementador y
verificador. Dos huecos, para confirmar dentro del loop:

- **Nadie representa al usuario que paga ni al que opera.** Los siete expertos
  auditan el sistema; ninguno pregunta si la pantalla sirve para el trabajo real
  del turno. Candidato: `experto-producto`, con veto sobre alcance de pantalla,
  no sobre código.
- **La Ley 21.719 está repartida** entre seguridad y backend, y así ninguno la
  tiene entera. Candidato: `experto-datos-personales`, dueño de minimización,
  retención y del límite de lo que cada rol puede ver.

Cada agente propuesto entra sólo si se puede decir **qué veto tiene y qué no**.
Un agente sin veto definido es una opinión más en la mesa.

---

## 4. Lo que este loop NO decide

- Multisitio, planes, cobro del conductor: gate ADR-001.
- Alta de usuarios desde el producto y recuperación de clave: hoy la credencial
  es compartida, así que no hay nada que recuperar. Cambiarlo es un ADR.
- Implementar pantallas nuevas. **El entregable es matriz más verificador.**
  Construir lo que la matriz proponga es un hito aparte, con su propio WIP.

---

## 5. Entregables, y cómo se cierra

1. `docs/SPEC-006-roles-permisos-y-navegacion.md` con las siete respuestas y las
   citas `archivo:línea` que `npm run verificar:citas` pueda resolver.
2. **`scripts/verificar-permisos.mjs`**, registrado en `package.json` como
   `verificar:permisos` por el mismo trabajo. Todavía no existe, y por eso acá no
   se escribe como comando corrible: `verificar:citas` rechaza un documento que
   cite un `npm run` inexistente, y tiene razón. Es la matriz hecha comando, por
   exclusión: descubre la superficie del árbol y falla si una ruta de producto no
   declara su rol y su cláusula de aislamiento.
3. **El verificador probado con el fallo plantado**, como `verificar:alcance:prueba`.
   Un criterio que nunca se vio en rojo no es evidencia.
4. El verificador **citado por un AC en `spec.md` §9** o **declarado como soltado
   con su motivo** en `scripts/verificar-ac.mjs`. Un huérfano no declarado es FAIL.
5. `LEDGER.md` (append-only, con salida real), `STATE.md`, `LEARNINGS.md`.

**Verde exigido al cerrar:** `npm test`, `verificar:ac`, `verificar:citas`,
`verificar:verificadores`, `verificar:alcance`, `verificar:tono`,
`verificar:aislamiento`, `verificar:permisos`, más `build` y `lint`.

---

## 6. Reparto del concilio

| Turno | Agente | Entrega | Veto |
|---|---|---|---|
| 1 | `experto-backend` | P1 medido contra el motor | sí, sobre el modelo |
| 2 | `experto-api` | P2 y P3 desde las rutas reales | sí, sobre el contrato |
| 3 | `experto-seguridad` | aislamiento y AC-ISO-2 por exclusión | terminal |
| 4 | `experto-frontend` | P4, y qué opción compite con H1 | sí, sobre la pantalla |
| 5 | `experto-qa` | qué criterio pasa sobre el conjunto vacío | terminal sobre la suite |
| 6 | `arbitro-tecnico` | adjudica P5, P6 y P7 con condición de reversión | decide, no implementa |
| 7 | `implementador` | el verificador y su fallo plantado | no cierra su trabajo |
| 8 | `auditor-adversarial` | intenta romperlo leyendo el código | terminal, la duda es veto |
| 9 | `verificador` | regresión completa, salida real pegada | PASS solo si todo verde |

**BoundedLoop de 3 ciclos.** Al tercero sin PASA se registra FAIL y se detiene el
hito. No hay cuarto intento.

---

## 7. Cómo se ejecuta

```
/loop docs/PROMPT-ROLES-PERMISOS-Y-NAVEGACION.md
```

El comando lee el estado de `STATE.md` y `LEDGER.md`, no de este archivo. Si al
arrancar hay un hito abierto, **este trabajo espera**: WIP = 1 no admite
excepciones por interés.
