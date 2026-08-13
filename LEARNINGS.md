# LEARNINGS.md

Qué funcionó, qué falló, qué cambiaría. Una entrada al cerrar cada hito.

---

## M0 — Bootstrap

**Qué funcionó**
- Escribir el gate de alcance en `CLAUDE.md` como tabla de prohibiciones con sus
  comandos de verificación al lado. Un gate en prosa se interpreta; un gate con
  `grep` se ejecuta.
- Versionar `spec.md` dentro del repo. Había llegado por chat y no existía en
  disco: sin eso, la "fuente de verdad" vivía solo en el contexto de la sesión.

**Qué falló**
- Asumí implícitamente que el entorno tenía toolchain. No lo tenía: ni Node ni
  Git. Verificar el entorno debió ser el primer comando, no un hallazgo al
  intentar avanzar.

**Qué cambiaría**
- Chequeo de entorno como paso 0 explícito de cualquier plan de construcción.
  Quedó incorporado en la instrucción del loop.

---

## M1 — Esquema + scaffold (DETENIDO, 5 de 6 criterios en PASS)

**Qué funcionó**

- Verificar AC-DATA-1 **contra la base desplegada** y no solo contra el SQL que
  genera Drizzle. Son dos cosas distintas y solo la segunda prueba algo real.
  De ahí salió `scripts/verificar-esquema.mjs`, que queda como herramienta.
- Identificar el proyecto de Railway **por coincidencia de credencial** en vez de
  por nombre. El dato humano ("se llama park") era incorrecto; el nombre real es
  `noble-comfort`. Contrastar contra un hecho verificable evitó trabajar sobre el
  proyecto equivocado, que con siete proyectos en la cuenta era un riesgo real.
- Hacer caso a `AGENTS.md` y leer `node_modules/next/dist/docs/` antes de
  escribir código. Next 16.3 es posterior a mi conocimiento base y trae
  `useOffline`; escribir de memoria habría producido código de una versión que
  ya no existe.

**Qué falló**

- **Sobrescribí `CLAUDE.md` con el scaffold.** Excluí `.gitignore` del movimiento
  de archivos pero no previ que `create-next-app` genera su propio `CLAUDE.md`.
  Perdí el documento del gate de alcance y hubo que reescribirlo. La lección no
  es "excluir CLAUDE.md" sino: antes de mover archivos con `-Force` sobre un
  directorio que ya tiene contenido, comparar las dos listas y excluir toda
  colisión, no solo la que uno recuerda.
- **Dos scripts de verificación rotos dieron falsos negativos.** Uno intentó
  decodificar como bytes un `.Content` que ya era string, y todos los chequeos
  informaron AUSENTE cuando las etiquetas estaban presentes. Un verificador con
  bug es peor que no verificar: produce evidencia falsa. Hay que mirar si la
  salida tiene la forma esperada antes de creerle el veredicto.
- **Asumí que Lighthouse seguía teniendo categoría PWA.** No la tiene desde
  hace varias versiones mayores. Gasté los tres intentos del BoundedLoop
  peleando con un `EPERM` de Windows cuando la comprobación decisiva —leer
  `default-config.js` del paquete— era instantánea y no lanzaba navegador.

**Qué cambiaría**

- Antes de gastar intentos en hacer funcionar una herramienta, **verificar que
  la herramienta pueda producir el resultado buscado**. Un diagnóstico barato
  primero, los reintentos después.
- Los criterios de aceptación que nombran una herramienta externa envejecen con
  ella. AC-PWA-1 quedó inverificable no por el código sino porque Lighthouse
  eliminó la categoría. Conviene que un AC describa **la propiedad a comprobar**
  y solo sugiera la herramienta, en vez de atarse a ella.
- El freno funcionó como debía: con 5 de 6 en PASS la tentación era cerrar M1
  igual. El BoundedLoop lo impidió, que es exactamente para lo que está.

---

## M2 — Rebanada del operador (CERRADO)

**Qué funcionó**

- **Generar el `id` de la sesión en el cliente**, antes de escribir en IndexedDB.
  Es lo que hace idempotente la sincronización: una reconexión inestable
  reintenta y el servidor descarta el duplicado en vez de crear sesiones
  fantasma. En offline-first esto no es un detalle, es la diferencia entre una
  cola confiable y una que ensucia la base cada vez que titila la señal.
- **Escribir a IndexedDB primero y a la red después.** El orden inverso funciona
  el 95% del tiempo y falla justo cuando importa.
- **Correr AC-MEAS-1 con una sesión cerrada real presente.** Sobre una tabla
  vacía la consulta da 0 y "pasa" sin probar nada. Un criterio que se satisface
  con la base vacía no es un criterio.
- Reutilizar el mecanismo CDP de AC-PWA-1 para AC-OP-1: la inversión de M1 se
  amortizó de inmediato, y la prueba corre con el navegador realmente offline.

**Qué falló**

- El build se rompió con `TS5097` por los imports con extensión `.ts` en las
  pruebas. El runner nativo de Node los exige; TypeScript los rechaza sin
  `allowImportingTsExtensions`. Dos herramientas del mismo ecosistema con
  criterios opuestos sobre la misma línea de código.
- Escribí `npm run sembrar` en la documentación del script antes de agregar el
  script a `package.json`. Documentar un comando que no existe es una forma
  barata de mentir.

**Qué cambiaría**

- Declarar las limitaciones en el ledger en el momento de tomarlas, no al final.
  La salida requiere conexión por una razón defendible —el monto debe salir de
  la tarifa vigente del servidor— pero si eso no queda escrito junto al PASS,
  dentro de un mes parece un olvido en vez de una decisión.
- Los fixtures con prefijo (`FIXT`) hicieron que la limpieza fuera acotada y
  segura. Vale la pena adoptarlo como convención desde el primer dato de prueba,
  no cuando ya hay que separarlos de los reales.

---

## M3 — Panel del dueño (CERRADO)

**Qué funcionó**

- Revalidar AC-OP-1 después de introducir auth, en vez de suponer que seguía
  pasando. Cambiar el flujo de entrada obliga a re-verificar lo que dependía de
  él; el criterio pasó de 10 a 11 comprobaciones.
- Verificar la separación de roles **en ambas direcciones**: que el operador no
  entre al panel y que el dueño no entre a la pantalla del operador. Probar una
  sola dirección deja pasar la mitad de los errores de autorización.
- No persistir la ocupación observada del descuadre. `spec.md` §6 lo pedía y
  además es lo correcto en minimización: es una comparación puntual, no un
  registro. El panel hace visible la diferencia sin registrarla como un hecho
  sobre una persona.

**Qué falló**

- La prueba e2e usó `sleep` fijos y falló dos veces seguidas por eso, no por el
  código: primero midiendo la base antes de que terminaran los cierres, después
  antes de que terminaran los ingresos. Dos intentos del BoundedLoop gastados en
  un defecto del verificador.

**Qué cambiaría**

- **Nunca dormir en una prueba de integración: esperar confirmación.** Un `sleep`
  convierte la prueba en una medición de latencia disfrazada de aserción, y falla
  de forma intermitente justo cuando más molesta.

---

## M4 — Deploy (CERRADO)

**Qué funcionó**

- Ir a los logs de runtime en vez de adivinar. El 500 en producción era
  indescifrable desde afuera; el log traía la causa exacta con el carácter
  invisible incluido.
- Reutilizar el verificador e2e apuntándolo a la URL de producción. Un
  verificador que acepta la URL por parámetro sirve igual en local y contra el
  deploy, sin escribir una segunda prueba.
- Hacer la barrera de cumplimiento **de código y no de documentación**. Una
  advertencia en el README depende de que alguien la lea; un 403 no.

**Qué falló**

- **Efectos de módulo que exigen secretos.** Construir el cliente de Postgres al
  evaluar el módulo rompió el build de Vercel, porque Next importa las rutas para
  recolectar configuración y ahí el secreto no existe. La inicialización perezosa
  no era una optimización: era corrección.
- **Peleé con la codificación de la consola en vez de sanear en la frontera.**
  PowerShell antepone un BOM al canalizar hacia un ejecutable nativo. Gasté dos
  intentos tratando de que la consola no lo hiciera. La solución correcta —
  normalizar el valor al leerlo— tomó un archivo de 30 líneas y protege de
  cualquier tooling futuro, no solo de PowerShell.
- Escribí "esto está con escapes `\uXXXX`" en un comentario mientras el archivo
  tenía los caracteres literales. El comentario describía la intención, no el
  código. Lo detecté inspeccionando los bytes, no leyendo el archivo.

**Qué cambiaría**

- Cuando un valor cruza una frontera de herramientas (consola → CLI → proveedor →
  runtime), asumir que llega sucio y sanearlo al entrar. Es más barato que
  diagnosticar un carácter invisible en un log de producción.
- Verificar los invariantes que un comentario afirma, sobre todo cuando el
  invariante es "acá no hay caracteres invisibles".

---

## Resumen del piloto

**v1 completa y desplegada: https://estacionamiento-three.vercel.app**

Cinco hitos, todos cerrados con evidencia de comando en `LEDGER.md`. Ningún
criterio se dio por cumplido por declaración.

Lo que más valor aportó al proceso, en orden:

1. **El BoundedLoop.** Detuvo M1 con 5 de 6 criterios en verde, y eso destapó que
   AC-PWA-1 era inverificable porque Lighthouse había eliminado la categoría PWA.
   Sin el freno, se habría cerrado el hito con un criterio falso.
2. **Exigir salida de comando real.** Tres veces la evidencia contradijo lo que
   parecía obvio: el proyecto no se llamaba `park`, el "token" no era un token, y
   el TCP proxy no existía.
3. **Verificar contra lo desplegado, no contra el artefacto intermedio.** El
   esquema contra la base viva, no contra el SQL generado; el e2e contra la URL
   de producción, no contra localhost.
4. **Las lecciones se acumularon.** El mecanismo CDP escrito para AC-PWA-1 sirvió
   después para AC-OP-1 y AC-MEAS-2 sin cambios.

Lo que queda es una decisión humana, no técnica: `{{BASE_LICITUD}}` y
`{{PLAZO_RETENCION_PATENTE}}`. Hasta entonces el sistema rechaza patentes reales
por diseño.

---

## M5 — Endurecimiento: lo que enseñó el concilio

Estas lecciones son del proceso y ya son definitivas, con independencia de cómo
cierre M-4.

**El concilio se pagó solo en su primera aplicación.** Antes de que el auditor
entregara, yo mismo hice una lectura adversarial del código de M-4 y encontré una
sola cosa: la pérdida de visibilidad offline. El auditor, con contexto fresco y
ejecutando sondas propias, encontró cuatro, y tres eran bloqueantes que yo no vi:
una condición de carrera que dejaba la pantalla en cero con autos en la base, un
`4xx` genérico que destruía ingresos offline válidos, y una aserción que había
quedado tautológica. Yo iba a correr la verificación y probablemente cerrar M-4.

La lección no es "el auditor es mejor". Es que **una segunda lectura con contexto
propio encuentra cosas que la primera no puede encontrar**, por buena que sea la
primera. La mía llegaba con el sesgo de haber orquestado la corrección y de
querer cerrar.

**El detalle que más vale de todo el veto: la aserción tautológica.** La prueba
modificada verificaba en Postgres una propiedad de una función que solo escribe
en IndexedDB. Pasaba siempre, incluso si la purga borraba el almacén entero. Una
prueba así es peor que ninguna: ocupa el lugar de la que hacía falta y da
confianza falsa. Regla que sale de acá: **cuando adaptes una prueba porque cambió
la semántica, comprobá que la prueba nueva todavía pueda fallar.** Rompé el código
a propósito y verificá que la prueba lo detecte.

**Error de proceso mío, y la regla que deja.** Lancé al auditor cuando vi aparecer
el archivo del verificador, sin la señal de cierre del implementador — que siguió
editando 19 minutos más. El auditor revisó un blanco móvil y, encima, encontró un
`next start` viejo sirviendo código anterior al build. Regla: **el auditor no
arranca hasta que el implementador entrega, y la entrega incluye un árbol quieto
y un servidor levantado sobre el build actual.** La presión por avanzar fue mía,
no del usuario: él pidió velocidad, yo salté el paso.

### Lecciones que deberían volverse mecanismo

El loop pide convertir la lección recurrente en un guard, porque la lección que
no se vuelve mecanismo se repite. Dos candidatas concretas:

1. **El driver de Postgres filtra la cadena de conexión en el mensaje de error.**
   Es la causa de la segunda rotación de credencial del proyecto (`A-2`). Rotar no
   lo arregla: mientras el driver imprima la URL, cualquier fallo de conexión es
   una fuga hacia los logs. Guard: envolver la creación del cliente y sanear el
   error antes de que salga.
2. **Un criterio de aceptación atado al nombre de una herramienta caduca cuando la
   herramienta cambia** (AC-PWA-1 y Lighthouse). Guard: que los AC describan la
   propiedad y solo sugieran la herramienta.

---

## 2026-08-10 · Endurecimiento integral: lo que enseñó corregir 23 hallazgos de una

### La corrección de un hallazgo puede abrir otro, y solo se ve verificando

Dos casos, los dos encontrados por el verificador y no por lectura:

1. El índice único de INT-15 —"un vehículo no puede estar dos veces adentro"— es
   obviamente correcto. Y convirtió el doble toque en "Confirmar", que es
   *justo lo que el índice existe para atajar*, en un 23505 → 503 → la cola local
   reintentando para siempre algo que la base nunca iba a aceptar. Una
   restricción nueva no solo prohíbe estado malo: **crea un camino de error nuevo
   que alguien tiene que atender.**
2. El `CHECK salida_posterior_a_entrada` hizo fallar `verificar-m4.mjs`, que
   cerraba con `now()` de Postgres una sesión cuya entrada la había puesto el
   reloj del servidor de la app. 33 ms de desfase entre dos máquinas alcanzaron.
   El CHECK tenía razón y el script estaba mal: **una invariante que compara dos
   columnas obliga a que las dos vengan del mismo reloj.**

Regla: después de agregar una restricción, buscar quién escribía sin ella.

### "Rechazar la entrada inválida" no siempre es la opción segura

El instinto ante `entradaAt` en el futuro era responder 400. Habría sido un
error: en este sistema un 400 es rechazo *definitivo* y borra el registro del
dispositivo, así que un teléfono con el reloj mal habría convertido cada ingreso
hecho sin red en un ingreso perdido. Se habría cambiado un 500 por pérdida de
datos y el hallazgo se habría "cerrado".

Lo que sirvió fue preguntar **qué hace el cliente con cada código** antes de
elegirlo. La solución terminó siendo corregir el desfase (el cliente manda su
"ahora" y el servidor deriva el error del reloj) en vez de juzgar el dato. Regla:
**en un sistema offline-first, el código de estado es parte del contrato de
retención de datos, no un detalle de presentación.**

### Una CSP con nonce obliga a revisar qué páginas son estáticas

`next build` decía `○ /login`: prerenderizada. Una página generada en el build no
tiene petición de la que sacar el nonce, así que sus scripts quedan sin nonce y
el navegador los bloquea — la pantalla se ve y el formulario no anda. No lo dijo
ningún error: lo dijo la tabla de rutas del build.

Hubo que partir `login/page.tsx` en servidor + cliente para poder declarar
`force-dynamic`. Regla: **al poner CSP con nonce en Next, leer la tabla de rutas
del build y volver dinámica toda página con interactividad.** Y verificar la
hidratación en un navegador real, no solo la cabecera: una CSP que rompe la app
no es una mejora.

Detalle que no estaba en la doc y costó encontrar: `'strict-dynamic'` anula el
`'self'` de `script-src` para los workers, así que sin `worker-src 'self'`
explícito el service worker no registra — y ahí se cae el offline-first entero.

### El saneo de errores tiene que mirar la cadena de causas

`ErrorBaseDatos.desde()` leía `error.code` del objeto que le llegaba. Drizzle
envuelve el error del driver en un `DrizzleQueryError`, así que el código quedaba
en `desconocido` y un 23505 era indistinguible de una caída de Railway. Peor: el
mensaje del envoltorio incluye la consulta **y sus parámetros**, y en esta base
los parámetros son patentes. Registrar ese mensaje habría metido dato personal en
los logs mientras se corregía el hallazgo de no meter credenciales en los logs.

Regla: **al sanear un error para loguearlo, recorrer `cause` hasta el fondo y
quedarse con el mensaje del más interno**, que es el del driver y no el del ORM.

### El guard que faltaba, ya construido

`LEARNINGS.md` anotaba como candidata a mecanismo: "envolver la creación del
cliente y sanear el error antes de que salga". Existe: `src/lib/errores.ts` +
`conBase()`. La lección se volvió mecanismo, que era el punto.

Queda otra sin mecanizar: **limpiar fixtures antes de cada verificador de
navegador**. Con el espejo local de M-4, las activas de una corrida anterior se
copian al dispositivo y hacen fallar aserciones que cuentan registros —
`verificar-op1` falló así, y no por el código. Hoy es disciplina escrita en
`STATE.md`; debería ser un paso del propio script.

---

## Instrumentación — el verificador que mentía hacia el lado optimista (2026-08-12)

### La lección

**Un verificador que se muere no reporta un FAIL: reporta de menos.** Y reporta
de menos hacia el lado optimista, que es la única dirección que importa.

`verificar-endurecimiento.mjs` abortaba con `SyntaxError: Unexpected end of JSON
input` al recibir un 500 con cuerpo vacío desde producción. Murió en la
comprobación 15 de 30. El LEDGER registró "10 FAIL" y ese número se leyó durante
dos días como el estado de producción. El estado real era **19 FAIL**. Lo que no
alcanzó a correr no aparece como FAIL: aparece como nada, y la ausencia se lee
como aprobación.

Peor: las nueve comprobaciones que nunca corrieron incluían las **más graves**
—que en la URL viva el dueño puede listar patentes y la API devuelve la fila
entera de cada sesión—. No es casualidad. El crash ocurrió porque producción
respondía mal; cuanto más rota está la cosa medida, antes se cae el medidor y
menos mide. **El sesgo de un verificador frágil apunta siempre a subestimar el
daño.**

Regla: **un cuerpo ilegible, un timeout o una excepción son un FAIL de esa
comprobación, nunca el fin de la corrida.** El script informa; morirse no es
informar.

### Corolario: el criterio que nadie verifica

El guard que se construyó para esta lección encontró, en su primera ejecución, un
segundo caso de la misma familia: **`verificar-esquema.mjs` no emitía veredicto.**
Volcaba el esquema por pantalla y salía con `exit=0` pasara lo que pasara. Cinco
entradas del LEDGER dicen "AC-DATA-1: PASS" apoyadas en ese script. Lo que había
detrás era un humano mirando un volcado y decidiendo que se veía bien.

Un criterio de aceptación cuyo verificador no puede fallar no está verificado.
Está ilustrado.

### El paso profesional: las dos lecciones se volvieron mecanismo

1. **`scripts/verificar-verificadores.mjs`** (`npm run verificar:verificadores`).
   Check estático sobre los diez verificadores: ninguno llama `.json()` crudo
   sobre una respuesta, y todos imprimen un veredicto final. Es meta-verificación
   —el medidor del medidor— y se justifica porque el modo de falla que cubre es
   silencioso por construcción.

2. **`scripts/lib/fixtures.mjs`** — `limpiarFixtures()` al inicio de los cinco
   verificadores de navegador. Cierra la deuda que este mismo archivo tenía
   anotada al pie como "queda sin mecanizar":

   > *"Hoy es disciplina escrita en `STATE.md`; debería ser un paso del propio
   > script."*

   Se cobró otra vez antes de cerrarse: `verificar-m4` dio 28/29 por sesiones de
   una corrida anterior. Dos FAIL falsos en tres días. **Un FAIL falso es más
   caro que ninguna prueba**, porque enseña a desconfiar del verificador —y la
   próxima vez que dé rojo de verdad, la primera reacción va a ser "debe ser el
   estado previo otra vez".

### Qué cambiaría

Anotar una lección en `LEARNINGS.md` como "queda sin mecanizar" es dejarla
programada para volver a cobrarse. Si en el momento de escribirla se sabe cuál es
el mecanismo, el mecanismo es parte del cierre del hallazgo, no del siguiente.

### Lo que este trabajo NO hizo

No levantó el gate. Producción sigue sirviendo el código sin endurecer y ahora se
sabe con precisión cuánto: **10/29**. Medir mejor no arregla nada — solo saca del
medio la excusa de no saber.

---

## M6 — La capa de presentación, y el verificador que no medía (2026-08-13)

### La lección del día: verificar la propiedad, no su forma

INT-12 exige una propiedad: **la versión del caché cambia entre deploys
distintos**. Tres redes distintas la dieron por cumplida y ninguna la medía:

- El `throw` en `next.config.ts` valida que la versión sea *sana*, no que *cambió*.
- El test de "dos deploys distintos" variaba solo el SHA — **asumía la
  conclusión**. Es el error más difícil de ver en una prueba: el caso que
  distingue las dos hipótesis es justo el que no está escrito.
- El verificador comprobaba *forma* (que no fuera `v1`, que no estuviera vacía) y
  no *cambio*. La única comprobación de la propiedad estaba detrás de un flag
  opcional, `--anterior=`, que sin pasarlo imprime una NOTA y sale 0.

Resultado: 6/6 PASS sobre un fix que **movía** el defecto en vez de cerrarlo, de
"versión vacía" a "versión válida pero constante". Mismo bug, mejor cara.

Regla: **cuando un criterio habla de un cambio entre dos estados, una sola
observación no puede verificarlo.** Si el verificador solo puede mirar un estado,
no está midiendo el criterio — está midiendo su apariencia.

### Corolario: un verificador opcional no es una red

`verificar-int12.mjs` no estaba en `package.json`, no aparecía en `LEDGER.md` ni
en `STATE.md`, y su comprobación central era un flag. Tres capas de opcionalidad
sobre la única cosa que importaba.

Un verificador que nadie va a correr, y que si lo corren sale 0 sin comprobar lo
que dice comprobar, no es una red: es documentación con `exit 0`.

### El concilio funcionó, y esta es la evidencia

Es la primera vez que el veto cambia el resultado. El implementador entregó una
corrección buena en casi todo —el fuzz de 102.937 entradas del auditor no
encontró una sola divergencia entre el módulo TS y la copia del worker— y aun así
el auditor encontró el bypass, **lo reprodujo en un sandbox aislado con tres
builds** y midió la purga en un navegador real.

Lo que hizo posible el hallazgo: el auditor no leyó la descripción del fix, leyó
el código y después lo ejecutó. Y encontró que la premisa del diseño ya era falsa
—el comentario decía "repo sin remoto conectado" y el remoto se había configurado
esa misma tarde—. **Un comentario que justifica un diseño es una afirmación sobre
el mundo, y el mundo cambia.**

### Mérito que conviene no perder: descartar la defensa falsa

El implementador había construido una segunda fuente de versión a partir de los
hashes de chunk `main-app-*` / `webpack-*`. Al probarla descubrió que este build
es Turbopack y esos nombres no existen: habría sido *un mecanismo que parece
defensa y nunca dispara* — exactamente la forma del bug que estaba corrigiendo.

La descartó y puso en su lugar una barrera que falla ruidosamente. **Borrar una
defensa que no funciona es mejor que dejarla**: la que no funciona además
tranquiliza.

### Presentación: el defecto estaba en una línea

`globals.css` era la plantilla por defecto de Next, terminada en
`font-family: Arial`. `layout.tsx` cargaba Geist por `next/font/google` desde M1.
La app venía descargando una tipografía y descartándola en la línea siguiente,
durante cinco días, mientras todos los AC daban verde.

Ningún criterio de aceptación miraba la presentación, así que la presentación no
existía. **Lo que no tiene criterio no se construye** — y en un proceso
spec-driven eso no es un accidente, es el diseño funcionando. El problema no fue
el proceso: fue que SPEC-004 se escribió el día 4 y no el día 1.

### La capa de presentación puede romper el endurecimiento

Primer intento de M6: un `style={{ boxShadow: "var(--shadow-glow)" }}` en el botón
de ingreso. La CSP de INT-2 no lleva `'unsafe-inline'` en `style-src`, así que fue
una **violación de CSP real** — 29/30, detectada por el verificador y no por
revisión.

Por eso AC-UI-4 —*"la CSP sigue en verde tras incorporar el sistema de diseño"*—
no es burocracia. Un estilo inline es la forma más natural de escribir CSS en
React y es exactamente lo que una CSS con nonce prohíbe.

### Qué cambiaría

Escribir el criterio de "cambia entre dos estados" **antes** que el fix, y con la
comparación obligatoria desde el principio. El flag `--anterior` opcional nació
como comodidad para la primera corrida y se quedó como agujero. Toda comodidad
que apaga una comprobación termina siendo la comprobación apagada.

---

## La revisión de código, y el patrón que atraviesa el día (2026-08-13)

Trece hallazgos independientes. Leídos juntos, nueve de ellos son **la misma
familia**: *el mecanismo existe, se ve correcto, y no está conectado a nada.*

| Hallazgo | Qué prometía | Qué hacía |
|---|---|---|
| CSS sin capa | tipografía por token | las utilidades de Tailwind no ganaban nunca |
| `sembrar` sin `--env-file` | fixtures configurables por `.env` | no leía una sola variable |
| `??` contra variables vacías | default razonable | sembraba nombre vacío y zona horaria inválida |
| `entero()` sustituyendo | tolerancia a errores | la configuración escrita nunca se aplicaba |
| emails a medio extraer | identidades configurables | cinco verificadores buscando la identidad vieja |
| `--anterior` opcional | detectar el cambio de versión | `exit 0` sin comprobar nada |
| comentario sobre las dos copias | comparación garantizada | ningún script la hacía |

Ninguno de los siete rompía una prueba. Todos daban verde.

### La regla

**Un mecanismo desconectado es peor que un mecanismo ausente**, porque el
ausente se nota y el desconectado tranquiliza. Y se desconectan casi siempre en
el mismo lugar: **la frontera entre lo que se escribió y lo que se ejecuta** —
el `package.json` que invoca el script, la capa donde cae la regla CSS, el flag
que decide si la comprobación corre.

El corolario práctico: **probar por la puerta de entrada real.** Todo esto
pasaba verde con `node scripts/…` directo y fallaba por `npm run …`, que es como
se corre de verdad. La regresión ahora se corre por los scripts de npm por eso, no
por prolijidad.

### El caso del CSS, que merece nombre propio

Una declaración sin `@layer` le gana a cualquier capa, sin importar la
especificidad. Tailwind pone sus utilidades en `@layer utilities`. Resultado: un
`p { font-size: … }` suelto en `globals.css` derrotaba a `text-xs` **en todos los
`<p>` del producto**, y `.cifra` derrotaba a los ajustes en el sitio de uso.

La mitad de las decisiones tipográficas de M6 no se aplicaba, y los cuatro
criterios de SPEC-004 daban PASS: AC-UI-1/2/3 miran el **fuente** y AC-UI-4 mira
la **CSP**. Ninguno miraba lo que el navegador realmente calcula.

Lección: **un criterio sobre el fuente no verifica el resultado.** Para CSS, la
propiedad hay que comprobarla en el artefacto compilado o en el estilo computado
del navegador. Verifiqué el orden de capas en la hoja que sirve el servidor —
`base` 5849 < `components` 10667 < `utilities` 11316— y no en el archivo que
escribí.

### El mismo `??` por tercera vez en dos días

INT-12 costó dos ciclos de concilio porque `""` no es nullish. `sembrar.mjs`
tenía el defecto idéntico contra variables que `.env.example` distribuye. Y
`env.ts` ya tenía la solución escrita desde M4 (`leerEnv`).

**Tener el helper no alcanza: hay que usarlo.** La próxima vez que aparezca
`process.env.X ??`, es un defecto hasta que se demuestre lo contrario.

Cambio de criterio que se deriva: un valor de configuración **ausente** toma el
default; un valor **presente pero inválido** falla. Sustituirlo en silencio hace
que la configuración escrita no se aplique y que las pruebas sigan pasando con
los valores viejos — que es exactamente cómo `FIXTURE_VALOR_HORA=100O` habría
seguido dando su `$1500` esperado.

### Media extracción es peor que ninguna

Los emails de fixture se hicieron configurables en dos de siete lugares. La
versión anterior —hardcodeada en todos— fallaba igual en todas partes, que es
diagnosticable. La versión a medias fallaba **solo en algunos**, que no lo es.

Regla: una extracción de constante se termina o no se empieza. Y se cierra con
un chequeo que impida la regresión, no con disciplina.

### Sobre el entorno, que costó dos diagnósticos falsos

Dos veces hoy un FAIL fue del `.next` corrupto y no del código: el servidor
servía los chunks como `text/plain` con 500 y el service worker no registraba.
El repo vive en OneDrive —advertencia del PASO 0— y los subagentes rebuildeaban
en paralelo.

Procedimiento, no intuición: **matar todo proceso `next`, borrar `.next`,
rebuildear, y recién entonces medir.** Y antes de creerle a un FAIL de navegador,
correrlo aislado: la contención entre instancias de Edge ya produjo tres falsos
positivos distintos en el proyecto.

---

## Tres ciclos de concilio sobre un solo hallazgo (2026-08-13)

INT-12 costó tres ciclos implementador↔auditor. Vale la pena porque los tres
vetos fueron a **lugares distintos del mismo error de fondo**, y el tercero
enseña algo que no sabía al empezar.

| Ciclo | Dónde estaba el defecto | Forma |
|---|---|---|
| 1 | el módulo | la versión salía del commit: constante entre deploys |
| 2 | el verificador | un booleano editable decidía el veredicto |
| 3 | el insumo del verificador | la huella derivaba de la versión: circular |

### La lección nueva: cuando la propiedad no se puede medir directo

El ciclo 3 pedía una señal de artefacto **independiente de la versión**. Lo
intenté por el camino obvio —hashear el contenido de los assets con la versión
enmascarada— y **medí que es imposible**: el minificador de Turbopack no es
determinista, así que dos builds del mismo fuente difieren en el renombrado de
variables. No hay huella de contenido estable de la que colgar el check.

Lo que salió de ahí no fue un mejor insumo sino un **mejor veredicto**: si el
insumo está acoplado a la versión, hay que preguntarse en qué dirección ese
acoplamiento importa. Resultó que en la que detecta el bypass **no importa**:
allí la versión es justamente la que no cambió, y el artefacto sí.

Regla: **cuando no se puede desacoplar el insumo, revisá si el acoplamiento
afecta la dirección que te interesa.** Muchas veces la respuesta es que no, y
seguir peleando por el insumo perfecto es perder el tiempo. Pero la respuesta hay
que *derivarla y escribirla*, no suponerla — el argumento queda expuesto en el
código para que el próximo auditor lo pueda atacar.

Corolario: **el intento fallido se registra.** "Probé X y no se puede, por Y" es
información con valor; borrarlo invita a que alguien lo reintente.

### Un booleano no es un gate

El veredicto estaba guardado en `transicionVerificada`. El auditor lo invirtió a
mano y obtuvo 12/12 PASS, sin deploy, sin rebuild, sin un cambio de código.

Ahora el veredicto se **deriva** en cada corrida de las observaciones. Falsificar
sigue siendo posible —es un archivo local— pero exige fabricar observaciones
consistentes en vez de invertir una palabra, y el veredicto se recalcula siempre.

Regla: **un resultado se recalcula, no se recuerda.** Lo que se guarda son
hechos observados; la conclusión se deriva de ellos en cada corrida. Una
conclusión persistida es una conclusión que ya nadie vuelve a comprobar.

### Ausente y corrupto no son lo mismo

`leerEstado()` se tragaba cualquier error de parseo y devolvía `{}`, que aguas
abajo era indistinguible de "primera corrida" — así que el archivo entero se
reescribía. Un BOM de PowerShell destruyó la línea base de producción ganada de
verdad.

Es el **mismo error que INT-12 en otro plano**: `""` no es `undefined`, y un
archivo ilegible no es un archivo que no existe. Tratar un fallo como un vacío
convierte un error ruidoso en un borrón silencioso.

Este proyecto lleva tres apariciones de esta familia en cuatro días: el BOM en
`DATABASE_URL` (M4), `""` en la versión del build (INT-12 ciclo 1), y ahora un
JSON ilegible tratado como inexistente. **Cuando un valor puede llegar
degenerado, el manejo por defecto tiene que ser ruidoso.**

### Lo que ya funciona y conviene no perder

El concilio pagó su costo. Tres vetos, tres defectos reales, ninguno detectado
por las pruebas ni por mí. Y el patrón del auditor es siempre el mismo: **no lee
la descripción, ejecuta**. Invirtió el booleano en vez de razonar sobre él;
reprodujo el BOM en vez de suponerlo; cruzó el estado persistido con el LEDGER en
vez de creerle al informe.

El costo también hay que decirlo: tres ciclos, dos subagentes colgados, y varias
mediciones corrompidas por rebuilds concurrentes. La disciplina que faltó de mi
lado fue de entorno, no de razonamiento: **un árbol de build es un recurso
exclusivo**, y medir mientras otro proceso construye no es medir.
