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

---

## El BoundedLoop se agotó, y lo que enseña (2026-08-13)

INT-12 terminó en **FAIL** tras tres ciclos. Las tres lecciones son mejores que
un cierre.

### 1. Un veredicto derivado no vale más que su insumo

El ciclo 2 falló porque el veredicto se leía de un booleano editable. El ciclo 3
lo reemplazó por un veredicto **derivado** de observaciones. El auditor forjó dos
observaciones a mano y obtuvo 13/13 PASS, con el verificador afirmando *"cada
deploy renombra el caché"* sobre versiones que ningún build produjo.

La lección que yo creía haber aprendido —*"un resultado se recalcula, no se
recuerda"*— era **media lección**. La otra mitad: **recalcular sobre datos
confiados no es verificar, es volver a creer con más pasos.** Pasar de un
booleano a dos objetos coherentes no cambió la raíz de confianza; cambió la
cantidad de tipeo.

La regla completa: un gate necesita que sus insumos sean **re-derivables desde
la cosa medida**, no recordados sobre ella. La salida que el auditor propuso lo
ilustra: guardar la URL inmutable del deployment y volver a medirla en cada
corrida. Una entrada forjada no re-deriva.

### 2. Escribí una invariante y la violé yo, en la misma sesión

El script promete tres veces que *"las observaciones nunca se borran"* y que
*"la evidencia de una violación no puede evaporarse"*. Yo borré el archivo con
`Remove-Item` varias veces esa misma tarde — porque **mis propios controles
negativos exigen un historial vacío para poder correrse**.

Eso no es descuido: es un defecto de diseño que el uso destapó. Un almacén
append-only cuyo procedimiento de prueba requiere borrarlo no es append-only. Y
como está gitignoreado, borrarlo no deja rastro en ningún diff.

Regla: **si para probar el mecanismo hay que violar su invariante, la invariante
está mal planteada o falta un modo de prueba que no la viole.**

### 3. Reporté un número verde que el comando ya no devolvía

Dije `int12 13/13` en local. Era cierto cuando lo medí. Después borré el
historial para los controles negativos y seguí citando la medición vieja como
estado actual. Hoy el comando devuelve `12/13, exit=1`.

Es exactamente el defecto que este proyecto viene persiguiendo desde el
2026-08-12 —el verificador que reportaba 10 FAIL donde había 19— aplicado a mí:
**una medición es válida para el estado en que se tomó, y el estado cambió entre
la medición y el reporte.**

Regla operativa: **antes de reportar un número, volvé a correr el comando.** No
alcanza con que haya sido verde; tiene que ser verde ahora. Y si entre medio se
tocó el estado del que depende, la medición vieja no vale nada.

### 4. Cuándo detenerse

La regla del BoundedLoop existe para esto y funcionó. Tres ciclos, tres
hallazgos reales, y una señal clara: el problema dejó de estar en el hallazgo y
pasó a estar en la herramienta que lo mide.

Vale distinguir dos cosas que es cómodo confundir:

- **La corrección está bien y observada en producción.** Dos deploys del mismo
  commit dieron versiones distintas, leído del navegador.
- **El gate no es confiable**, así que INT-12 no se puede declarar *verificado*.

Registrar eso separado —"la propiedad se cumple, pero no tengo con qué seguir
comprobándolo"— es más honesto que cerrar el hallazgo por la evidencia puntual, y
más útil que declararlo roto.

---

## El generador de evidencia cayó en los modos de falla que vigilaba (2026-08-14)

Escribí `scripts/evidencia.mjs` para que los bloques de evidencia dejaran de
tecleárse y desfasarse. Su docstring prometía tres propiedades, todas contra el
mismo enemigo: *resolver la duda hacia el lado optimista.* Un auditor lo vetó con
**nueve hallazgos reproducidos**. El resumen incómodo: el generador producía
`EVIDENCIA: PASS` con exit 0 sobre verificadores que habían salido exit 1
imprimiendo FAIL.

### La lección de fondo: la herramienta que reporta sobre la verificación es ella misma un verificador

No es una utilidad de formato. Produce el texto que otros van a leer **como
evidencia**, así que hereda entera la responsabilidad de un verificador y todos
sus modos de falla. La escribí tratándola como plomería —parsear, formatear,
escribir— y por eso no le apliqué ninguna de las reglas que el proyecto ya tenía
para los verificadores.

La prueba de que la trataba como otra cosa: quedó **fuera de todos los guards**.
`verificar-verificadores.mjs` filtraba `startsWith("verificar-")` y no la veía;
`verificar-ac.mjs` filtraba `startsWith("verificar:")` y no la contaba ni como
huérfana; ningún AC la citaba. **El nombre del archivo decidió su cobertura.**

Regla: **si un artefacto produce texto que alguien va a leer como evidencia, va
bajo los mismos guards que un verificador — y la pertenencia no se decide por el
prefijo del nombre.**

### Cuando dos señales del mismo hecho discrepan, la falla es resolver

El hallazgo más caro fue este: un script imprimía `FAIL` y salía con exit 1, y el
generador lo reportaba PASS. Había tres bugs distintos habilitándolo, pero
ninguno habría importado con la regla que faltaba:

> **Un exit≠0 no puede rendir veredicto PASS.**

Lo tentador es resolver la contradicción hacia algún lado —"el exit code es más
confiable", "el texto es más específico"—. Las dos opciones están mal. La
contradicción **es** el hallazgo: se marca `CONTRADICTORIO` y hace fallar. Un
verificador comprometido, o simplemente roto, necesita exactamente que
resolvamos la duda por él.

Generalizable más allá de este script: **dos señales independientes del mismo
hecho que discrepan no se promedian ni se jerarquizan; se reportan como
discrepancia.**

### Tres formas de que "la última línea" no sea la última

Los tres bugs que habilitaban el PASS falso valen por separado, porque los tres
son de familias que reaparecen:

1. **`stdout + "\n" + stderr` destruye el orden cronológico.** El veredicto real
   iba en stdout y una línea posterior de stderr ganaba por orden de
   concatenación. *Concatenar dos flujos no los ordena: los apila.*
2. **Un regex que admite espacios iniciales convierte un detalle en veredicto.**
   Una línea indentada terminada en `: PASS` matcheaba entera. *Anclar a columna
   0 no es cosmético cuando la columna 0 es lo que distingue un título de un
   detalle.*
3. **`maxBuffer` desbordado devuelve salida truncada, y la cola truncada parsea
   bien.** `r.error` de `spawnSync` no se inspeccionaba. *Truncada no es
   evidencia: si el comando no se ejecutó completo, la salida se descarta entera,
   no se parsea el pedazo que llegó.*

### `?? ""` volvió a convertir un fallo en una afirmación positiva

Cuarta vez en este proyecto. `git status --porcelain` con git ausente del PATH
devolvía `undefined`, el `?? ""` lo hacía cadena vacía, y `length > 0` daba
`false` → el bloque estampaba **"árbol limpio"** sobre un repo realmente sucio.

Lo que hace a este caso peor que los anteriores: no degradaba a "no sé", degradaba
a una **afirmación positiva y falsa**. Regla, ya en su cuarta encarnación:
**procedencia desconocida no es procedencia limpia.** Un valor por defecto que
coincide con el caso feliz es un valor por defecto mal elegido.

### Un criterio insatisfacible se termina apagando

Pedí que el bloque de evidencia comiteado correspondiera **a HEAD**. El
implementador lo construyó, mostró que es insatisfacible en régimen —regenerar
ensucia el árbol, commitear mueve HEAD, así que el bloque recién comiteado ya
estampa el commit anterior— y propuso una versión satisfacible que detecta lo que
importa: que el **código** no haya cambiado desde que se midió.

Tenía razón, y la lección es de diseño de criterios, no de este chequeo:
**un criterio que no puede estar verde en operación normal no se cumple: se
desactiva.** Y un criterio desactivado es peor que ninguno, porque figura.

---

## Mecanizar una parte crea la ilusión de haber mecanizado el todo (2026-08-14)

El commit que introdujo `npm run evidencia` para que los conteos dejaran de
tecleárse **dejó `27/27` tecleado en §7 del mismo archivo**, mientras el bloque
generado 215 líneas más arriba decía `37/37`. Un documento contradiciéndose
consigo mismo, en el commit cuyo mensaje explica que eso no puede pasar.

Y en el mismo día, la misma familia en la fuente de verdad: `spec.md` tenía
`8/8` **dentro del párrafo que argumenta que un criterio debe citar el comando y
no el número.** Hoy son 15/15.

La lección no es "faltó revisar". Es que **el mecanismo cubrió el ejemplo que
motivó el mecanismo**, y todos —yo incluido— leímos eso como si cubriera la
clase. Regla: **cuando mecanices algo, buscá los otros lugares donde vive el
mismo defecto antes de dar la lección por aprendida.** El generador reescribe
entre marcadores; §2, §3, §4 y §7 nunca estuvieron entre marcadores.

### El corolario que sí es barato

Donde no llega el mecanismo, **la cita al comando reemplaza al número**: las
celdas ahora dicen `→ ver §0`. No es tan bueno como generar, y es infinitamente
mejor que un número que envejece solo.

---

## Cuando dos cifras del mismo hecho conviven, la que no tiene comando está mal (2026-08-14)

`STATE.md` y la matriz decían **"9 huérfanos y 6 verificadores sin AC"**. El 6 lo
imprime `verificar:ac`. El 9 se contó a mano. Era 8: `f98a652` había creado
`AC-DATA-2` exactamente para las invariantes de base, que la tabla seguía
listando como huérfanas con la justificación *"AC-DATA-1 verifica presencia y
forma, no invariantes"* — cierta hasta ese commit.

Lo que lo vuelve una lección y no un descuido: **las dos cifras salían del mismo
comando.** `verificar:invariantes` no aparece en la lista de 6 precisamente
porque ya tiene AC. La contradicción estaba disponible, gratis, en la salida que
el propio documento cita.

Heurística: **si dos números describen el mismo conjunto y solo uno es
reproducible, el otro se corrige — no se defiende.** Y el costo de no hacerlo era
concreto: FASE C iba a arrancar con un ítem de alcance ya cerrado.

### Un grep por la etiqueta que yo mismo puse no prueba ausencia

Afirmé que FASE A no estaba en el ledger con `grep "FASE A"`. La conclusión era
correcta, el método no: buscaba **el nombre que yo le había dado al trabajo**. El
auditor la confirmó bien, buscando por **artefactos** —`verificar-alcance`,
`27 campos`, `SUPERFICIE`, `fallo plantado`— que existen independientemente de
cómo alguien haya decidido titular la entrada.

Regla: **para probar que algo no está registrado, buscá los artefactos, no las
etiquetas.** Las etiquetas las elige quien escribe; los artefactos no.

---

## Un criterio que pasa sobre el conjunto vacío no puede refutar nada (2026-08-14)

`AC-MEAS-1` exige que toda sesión cerrada tenga los dos timestamps de tecleo. Da
PASS. La base tiene cero sesiones de operación real, y el proyecto entero existe
para probar o refutar H1, que se mide con esos timestamps.

Verificado en el código, no razonado: los dos únicos `exit(1)` de
`verificar-meas1.mjs` son `nulos !== 0` —un `count(*)` sobre un `WHERE`, que
sobre tabla vacía da 0— y `obligatorias !== 2`, que se lee de
`information_schema` y **no depende de las filas**. Demostrado además con un
`DELETE` dentro de una transacción revertida: con la tabla vacía imprime
`AC-MEAS-1: PASS`.

Es más fuerte de lo que parecía: **`meas1` no puede fallar por ausencia de
datos.** Su primera guarda es vacuamente verdadera sobre el conjunto vacío y la
segunda es una propiedad del catálogo.

La lección general: **un criterio universal ("todo X cumple P") es
automáticamente verdadero si no hay ningún X.** Cuando lo que importa es que
existan X —y acá importa: X es la evidencia de H1— el criterio universal no
alcanza y hace falta uno existencial que devuelva **un número**, no un PASS.

Es el salto que separa verificar **propiedades del artefacto** —¿compila?,
¿existe el campo?, ¿el navegador computa 12px?— de verificar **propiedades del
propósito**: que el sistema produzca la evidencia por la que existe.

---

## Limpiar al iniciar no es limpiar al terminar (2026-08-14)

La matriz explicaba que H1 no acumula datos porque *"cada verificador de
navegador llama `limpiarFixtures()` al iniciar, así que toda tanda termina en
cero"*. Dos errores en una frase: son **5 de 8**, y "termina en cero" confunde el
momento. Limpian **al iniciar**: cada tanda borra lo de la anterior y deja lo
suyo. La base tiene 3 filas ahora mismo, y `verificar:meas1` lo imprime.

La conclusión de fondo sobrevivió —ninguna corrida acumula— pero el modelo
mecánico era falso, y **FASE D dice construir "un banco que acumula en vez de
purgar"**: iba a partir de un modelo del purgado que no es el que corre.

Regla: **una conclusión correcta sostenida por un mecanismo mal descrito es
deuda, no verdad.** Sobrevive hasta que alguien construye sobre el mecanismo.

---

## El patrón meta-gate: dos BoundedLoops agotados, la misma causa (2026-08-14)

INT-12 y el gate de evidencia son los **únicos dos hallazgos que agotaron sus tres
ciclos** en la historia del proyecto. No se parecen en el dominio —uno es
invalidación de caché de un service worker, el otro un bloque de markdown— y caen
por lo mismo.

**Los dos verifican la verificación misma. Los dos se caen por falsificabilidad.**

- INT-12: el historial de artefactos se puede **inventar y borrar**. Dos objetos
  JSON a mano daban 13/13 PASS sobre versiones que nunca existieron.
- Evidencia: el bloque se puede **forjar en las filas que la corrida no mide**. 11
  líneas editadas a mano y el gate dice `EVIDENCIA: PASS`.

La generalización, que es lo que hay que llevarse:

> **Un artefacto que *afirma* el resultado de una verificación se puede reescribir.
> Protegerlo exige una raíz de confianza que el propio artefacto no puede
> proveer.** Cada vuelta de tuerca mueve la falsificación un nivel más arriba en
> vez de eliminarla: del booleano al historial JSON, del historial al sello de
> commit, del sello a las filas que nadie compara.

### El corolario práctico, que no es "no lo hagas"

Los dos meta-gates **entregaron valor real antes de agotarse**, y confundir eso
con el fracaso sería el error caro. El generador hoy: el bloque se genera en vez
de tecleárse, `NO CORRIDO` no se lee como PASS, un exit≠0 no puede rendir PASS, lo
truncado se descarta en vez de parsearse. Nada de eso depende de que el bloque sea
infalsificable.

Regla de asignación: **separá "el mecanismo hace lo que promete en uso honesto" de
"el mecanismo resiste a alguien que lo quiere engañar".** Lo primero se cierra y
rinde. Lo segundo, en un meta-gate, es un pozo: exige una raíz de confianza
externa, y si no la hay, se acepta como riesgo **por escrito** y se sigue. Que es
lo que se hizo con INT-12 y lo que se recomendó acá.

### Y un límite honesto del BoundedLoop

La regla dice tres ciclos y detener. Funcionó las dos veces, y las dos veces el
tercer veto dejó una salida **chica y concreta** sobre la mesa. La tentación de
hacer "una excepción, esta vez sí" es exactamente lo que la regla existe para
impedir: si el criterio para reabrir es *"me parece que falta poco"*, no hay
criterio. **El costo de detener es visible; el de no detener, no** — y por eso
solo el primero se siente caro.

---

## Deriva a WIP=2, y por qué la disciplina se rompe donde uno se siente cómodo (2026-08-14)

Corrí **dos implementadores en paralelo** —H9 del gate y el verificador del
temporizador— más un auditor. Eso es WIP=2 con la regla de WIP=1 escrita en
`CLAUDE.md` §2, en un repo cuyo ledger ya registra que **los rebuilds concurrentes
corrompen mediciones**.

Nadie lo detectó por un guard: lo detectó una persona leyendo. Y las consecuencias
fueron reales aunque ninguna llegó a producir un dato falso:

- un agente **mató y reinició el servidor** de otro para poder plantar su control
  negativo;
- `verificar:verificadores` quedó en **38/39** por un archivo a medio escribir, y
  yo reporté ese rojo como estado del repo cuando era un artefacto de la
  concurrencia;
- el auditor del gate encontró en su `git status` **dos archivos que no eran de
  nadie de los que él conocía**, y tuvo que declararlo como incertidumbre.

**Por qué se rompió acá:** no en el código de producto, donde WIP=1 se siente
obvio, sino en la **orquestación**, donde paralelizar se siente gratis porque los
agentes "no se pisan los archivos". Se pisan el **estado compartido**: el
servidor, la base, el árbol de git, y el reloj.

Regla: **WIP=1 aplica a los agentes, no solo a los hitos.** Dos agentes que
escriben en el mismo repo son dos hitos abiertos, aunque toquen archivos
distintos. Y el corolario que casi me cuesta una medición: **no se mide con un
agente escribiendo** — leer un archivo a medio escribir produce un número que
después se cita.

### El regalo que traía el orden

Serializar tuvo un premio que paralelizar no daba: al aterrizar el gate primero,
el árbol quedó con un **desfase orgánico real** —los bloques comiteados publicaban
`verificar:verificadores 33/33` cuando hoy mide 39/39— y eso fue **mejor control
negativo que cualquier fallo plantado**, porque nadie lo diseñó para ser cazado.
El gate lo cazó por contenido y salió exit 1.

**Un control negativo que ocurre solo vale más que uno construido**, porque no
puede estar hecho a medida de la comprobación que lo va a mirar.

---

## Un criterio universal no puede refutar nada sobre el conjunto vacío (2026-08-16)

Es la lección de fondo de FASE D, y explica por qué el proyecto pudo pasar meses
en verde sin una sola medición de la hipótesis por la que existe.

`AC-MEAS-1` dice *«toda sesión cerrada tiene ambos timestamps de tecleo»*. Sus dos
guardas son un `count(*)` sobre un `WHERE` (`scripts/verificar-meas1.mjs:53`) y una
lectura de `information_schema` (`:57`). **Con cero filas, la primera es vacuamente
verdadera y la segunda ni siquiera mira las filas.** Sobre la base vacía imprime
`AC-MEAS-1: PASS`.

No es un descuido de quien lo escribió: **«todo X cumple P» es lógicamente
verdadero si no hay ningún X.** El criterio hacía exactamente lo que decía.

> **Cuando lo que importa es que *existan* X, el criterio tiene que ser
> existencial, y su salida no es un PASS: es un número.**

`AC-H1-1` no pregunta si los datos que hay están completos: pregunta **cuántos
hay**, y falla si no hay ninguno. Por eso el bloque de evidencia dejó de estar todo
en verde, y por eso ese FAIL es el entregable y no una regresión.

### Tres corolarios que costaron un veto cada uno

**Publicar un número exige publicar su `n` — y «por disciplina» no alcanza.**
Afirmé que era «imposible por construcción» y era falso: la mediana circulaba
suelta en cuatro lugares. La propiedad que quedó es más chica y verdadera: hay un
solo camino de código que imprime una mediana, y ese camino imprime la fila
completa. *El defecto grave no es tener la propiedad a medias: es declararla
cumplida.*

**Un instrumento no puede afirmar lo que no puede observar.** La procedencia de
una fila no está en la base: un `INSERT` con duraciones a mano entra al banco y da
PASS, y ninguna columna lo arreglaría. El instrumento pasó de decir *«una persona
tecleando»* a declarar el límite en su salida. **Declarar la limitación es más
fuerte que fingir la garantía**, porque lo segundo se cae con un comando.

**Un guard que enumera deja agujeros; uno que absuelve por vecindario, también.**
El control del banco se escribió enumerando dos archivos y dio PASS mientras el
banco moría —había tres borrados más—. Reescrito por exclusión, seguía absolviendo
un borrado peligroso **por lo que tenía al lado**, porque leía 400 caracteres hacia
adelante. La pregunta correcta no es *¿hay algo cerca que parezca una prueba?* sino
*¿este borrado prueba que no toca el banco?* — y la prueba tiene que estar **en ese
borrado**.

### Y el que se repite en este repo hasta que se mecanice

**Un número copiado se republica como si se hubiera medido.** El script decía «5 de
los 8 verificadores»; medido, eran **6 de 9**. Salía de `STATE.md`, correcto cuando
se escribió y viejo desde que entró un verificador nuevo. El claim vivía en siete
lugares.

Es el mismo defecto del `21/21` publicado como *«medido hoy»* y del `6,2 s` de las
maquetas. La regla operativa que este repo ya nombró **U7** —*medí, y después buscá
todas las ocurrencias de lo que acabás de refutar*— es la única defensa que
funcionó, y hay que aplicarla al `grep` del **claim**, no del dato.

## 2026-08-18 · Idempotencia: el caso simultáneo no la prueba; el diferido sí

Un criterio de «se cierra una sola vez» que solo dispara una ráfaga **simultánea**
no prueba idempotencia. Todos los intentos caen en la misma fracción de tiempo,
así que un valor recalculado contra el reloj de *ahora* coincide por casualidad.
El caso que separa lo idempotente de lo que solo lo parece es un segundo intento
**diferido**, cuando el reloj ya cruzó el borde. **Generalizable:** todo criterio
de idempotencia necesita un segundo intento separado en el tiempo, no solo N
intentos a la vez. Se volvió guard: `verificar:concurrencia` agrega un cierre
diferido y compara monto+hora contra el original.

## 2026-08-18 · Un fixture que el producto necesita para operar es semilla, no basura de verificador

`verificar-aislamiento` borraba el usuario de plataforma al terminar, por miedo a
«una cuenta de alta viva en una URL pública». Pero sin ese usuario, un deploy
limpio no puede dar de alta el primer cliente: la funcionalidad central queda
inalcanzable. El error era tratar el síntoma equivocado — operador y dueño viven
en la misma URL con la misma clave compartida; el riesgo real es la clave, no la
existencia de la cuenta. **Generalizable:** antes de borrar un fixture «por
seguridad», preguntá si el producto lo necesita para operar. Si sí, es semilla
(va en `sembrar.mjs`), y el riesgo hay que atacarlo donde está (la clave
compartida, aceptada), no borrando lo que hace falta.

## 2026-08-18 · Un error de frontera debe nombrar exactamente el campo que falló

El 409 del alta nombraba los dos emails cuando chocaba uno, y el formulario
pintaba `aria-invalid` en ambos: el operador corregía también el campo bueno.
**Generalizable:** un error con `campos` tiene que nombrar solo lo que de verdad
falló, o la UI castiga al campo correcto y manda a corregir lo que estaba bien.
Si el dato para discriminar no está en la excepción (el 23505 no dice cuál), se
consulta antes; la consulta previa no es atómica, así que el `catch` queda como
red de la carrera.

## 2026-08-19 · Sustituir una lista por otra lista no es escanear por exclusión

Corregí `AC-ISO-2` para que dejara de enumerar **dos rutas** y pasara a escanear
la superficie de plataforma. Lo escribí citando la lección de AC-SCOPE-1. Y lo
que hice fue cambiar *una lista de rutas* por *una lista de dos directorios*:

```js
const SUPERFICIE_PLATAFORMA = ["src/app/plataforma", "src/app/api/plataforma"];
```

El auditor lo rompió en vivo, con la fuga reproducida y el guard en 12/12 verde:
un helper en `src/lib/` —fuera de los dos directorios— más una ruta cuyo `GET`
devuelve `{ok:true}` limpio y cuyo **`POST`** reparte todas las patentes. Tres
huecos, uno por pieza: el escaneo estático no sigue imports, el barrido dinámico
solo hacía GET, y la superficie era una enumeración disfrazada.

**La lección generalizable, que es la que cuesta:** *«por exclusión»* no es una
propiedad del texto que uno escribe, es una propiedad de **qué se recorre**. La
pregunta que la distingue no es «¿enumeré rutas o carpetas?» sino **«¿qué hecho
del código define la superficie?»**. Acá el hecho no es la ubicación del archivo:
es **declarar `rol: "plataforma"`**. Un archivo con ese rol en cualquier carpeta
es superficie; uno sin él, en `src/app/plataforma/`, no lo es. Descubrir por la
propiedad y no por la ruta es lo único que cierra el hueco.

**Corolario que ya se pagó dos veces en este repo:** citar la lección correcta no
protege de repetirla. La cité en el comentario del propio código que la violaba.

## 2026-08-19 · Un 201 puede mentir: verificar el efecto, no el código de estado

`verificar:tarifas` probado con el fallo plantado: la ruta respondía **HTTP 201**
sin insertar nada. Cuatro comprobaciones fallaron igual, porque miran el
**histórico en la base** —creció o no creció— y no la respuesta.

Un verificador que hubiera afirmado *«PASS · la ruta responde 201»* habría dado
verde sobre una ruta que no hace nada. El código de estado es lo que el servidor
**dice**; el efecto es lo que **hizo**.

## 2026-08-19 · Una superficie nueva rompe el piso de otro verificador, y eso es la señal

`POST /api/tarifas` exige rol `dueño`. `verificar:frontera` tenía sesiones de
`operador` y `plataforma`, así que la ruta respondía 401 en el 100% de sus casos
y **su piso lo delató**: 4/5, *«ninguna quedó en 401/403 el 100%»*.

El descubrimiento de rutas por exclusión funcionó —la ruta entró sola—, pero
descubrirla no es probarla: sin una sesión que atraviese la puerta, se prueba la
puerta y no la validación. **Toda ruta nueva con un rol nuevo trae consigo la
obligación de una sesión nueva en `verificar:frontera`.** El piso ya lo hace
cumplir; conviene saberlo antes de que falle.

## 2026-08-19 · Las pestañas comparten el frasco de cookies

Un verificador con dos roles en el mismo navegador: entrar como operador pisó la
sesión del dueño, y el `POST` siguiente devolvió 401 sobre un permiso que sí
existía. Media hora buscando un defecto de autorización que era del instrumento.

**Un contexto de navegador por rol** (`browser.createBrowserContext()`), o el
verificador mide el orden de sus propios logins en vez de medir el producto.

## 2026-08-19 · Un corpus más grande no es más cobertura si la sonda no llega

Agregué cuatro fechas fuera de rango al corpus de `verificar:frontera` para
cubrir un 503 real. Después medí con el fallo plantado —cota de rango quitada
del producto— y el verificador siguió dando **5/5 PASS**.

La causa no era el corpus: es **la forma de la sonda**. Manda el mismo valor
degenerado en *todos* los campos a la vez, así que `validarPatente` rechaza con
400 y **todo lo que está aguas abajo de la primera guarda queda sin ejercitar**.
Un corpus de N valores sobre M campos parece cobertura de N×M y es cobertura de
*la primera validación que rechaza*.

**La lección:** antes de declarar que un caso está cubierto, hay que comprobar
que la sonda **alcanza el código** que lo trata. Agregar el valor es barato;
llegar hasta él puede exigir rediseñar la sonda —acá exigiría mandar un cuerpo
válido con un solo campo degenerado, y eso crea filas reales en cada petición—.

**El corolario que se aplicó:** cuando la sonda de caja negra no llega, la
propiedad se prueba donde sí se puede — la guarda se movió a `src/lib/frontera.ts`
y se probó con `npm test`, determinista y sin servidor. Falla con la cota quitada
(3 pruebas en rojo, medido). *Consolidar la guarda donde vive el resto de la
frontera no fue estética: fue lo que la volvió verificable.*

## 2026-08-19 · Tres verificadores de navegador fallan en lote y pasan aislados

Medido hoy, tres veces, en tres scripts distintos:

| Verificador | En lote | Aislado |
|---|---|---|
| `verificar:temporizador` | 10/14 | 14/14 |
| `verificar:op1` | 10/12 | 12/12 |
| `verificar:m4` | 28/29 | 29/29 |

Cada uno falló en aserciones distintas, y ninguna correspondía a un defecto del
código que se acababa de tocar. Corridos solos, los tres pasan.

**No es "flakiness" a secas: es que los verificadores de navegador no están
aislados entre sí.** Comparten la base, el servidor y el estado que dejan las
corridas anteriores, y varios leen instantes cerca de un cruce de minuto.

**Por qué importa más de lo que parece:** un rojo que es ruido enseña a
desconfiar del verificador, y un verificador del que se desconfía deja de
detener un hito. Este repo ya escribió esa lección para los fixtures —*«un FAIL
falso enseña a desconfiar del verificador, que es peor que no tenerlo»*
(`scripts/lib/fixtures.mjs`)— y hoy se repitió en otra forma: no por datos
previos, sino por **contención entre corridas**.

Queda **sin corregir y declarado**: la corrección no es un `Start-Sleep` más
largo, es decidir si la suite de navegador corre en serie con una barrera
explícita entre scripts, o si cada uno se aísla de verdad. Es una decisión de
diseño de la suite, no un ajuste.

---

## 2026-08-20 · Un guard que lee texto tiene que decidir qué texto NO cuenta

Dos guards rotos el mismo día, con la misma forma: **comparar dos formas
distintas del mismo texto y creer que son la misma comparación.**

1. `scripts/lib/metrica.mjs` normalizaba la clave de búsqueda y **no** las claves
   del `Map`. `has()` no acertaba nunca. El síntoma es reconocible y conviene
   nombrarlo: **dos comprobaciones contradiciéndose sobre el mismo hecho** —la
   misma resta «sin declarar» y a la vez «declarada que sobra»—. Cuando eso pasa,
   el defecto no está en ninguna de las dos: está en lo que ambas usan.
2. `scripts/verificar-h1.mjs` buscaba `["'`]FIXTB` sobre el fuente **crudo**, y el
   backtick de un JSDoc contó como comilla de literal. Los dos archivos acusados
   de invadir el espacio de nombres del banco lo hacían en **comentarios que
   explican que no lo invaden**.

**La lección generalizable, que es la segunda:** un guard que escanea texto tiene
que declarar qué texto no cuenta. Si no lo hace, **documentar la regla se vuelve
una forma de violarla** — y el incentivo que crea es borrar la explicación, que
es exactamente lo contrario de lo que este repo intenta.

El mecanismo ya existía en el mismo archivo, dos funciones más arriba, con su
motivo escrito. Estaba **inline y sin extraer**, así que el segundo escaneo no lo
heredó. Es *media extracción es peor que ninguna* otra vez, en su versión más
barata de evitar.

### Y el hallazgo de proceso, que vale más que las dos correcciones

`verificar:metrica` **ya estaba** en el `CATALOGO` de `evidencia.mjs:147`.
`verificar:reportes` **ya estaba** declarado soltado en `verificar-ac.mjs:290`.
**El mecanismo que habría detectado MET-1 el mismo día en que nació existía y no
se corrió:** el bloque de regresión del ledger del 19 se tecleó a mano y lista 22
verificadores sin `metrica`.

No hace falta un guard nuevo: hace falta que **el bloque de regresión del ledger
sea la salida de `npm run evidencia`** y no un texto que alguien escribe. *Una
regresión que no se corre no existe* — y una que se transcribe a mano tampoco,
porque la mano elige qué copiar.

---

## 2026-08-20 · Una app offline-first pinta dos veces, y la sonda tiene que saber cuál mira

TMP-1 estuvo dos días anotado como *«defecto real, preexistente»* del producto.
No lo era. La sonda leía el **primer pintado** —el que sale de la base local— y
lo comparaba contra un `entrada_at` que se había retrasado **por SQL, a espaldas
de la app**.

**La lección general, que vale para cualquier verificador de una app
offline-first:** la pantalla se pinta dos veces por diseño —primero con lo que el
dispositivo sabe, después con lo que el servidor dice—, y **una aserción tiene que
declarar sobre cuál de las dos habla**. Si no lo declara, mide una carrera.

`networkidle2` **no** es esa señal: se cumple antes de que el cliente hidrate y
dispare su fetch. Esperar a que aparezca el primer `<li>` tampoco: ese `li` es
exactamente la evidencia de que el dispositivo respondió sin la red.

### El síntoma que lo delata, y conviene saber reconocerlo

**Dos comprobaciones del mismo hecho discrepando dentro de la misma corrida.**
Acá: *«el transcurrido es el que implica entrada_at»* fallaba y *«el temporizador
avanza solo»* pasaba con el valor exacto, sobre las mismas dos filas. Cuando eso
aparece, el defecto no está en ninguna de las dos: está en lo que las separa —y
lo que las separaba era el tiempo de espera.

Es la misma forma que MET-1a había mostrado horas antes, con las dos
comprobaciones que se contradecían sobre la misma resta. **Dos veces el mismo día,
y las dos veces el defecto estaba en el instrumento.**

### Y el corolario que ordena la prioridad del proyecto

De los dos «defectos de producto» que quedaban abiertos esta noche, **los dos
resultaron ser de las sondas**: el 503 de frontera no reproduce, y el `0 min` del
temporizador era una lectura en vuelo. *Un instrumento que reporta defectos
inexistentes cuesta lo mismo que uno que los oculta:* las dos veces se trabaja
sobre algo que no es.

**Esperar una señal determinista no ablanda una aserción.** Lo que la ablandaría
es comparar contra menos, o contra otra cosa. Acá se siguió comparando con
igualdad exacta contra `entrada_at` — y se probó plantando `+7 min` en el
producto, que hizo caer seis comprobaciones.

---

## 2026-08-20 (noche) — una prueba puede fijar el defecto como contrato

`identificarCliente` tenía dos pruebas y las dos pasaban. Una se llamaba **«toma
la primera IP de `x-forwarded-for`»**, y eso era exactamente la vulnerabilidad:
un proxy *agrega al final*, así que ese primer elemento lo escribe quien pide.

La prueba no falló al descubrirse el hallazgo. **No podía**: describía fielmente
lo que el código hacía. Cobertura verde sobre una decisión equivocada. Es la
misma familia que el `true` escrito a mano de AC-OP-1 y que los `grep` con el
pipe escapado, pero peor de detectar, porque acá no hay nada sintácticamente
sospechoso: hay una prueba honesta de una regla mala.

**La pregunta que las hubiera cazado no es «¿pasa?» sino «¿quién escribe este
valor?».** Para toda entrada que venga de la red: si la puede escribir el
cliente, ninguna prueba de que se lee bien significa nada.

## Encender infraestructura no crea defectos: los activa

SEG-2 estaba anotado como pendiente desde antes, con la corrección ya redactada.
Lo que cambió el 2026-08-20 no fue el código sino que la nube naranja puso un
proxy delante, y con eso un hallazgo *teórico* pasó a explotable en producción
sin que nadie tocara un archivo.

**El inventario de pendientes tiene fecha de vencimiento variable.** Un cambio de
despliegue puede reordenar la prioridad de la lista entera sin aparecer en ningún
diff. Al encender algo, hay que releer los pendientes preguntando cuál acaba de
cambiar de estado — no seguir el orden previo.

## Un MCP conectado no es un MCP que puede

`cloudflare-api` figura **✔ Connected** y contesta lecturas sin error. Escribir
da `9109` en zona, `10000` en DNS, y `/user/tokens/verify` da `1000: Invalid API
Token`. El grant OAuth alcanza para leer y no para escribir.

Es la misma distinción que INT-12: *declarado* ≠ *verificado*, ahora aplicada a
las herramientas. **La capacidad se mide intentando la operación**, no leyendo el
estado de conexión. Y conviene medirla con una sonda barata y reversible —acá,
crear un TXT `_prueba-permiso` y borrarlo— antes de planificar sobre ella.

## 2026-08-20 (noche) — la tercera vez que el defecto estaba en el instrumento

Medí el camino directo, conté **16 «instancias»** sobre `x-vercel-id`, concluí
que el limitador no acumula porque el estado vive por instancia, y **lo escribí
en el ledger y en METAS.md como hallazgo**. Después corrí el mismo verificador
contra la URL viva: **26 «instancias», y cortó igual**. Si la métrica midiera lo
que yo decía, eso era imposible.

`x-vercel-id` lleva un identificador de **petición**. Nunca fue una métrica de
instancias; yo la leí como si lo fuera porque encajaba con la hipótesis que ya
tenía —y que además estaba escrita en `METAS.md` como limitación conocida, lo que
la hacía sonar confirmada antes de medirla.

**La regla que sale, y es más específica que «desconfiá del instrumento»:** una
cabecera de la plataforma no es una métrica del programa. Si necesito saber algo
del proceso que atendió —qué instancia, qué versión, qué memoria— **la señal la
tiene que emitir la app**, no yo reinterpretando un identificador opaco del
proveedor. Un valor opaco confirma cualquier hipótesis que uno le lleve.

Y el corolario incómodo: esto pasó **después** de escribir dos veces la lección
de M-2 y TMP-1. Saber el modo de falla no protege de cometerlo. Lo único que lo
cazó fue **correr el mismo instrumento contra un caso donde el resultado esperado
era distinto** — que es barato, y no lo hice hasta que fue casi tarde.
