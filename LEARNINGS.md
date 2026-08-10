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
