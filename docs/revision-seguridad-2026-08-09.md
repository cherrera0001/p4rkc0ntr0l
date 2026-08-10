# Revisión de seguridad — v1 piloto

**Fecha:** 2026-08-09
**Alcance:** todo el código de la v1 (`src/`, `scripts/`), no un diff. El repo
tiene `git init` sin commits.
**Modo:** solo lectura. **No se modificó código.**
**Contexto:** app pública en `https://estacionamiento-three.vercel.app` con la
base productiva de Railway detrás. La patente es dato personal bajo la
Ley 21.719.

> Nota de método: el skill `security-review` no pudo ejecutarse porque asume
> commits y un remoto `origin`, que este repo no tiene. La revisión se hizo
> leyendo los archivos, no desde memoria de haberlos escrito.

---

## Resumen

| Severidad | Hallazgos |
|---|---|
| Crítica | 1 |
| Alta | 3 |
| Media | 4 |
| Baja | 4 |

Nada de esto es explotable hoy por un tercero sin la clave de acceso. El riesgo
real se concentra en: **(a)** la clave compartida es la única barrera y no tiene
freno de fuerza bruta, y **(b)** la barrera de datos personales es solo del lado
del servidor, así que una patente real puede quedar guardada en el dispositivo
aunque el servidor la rechace.

---

## CRÍTICA

### C-1 · Login sin límite de intentos

**Ubicación:** `src/app/api/login/route.ts`

No hay throttling, bloqueo temporal, retardo progresivo ni CAPTCHA. La app es
pública y `CLAVE_ACCESO` es una clave **compartida** que protege todo el sistema:
quien la adivine entra como operador o como dueña indistintamente, y desde ahí
lee todas las patentes registradas.

La clave actual son 20 caracteres alfanuméricos, lo que hace la fuerza bruta
impracticable **hoy**. Pero el control no existe: si en algún momento se cambia
por algo memorizable —que es la tentación natural cuando la usa una persona en
un celular— el sistema queda sin defensa. Un atacante puede probar sin costo ni
señal.

Agrava: no hay registro de intentos fallidos, así que un ataque en curso es
invisible.

---

## ALTA

### A-1 · La sesión no expira ni se puede revocar del lado del servidor

**Ubicación:** `src/lib/auth.ts` (`serializarSesion`, `deserializarSesion`,
`iniciarSesion`)

La carga firmada contiene `id`, `email`, `rol` y `estacionamientoId`. **No
contiene fecha de emisión ni de vencimiento.** El `maxAge` de 30 días es un
atributo de la cookie: una instrucción al navegador, no una verificación del
servidor.

Consecuencias:

- Una cookie capturada una vez (dispositivo prestado, backup, historial, log de
  un proxy) sirve **para siempre**. `deserializarSesion` solo comprueba la firma.
- `cerrarSesion()` borra la cookie del navegador, pero el valor sigue siendo
  válido si alguien lo copió antes. No hay cierre de sesión real.
- La única revocación posible es rotar `SESSION_SECRET`, que expulsa a todos.

### A-2 · Credencial de Postgres expuesta en los logs de runtime de Vercel

**Ubicación:** hallazgo operacional, ya registrado en `LEDGER.md`

Un `TypeError: Invalid URL` de `postgres-js` incluyó la cadena de conexión
completa —con contraseña— en el log del deploy. Los logs son privados de la
cuenta, pero la credencial quedó ahí, y esa misma contraseña es la única barrera
de una base expuesta a internet por el TCP proxy público.

Es la segunda exposición de esta credencial en el proyecto. La primera motivó una
rotación completa; esta no se ha rotado.

### A-3 · La barrera de datos reales no protege el dispositivo

**Ubicación:** `src/app/pantalla-operador.tsx` (`confirmar`),
`src/lib/cola-local.ts` (`guardar`), `src/lib/env.ts`
(`operacionRealHabilitada`)

El flujo offline-first escribe **primero en IndexedDB y después intenta la red**.
La barrera de cumplimiento vive únicamente en `POST /api/sesiones`. Entonces:

1. El operador teclea una patente real.
2. Se guarda en IndexedDB del dispositivo, sin cifrar.
3. El servidor la rechaza con 403.
4. **La patente real queda en el dispositivo**, en la cola, y se reintenta y
   rechaza indefinidamente. No se borra ni se avisa.

Es decir: la barrera impide que el dato llegue a la base, pero no impide que se
recolecte y almacene. Bajo la Ley 21.719 el tratamiento incluye la recolección y
el almacenamiento, no solo la persistencia en el servidor. El aviso de la UI
aparece **después** de que el dato ya se guardó localmente.

Este es el hallazgo que más importa para el propósito de la barrera.

---

## MEDIA

### M-1 · IDOR latente: la salida no valida la pertenencia de la sesión

**Ubicación:** `src/app/api/sesiones/[id]/salida/route.ts:25-39`

Se comprueba el rol (`exigirRol("operador")`) pero no que la sesión pertenezca al
`estacionamientoId` del operador autenticado. Cualquier operador puede cerrar
cualquier sesión cuyo id conozca, de cualquier estacionamiento.

Hoy es inofensivo porque la v1 es de un solo estacionamiento (`spec.md` §8). Se
vuelve una vulnerabilidad real el día que exista un segundo, y ese es exactamente
el tipo de cambio que se hace sin recordar esta línea.

### M-2 · El contexto se resuelve por "la primera fila", no por el usuario

**Ubicación:** `src/app/api/sesiones/route.ts:28` (GET),
`src/app/dueno/page.tsx`, vía `obtenerEstacionamiento()` en
`src/lib/contexto.ts`

Ambos usan el primer estacionamiento de la tabla en lugar del
`estacionamientoId` del usuario autenticado, que está disponible en la sesión.
Mismo razonamiento que M-1: correcto por accidente mientras haya una sola fila.

Notable: el `POST` sí lo hace bien (usa `operador.estacionamientoId`). La
inconsistencia entre rutas es en sí misma una señal de riesgo.

### M-3 · Rol y estacionamiento congelados en la cookie durante 30 días

**Ubicación:** `src/lib/auth.ts` (`sesionActual`, `exigirRol`)

Ninguna petición consulta la tabla `usuario`. Si se da de baja a una persona, se
le cambia el rol o se la mueve de estacionamiento, su cookie sigue funcionando
con los datos viejos hasta que expire en el navegador. Un operador degradado
conserva sus permisos; un usuario eliminado sigue entrando.

### M-4 · Las patentes en IndexedDB no tienen purga ni caducidad

**Ubicación:** `src/lib/cola-local.ts`

Las sesiones sincronizadas y cerradas permanecen en IndexedDB indefinidamente. No
hay borrado al cerrar sesión, ni caducidad, ni límite de tamaño. Cuando se defina
`{{PLAZO_RETENCION_PATENTE}}`, la política tendrá que cubrir **también las copias
del dispositivo**, no solo la base: hoy no hay ningún mecanismo para hacerlo
cumplir del lado del cliente.

---

## BAJA

### B-1 · `claveCorrecta` filtra el largo de la clave

**Ubicación:** `src/lib/auth.ts:110-118`

`if (a.length !== b.length) return false` se evalúa antes de `timingSafeEqual`.
La comparación es de tiempo constante, pero el largo no. Mitigación habitual:
pasar ambos valores por un hash de largo fijo antes de comparar.

### B-2 · Sin token CSRF; se depende solo de `SameSite=Lax`

**Ubicación:** `src/lib/auth.ts:79`, todas las rutas `POST`

`SameSite=Lax` bloquea el POST cross-site, así que el CSRF clásico está cubierto.
Pero es la única defensa: no hay token ni verificación de `Origin`. Un cambio a
`SameSite=None` —o un navegador con comportamiento distinto— dejaría las rutas de
escritura descubiertas.

### B-3 · `POST /api/sesiones` devuelve la sesión completa ante un id existente

**Ubicación:** `src/app/api/sesiones/route.ts:137-143`

La rama de idempotencia devuelve la fila completa, incluida la patente, para
cualquier id que ya exista. Requiere adivinar un UUIDv4, así que el riesgo
práctico es nulo, pero es una lectura de dato personal a través de una ruta de
escritura.

### B-4 · No hay cierre de sesión en la interfaz

**Ubicación:** `src/app/pantalla-operador.tsx`, `src/app/dueno/page.tsx`

`DELETE /api/login` existe pero ninguna pantalla lo usa. En un dispositivo
compartido —que es el escenario del operador— no hay forma de salir.

---

## Lo que está bien y conviene no romper

- **Consultas parametrizadas en todo el acceso a datos** (Drizzle). No hay
  concatenación de SQL en ninguna ruta. El intento de inyección está cubierto por
  prueba.
- **Ningún secreto en el repositorio.** Verificado con `git check-ignore`.
- **La firma de la cookie está bien construida**: HMAC-SHA256 y comparación en
  tiempo constante. Un cliente no puede ascender su rol editando la cookie.
- **El login no distingue email inexistente de clave incorrecta**, y ambas ramas
  ejecutan el mismo trabajo antes de responder.
- **`operadorId` y `estacionamientoId` del POST salen del usuario autenticado**,
  no del cuerpo de la petición.
- **La separación de roles está verificada en ambas direcciones**, no solo en
  una.
- **La barrera de cumplimiento es código y no documentación**, y está verificada
  contra el deploy.

---

## Orden sugerido de corrección

No se corrigió nada: la decisión es del responsable del proyecto.

1. **A-2** — rotar la credencial expuesta. Es acción manual y no depende de
   ningún cambio de código.
2. **A-3** — es el que contradice el propósito declarado de la barrera.
3. **C-1** — límite de intentos en el login.
4. **A-1** — vencimiento dentro de la carga firmada.
5. **M-1** y **M-2** juntos: derivar siempre el estacionamiento del usuario
   autenticado. Es el mismo cambio en tres lugares.
6. El resto, por severidad.

Los hallazgos M-4 y A-3 conviene resolverlos **antes** de definir
`{{PLAZO_RETENCION_PATENTE}}`, porque condicionan qué puede prometer esa política.
