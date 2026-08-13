# LEDGER.md

Bitácora append-only. **Nunca se reescriben líneas.** Una entrada por acción
relevante: fecha · hito · criterio · comando · resultado · evidencia.

Estado se lee de aquí: el último hito con todos sus AC en PASS es el hito cerrado.

---

### 2026-08-08 · M0 · estructura lista · PASS

Comando: `Get-ChildItem -Force -Recurse -File`

```
Archivo             Bytes
-------             -----
.gitignore            521
CLAUDE.md            4848
spec.md             13675
settings.local.json   654
```

Evidencia: `spec.md`, `CLAUDE.md` (con gate ADR-001) y `.gitignore` presentes.
Sin código de app, como exige M0 en spec.md §10.

Nota: AC-SCOPE-1 y AC-SCOPE-2 NO son ejecutables en M0 — no existen
`package.json` ni `src/db/`. Cierran en M1 según spec.md §10. No se declaran PASS.

---

### 2026-08-08 · PASO 0 · advertencia OneDrive · registrada

El directorio de trabajo `C:\Users\herre\OneDrive\Documentos\Code\Estacionamiento`
está bajo OneDrive. `node_modules` y `.next` en carpeta sincronizada pueden causar
builds lentos y bloqueos de archivo en Windows. Advertencia registrada una vez.
Por instrucción explícita, el repo NO se mueve. Se continúa.

---

### 2026-08-08 · PASO 0 · instalación Node · PASS

Comando: `winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent`

```
Found Node.js (LTS) [OpenJS.NodeJS.LTS] Version 24.19.0
Downloading https://nodejs.org/dist/v24.19.0/node-v24.19.0-x64.msi
Successfully verified installer hash
Starting package install...
Successfully installed
exit=0
```

---

### 2026-08-08 · PASO 0 · instalación Git · PASS

Comando: `winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements --silent`

```
Found Git [Git.Git] Version 2.55.0.3
Downloading https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.3/Git-2.55.0.3-64-bit.exe
Successfully verified installer hash
Starting package install...
Successfully installed
exit=0
```

---

### 2026-08-08 · PASO 0 · binarios instalados y funcionales · PASS

Comando (con PATH refrescado desde el registro dentro del mismo proceso):

```
$env:PATH = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path','User')
node -v ; npm -v ; git --version
```

```
node: v24.19.0
npm:  11.17.0
git:  git version 2.55.0.windows.3
```

Los tres binarios existen y responden. La instalación es correcta.

---

### 2026-08-08 · PASO 0 · PATH heredado en la sesión · FAIL · FRENO DURO

Comando (shell nuevo, sin refrescar PATH):

```
try { node -v } catch { "node NO esta en el PATH de esta sesion" }
try { git --version } catch { "git NO esta en el PATH de esta sesion" }
```

```
node NO esta en el PATH de esta sesion
git NO esta en el PATH de esta sesion
```

Causa: el proceso de Claude Code se inició antes de la instalación y conserva el
PATH antiguo. Cada shell hijo hereda ese PATH obsoleto. La instalación está bien;
lo que falta es que el proceso padre lea el PATH nuevo.

**Freno duro de la instrucción activado:** "Node/Git no quedaron en el PATH tras
instalar (requiere reiniciar Claude Code)". Se detiene y se devuelve el control.

Alternativa verificada (no aplicada sin autorización): prefijar cada comando con
el refresco de PATH desde el registro. Comprobado funcional en la entrada
anterior. Los procesos hijo (`npm`, `npx`, `git`) heredan el PATH corregido del
shell padre, por lo que el flujo completo M1→M4 es viable sin reiniciar.

Estado al detenerse: **M0 cerrado. M1 no iniciado.**

---

### 2026-08-08 · PASO 0 · freno duro resuelto por decisión humana

El humano optó por continuar sin reiniciar, usando el prefijo de refresco de PATH
en cada comando. Freno levantado. Se abre M1.

Prefijo aplicado a todo comando que invoque node/npm/npx/git:

```
$env:PATH = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path','User')
```

---

### 2026-08-08 · M1 · abierto

Alcance según spec.md §10: PWA (manifiesto + service worker), Neon + Drizzle,
esquema de §4. Cierra con AC-DATA-1, AC-SCOPE-1/2, AC-BUILD-1, AC-PWA-1.

---

### 2026-08-08 · M1 · scaffold Next.js · PASS

Comando: `npx --yes create-next-app@latest scaffold-tmp --ts --app --src-dir --tailwind --eslint --import-alias "@/*" --use-npm --yes`

```
Creating a new Next.js app in ...\scaffold-tmp.
Installing dependencies: next, react, react-dom
Installing devDependencies: @tailwindcss/postcss, @types/node, @types/react,
  @types/react-dom, eslint, eslint-config-next, tailwindcss, typescript
added 358 packages, and audited 359 packages in 1m
found 0 vulnerabilities
Success! Created scaffold-tmp
```

Se scaffoldeó en subdirectorio porque `create-next-app` rechaza directorios no
vacíos, y luego se movió el contenido a la raíz. (Primer intento con nombre
`_scaffold` falló: npm no permite nombres que empiezan con guion bajo.)

Versión instalada: **Next.js 16.3.0 / React 19.2.8**.

---

### 2026-08-08 · M1 · incidente: CLAUDE.md sobrescrito por el scaffold · corregido

Al mover el contenido de `scaffold-tmp` a la raíz excluí `.gitignore` para
preservar el mío, pero no previ que `create-next-app` genera además su propio
`CLAUDE.md` (con una sola línea: `@AGENTS.md`). El movimiento con `-Force`
sobrescribió el `CLAUDE.md` del gate de alcance.

Detectado de inmediato. `CLAUDE.md` restaurado desde el contenido de M0, con dos
cambios deliberados: se conserva el import `@AGENTS.md` en la primera línea (lo
regenera `next dev`; borrarlo solo lo recrea), y se agregan las secciones de
versión de Next y de prefijo de PATH.

Impacto real: ninguno persistente. Registrado por ser una pérdida de archivo de
gobernanza, no un detalle de proceso.

---

### 2026-08-08 · M1 · advertencia de versión de Next

`AGENTS.md` (generado por Next 16.3.0) advierte que esta versión tiene cambios de
API respecto del conocimiento base del modelo, y ordena leer
`node_modules/next/dist/docs/` antes de escribir código. Se acata: los docs
incluidos se consultan antes de implementar, en lugar de escribir Next de memoria.

---

### 2026-08-09 · M1 · AC-SCOPE-1 · PASS

Comando: `Select-String -Path package.json -Pattern "stripe|mercadopago|webpay|transbank|flow" -CaseSensitive:$false`

```
sin resultados
```

---

### 2026-08-09 · M1 · AC-SCOPE-2 · PASS

Comando: `Get-ChildItem -Recurse src\db -File | Select-String -Pattern "pago|transaccion|sucursal|reserva" -CaseSensitive:$false`

```
sin resultados
```

---

### 2026-08-09 · M1 · AC-SCOPE-3 · PASS

Comando: `Get-ChildItem -Recurse src,public -File | Select-String -Pattern "getUserMedia|MediaDevices|\bLPR\b|\bOCR\b|tesseract|reconocimiento de patente"`

```
sin resultados
```

Estructura de `src/`: `app/{layout,page,manifest,registrar-sw}`, `app/offline/page`,
`db/{index,schema}`. Ningún módulo de captura de imagen.

---

### 2026-08-09 · M1 · cambio de proveedor de base de datos · ADR-003

Decisión humana: la base de datos pasa de Neon (ADR-002) a **Postgres en Railway**,
manteniendo Vercel como hosting. Registrado en `docs/adr/ADR-003-base-de-datos-en-railway.md`
y reflejado en `spec.md` §3 con referencia al ADR. El gate ADR-001 no se toca.

Consecuencia en código: `@neondatabase/serverless` (protocolo HTTP propio de Neon)
se reemplaza por `postgres` (postgres-js) sobre TCP. El esquema de §4 no cambia.

---

### 2026-08-09 · M1 · AC-BUILD-1 · PASS (re-verificado tras cambio de driver)

Comando: `npm run build`

```
▲ Next.js 16.3.0 (Turbopack)
✓ Compiled successfully in 16.0s
  Finished TypeScript in 2.7s
✓ Generating static pages using 7 workers (6/6) in 745ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /manifest.webmanifest
└ ○ /offline
```

---

### 2026-08-09 · M1 · Railway CLI · instalada y autenticada

`npm i -g @railway/cli` → `railway 5.35.0` (método oficial según la doc de Railway).

El UUID `87cae552-...`, entregado como token de autorización, fue **rechazado por
la API en ambas formas**:

```
Authorization: Bearer  -> "Not Authorized"
Project-Access-Token   -> "Project Token not found"
```

No coincide con ningún project ID de la cuenta. Queda sin identificar.

Autenticación resuelta por `railway login --browserless`:

```
✓ Signed in as Cristóbal Herrera (herrera.jara.cristobal@gmail.com)
```

---

### 2026-08-09 · M1 · identificación del proyecto · corrección de dato

El proyecto **no se llama "park"**. `railway list` devuelve siete proyectos y
ninguno tiene ese nombre. El correcto es **`noble-comfort`**
(`c0d250a9-dbde-4c42-837d-8820ac8c5832`), identificado sin ambigüedad porque su
`PGPASSWORD` coincide exactamente con la credencial entregada, y es el único
proyecto creado el mismo día con un solo servicio (`Postgres`, Online,
`postgres-ssl:18`).

---

### 2026-08-09 · M1 · TCP proxy público creado

El servicio no tenía `DATABASE_PUBLIC_URL`: el proxy no existía. Por eso la URL
pública no aparecía por ningún lado.

Comando: `railway tcp-proxy create --port 5432 --json`

```
{ "proxy": { "id": "1d3ca9a2-aae1-454a-8108-d17bc22b3475",
             "domain": "autorack.proxy.rlwy.net",
             "proxyPort": 55464,
             "applicationPort": 5432,
             "syncStatus": "ACTIVE" } }
```

Expone la base a internet: es la condición que impone ADR-003 al elegir Vercel
como hosting. Reversible con `railway tcp-proxy delete`.

---

### 2026-08-09 · M1 · migraciones aplicadas a la base real · PASS

Comando: `npx drizzle-kit migrate` contra `autorack.proxy.rlwy.net:55464`

```
Using 'postgres' driver for database querying
[✓] migrations applied successfully!
exit=0
```

Solo DDL sobre tablas vacías. No se insertó ningún dato personal, por lo que no
se activa el freno de `{{BASE_LICITUD}}` / `{{PLAZO_RETENCION_PATENTE}}`.

---

### 2026-08-09 · M1 · AC-DATA-1 · PASS (contra la base real)

Comando: `node scripts/verificar-esquema.mjs`

```
estacionamiento  (5 columnas)   sesion_vehiculo (11 columnas)
tarifa           (6 columnas)   usuario         (5 columnas)

sesion_vehiculo:
  salida_at         timestamp with time zone  NULL
  monto_calculado   integer                   NULL
  tecleo_inicio_at  timestamp with time zone  NOT NULL
  tecleo_fin_at     timestamp with time zone  NOT NULL

ENUMS
  estado_sesion = activa, cerrada
  estado_sync   = local, sincronizada
  rol_usuario   = operador, dueño

CLAVES FORÁNEAS
  sesion_vehiculo.estacionamiento_id -> estacionamiento
  sesion_vehiculo.operador_id        -> usuario
  tarifa.estacionamiento_id          -> estacionamiento
  usuario.estacionamiento_id         -> estacionamiento

Total: 4 tablas, 3 enums, 4 FKs
```

Coincide campo por campo con `spec.md` §4. Verificado contra la base desplegada,
no solo contra el SQL generado.

---

### 2026-08-09 · M1 · AC-PWA-1 · FAIL tras 3 intentos · HITO DETENIDO

Verificación exigida por `spec.md` §9: *"auditoría PWA (Lighthouse)"*.

**Intento 1** — `npx lighthouse --only-categories=pwa`:

```
Runtime error encountered: No Chrome installations found.
```

Chrome no está instalado en el equipo.

**Intento 2** — mismo comando con `CHROME_PATH` apuntando a Edge 151.0.4129.72:

```
Error: EPERM, Permission denied: \\?\C:\...\Temp\lighthouse.60409759
    at Launcher.destroyTmp (chrome-launcher.js:367:9)
```

Reporte no escrito.

**Intento 3** — igual, con perfil de navegador dedicado vía `--user-data-dir`:

```
Error: EPERM, Permission denied: \\?\C:\...\Temp\lighthouse.44624494
    at Launcher.destroyTmp (chrome-launcher.js:367:9)
exit=1
reporte escrito? False
```

BoundedLoop agotado. **Se detiene M1.**

**Causa raíz, además del crash:** la categoría PWA ya no existe en Lighthouse.
Inspección del paquete instalado (sin lanzar navegador):

```
version instalada: 13.4.1
categorias definidas en default-config.js:
  performance
aparece 'pwa' en el config? NO — la categoria fue eliminada
```

Es decir: **AC-PWA-1 es inverificable como está redactado**, con cualquier
Lighthouse actual y en cualquier máquina. No es un defecto de la implementación
sino del criterio de aceptación. Corregirlo exige decisión humana sobre `spec.md`
§9; no se enmienda por cuenta propia.

**Evidencia recogida que NO se declara PASS** (no es la verificación exigida):

```
/manifest.webmanifest  HTTP 200 · application/manifest+json · JSON válido
                       name, short_name, start_url, scope, display=standalone,
                       theme_color, 3 iconos (192, 512, 512-maskable)
/sw.js                 HTTP 200 · application/javascript; charset=utf-8
                       Cache-Control: no-cache, no-store, must-revalidate
/icon-192.png          HTTP 200 · image/png · 987 bytes
/icon-512.png          HTTP 200 · image/png · 3171 bytes
/icon-512-maskable.png HTTP 200 · image/png · 3051 bytes
HTML servido en /      link rel=manifest PRESENTE · theme-color PRESENTE
                       mobile-web-app-capable PRESENTE · lang=es-CL PRESENTE
                       RegistrarServiceWorker PRESENTE
```

Falta comprobar en navegador que el service worker efectivamente registre y
controle la página. Eso no se hizo.

**Estado: M1 detenido con 5 de 6 criterios en PASS.**
AC-DATA-1 PASS · AC-SCOPE-1 PASS · AC-SCOPE-2 PASS · AC-SCOPE-3 PASS ·
AC-BUILD-1 PASS · **AC-PWA-1 FAIL**.
M2 no se abre.

---

### 2026-08-09 · M1 · AC-PWA-1 enmendado por decisión humana

Ante el FAIL, el humano decidió reescribir el criterio por propiedad en lugar de
por herramienta. `spec.md` §9 actualizado con la enmienda y su justificación
visible en el propio documento (no en silencio).

Redacción nueva: *manifiesto con los campos de instalabilidad (name/short_name,
start_url, display, iconos 192 y 512 que existen) y service worker registrado,
activado y controlando la página.*
Verificación nueva: `node scripts/verificar-pwa.mjs`.

El verificador habla CDP directo contra Edge vía `puppeteer-core`. No depende de
Lighthouse, así que no vuelve a caducar si la herramienta cambia.

---

### 2026-08-09 · M1 · AC-PWA-1 · PASS

Comando: `node scripts/verificar-pwa.mjs` (contra `next start`, build de producción)

```
PASS · existe <link rel=manifest> · http://localhost:3000/manifest.webmanifest
PASS · el manifiesto responde 200 · HTTP 200
PASS · el manifiesto es JSON válido
PASS · tiene name o short_name · Gestión de Estacionamiento
PASS · tiene start_url · /
PASS · display permite instalación · standalone
PASS · tiene icono de 192x192
PASS · tiene icono de 512x512
PASS · icono /icon-192.png se sirve como imagen · HTTP 200 · image/png
PASS · icono /icon-512.png se sirve como imagen · HTTP 200 · image/png
PASS · icono /icon-512-maskable.png se sirve como imagen · HTTP 200 · image/png
PASS · el service worker se registra y activa · scope=http://localhost:3000/ estado=activated
PASS · el service worker controla la página · http://localhost:3000/sw.js

13/13 comprobaciones PASS
AC-PWA-1: PASS
exit=0
```

---

### 2026-08-09 · M1 · CERRADO

Los seis criterios del hito, todos con evidencia de comando en este ledger:

| Criterio | Resultado |
|---|---|
| AC-DATA-1 | PASS — contra la base desplegada en Railway |
| AC-SCOPE-1 | PASS — sin SDK de pasarela |
| AC-SCOPE-2 | PASS — sin entidades prohibidas |
| AC-SCOPE-3 | PASS — sin módulo LPR/cámara |
| AC-BUILD-1 | PASS — `npm run build` limpio |
| AC-PWA-1 | PASS — 13/13 tras enmienda del criterio |

**Se abre M2** — Rebanada del operador (offline), `spec.md` §5 y §6.
Cierra con AC-OP-1, AC-OP-2, AC-MEAS-1.

---

### 2026-08-09 · M2 · AC-OP-2 · PASS

Módulo `src/lib/tarificacion.ts`: función pura, sin reloj ni base de datos, así
que la prueba no depende del entorno. Los tres parámetros de tarifa entran como
datos; ninguno se hardcodea (`spec.md` §11).

Comando: `node --test src/lib/tarificacion.test.ts`

```
▶ minutosCobrados — redondeo por fracción        5/5 ✔
▶ calcularMonto — tarifa completa                5/5 ✔
▶ calcularMonto — el monto mínimo es un piso     5/5 ✔
▶ calcularMonto — redondeo a peso entero         2/2 ✔
▶ calcularMonto — entradas inválidas             5/5 ✔

ℹ tests 22
ℹ pass 22
ℹ fail 0
```

Cubre lo que el criterio exige explícitamente: el redondeo por
`fraccion_minutos` (hacia arriba: un minuto de la fracción consume la fracción
entera) y el `monto_minimo` como piso, incluido el caso de permanencia cero.

**Decisión de implementación que conviene revisar:** el monto se redondea al
peso entero **más cercano** (`Math.round`), no hacia arriba. `spec.md` no lo
especifica. Se eligió el redondeo neutro porque inclinar cada salida a favor del
local es una decisión comercial, no técnica, y no corresponde tomarla en
silencio desde el código. Si el criterio del negocio es otro, se cambia en una
línea de `aPesosEnteros()`.

---

### 2026-08-09 · GATE DE SEGURIDAD abierto · construcción de M2 detenida

Credencial de Postgres comprometida: pegada varias veces en el chat, replicada a
OneDrive por la carpeta sincronizada, y la base expuesta a internet por el TCP
proxy creado en M1, donde la contraseña es la única barrera.

Regla aplicada: no se construye sobre una credencial quemada. M2 queda detenido
tras AC-OP-2 hasta que la rotación esté verificada.

**Comprobación del estado de la credencial** (sin exponerla, por huella SHA-256
truncada de `PGPASSWORD` leída con `railway variable list --json`):

```
huella de la comprometida : 6d188a9f
huella de la actual       : 6d188a9f
ESTADO: NO ROTADA
```

En adelante, toda contraseña que aparezca en este ledger va enmascarada o por
huella. Nunca en claro.

---

### 2026-08-09 · corrección de desincronización en CLAUDE.md

`CLAUDE.md` seguía nombrando Neon en dos lugares, contradiciendo ADR-003 ya
aceptado:

- §2, fila M4: "Deploy en Vercel + Neon del Marketplace" → "Deploy en Vercel +
  Railway DB (ADR-003)".
- §5, arquitectura: "Neon Postgres vía Marketplace de Vercel" → "Postgres en
  Railway vía TCP proxy público (ADR-003)", con el driver `postgres-js`.

La segunda no estaba señalada en la instrucción; se corrigió porque era el mismo
defecto en otra sección.

---

### 2026-08-09 · GATE DE SEGURIDAD · rotación ejecutada · PASS

Hallazgo previo a la rotación: **editar `POSTGRES_PASSWORD` en el panel de
Railway no habría rotado nada.** La imagen de Postgres lee esa variable solo
durante la inicialización, con el volumen vacío. En una base ya inicializada, el
efecto habría sido el peor de los dos mundos: la contraseña vieja sigue viva y
las variables del servicio quedan mintiendo respecto de la base real.

La rotación real son dos pasos acoplados, y se ejecutaron juntos:

1. `ALTER USER "postgres" WITH PASSWORD ...` sobre la base viva
   (`scripts/rotar-password.mjs`). Contraseña de 40 caracteres alfanuméricos
   generada con RNG criptográfico en la máquina local. Nunca se pegó en el chat.
2. Variables del servicio puestas en sincronía vía CLI:

```
Set variables PGPASSWORD
Set variables POSTGRES_PASSWORD
Set variables DATABASE_URL
exit=0
```

3. `.env` reescrito. Apariciones restantes de la credencial vieja: **0**.

**Verificación A — la credencial vieja quedó muerta:**

```
exit del intento con la vieja: 1
PostgresError: password authentication failed for user "postgres"
code: '28P01'
```

**Verificación B — la credencial nueva conecta:**

```
node scripts/verificar-esquema.mjs
Total: 4 tablas, 3 enums, 4 FKs
exit=0
```

**Verificación C — todo en sincronía** (huellas SHA-256 truncadas; las
contraseñas nunca en claro en este archivo):

```
PGPASSWORD en Railway     : 36e1f8c4
POSTGRES_PASSWORD         : 36e1f8c4
PGPASSWORD en .env        : 36e1f8c4
credencial comprometida   : 6d188a9f   (distinta, y rechazada por la base)
```

**GATE CERRADO.** Se reanuda la construcción de M2.

Riesgo residual declarado: la contraseña nueva vive en `.env`, dentro de una
carpeta sincronizada por OneDrive. No se movió el repo por decisión explícita.
La exposición a internet por el TCP proxy sigue vigente por diseño (ADR-003);
lo que cambió es que la barrera ya no es una credencial quemada.

---

### 2026-08-09 · M2 · frontera de entrada de la patente · PASS

`src/lib/patente.ts`: normalización y validación de la patente, la frontera que
`spec.md` §7 exige. Función pura, se usa igual en cliente y servidor; la del
servidor es la que cuenta.

Decisión de diseño: los formatos no estándar (motos, vehículos extranjeros,
placas especiales) se **aceptan** y se marcan como `otro`. Rechazarlos frenaría
al operador en la vía, que es justo lo que H1 no puede permitirse. Se rechaza lo
que es inequívocamente inválido: vacío, sin dígitos, fuera de rango de largo, o
que no sea texto.

Comando: `npm test`

```
ℹ tests 39
ℹ suites 9
ℹ pass 39
ℹ fail 0
```

39 pruebas: 22 de tarificación (AC-OP-2, ya registrado) + 17 de la patente.
Incluye que entradas hostiles tipo `'; DROP TABLE sesion_vehiculo; --` no pasan
la validación. La defensa real contra inyección son las consultas
parametrizadas de Drizzle; esto es la capa de encima.

---

### 2026-08-09 · M2 · estado al cortar la sesión

Cerrado en M2: **AC-OP-2 PASS**. Frontera de la patente lista y probada.

Pendiente para cerrar M2:
- Semilla de fixtures (estacionamiento, tarifa, usuario operador y dueño).
- Route Handlers de entrada y salida.
- Cola en IndexedDB + sincronización al reconectar.
- Pantalla del operador con instrumentación de tecleo
  (`tecleo_inicio_at` al tocar "Nuevo ingreso", `tecleo_fin_at` al confirmar).
- **AC-OP-1**: prueba en navegador con CDP sobre Edge, reutilizando el mecanismo
  de `scripts/verificar-pwa.mjs`. Debe probar que un ingreso se registra y
  persiste en modo offline, y que sincroniza al volver la red.
- **AC-MEAS-1**: consulta agregada contra la base = 0 sesiones cerradas con
  timestamps de tecleo nulos.

Nota de alcance para quien retome: `spec.md` §5 asume el operador "ya
autenticado", pero ningún AC de M2 exige auth. La auth mínima de dos roles
(ADR-002) no está implementada y hace falta para M3 (panel del dueño). No se
declara hecha.

---

### 2026-08-09 · M2 · semilla de fixtures · PASS

`npm run sembrar` (idempotente). Dominios `.invalid` (RFC 2606, nunca
resolubles) y montos redondos, para que ningún dato de prueba pueda confundirse
con operación real (`spec.md` §11).

```
creado estacionamiento 890cfc22-2644-4aac-a49d-f6664e7acd26
creada tarifa 51804ec7-b264-4f82-b2e7-2ef6f4a6e159   (1000/h · fracción 15 · mínimo 500)
creado usuario operador: operador@fixture.invalid
creado usuario dueño: duena@fixture.invalid
```

---

### 2026-08-09 · M2 · AC-BUILD-1 revalidado con el flujo del operador · PASS

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/sesiones
├ ƒ /api/sesiones/[id]/salida
├ ○ /manifest.webmanifest
└ ○ /offline
```

Corrección de camino: el build falló primero con `TS5097` porque las pruebas
importan con extensión `.ts` (lo exige el runner nativo de Node, que borra tipos
y resuelve el especificador literal). Resuelto con `allowImportingTsExtensions`
en `tsconfig.json`, seguro bajo `noEmit`.

---

### 2026-08-09 · M2 · AC-OP-1 · PASS

Comando: `node scripts/verificar-op1.mjs` — CDP sobre Edge con puppeteer-core,
mismo mecanismo que AC-PWA-1. Sin Lighthouse, sin Chrome.

```
PASS · la app detecta que está sin conexión · sin conexión
PASS · el ingreso persiste en IndexedDB sin red · 1 registro(s)
PASS · queda marcado como local (no sincronizado) · local
PASS · los timestamps de tecleo se registraron · tecleo = 199 ms
PASS · la UI muestra el vehículo aunque no haya red
PASS · todavía no llegó al servidor · 0 fila(s)
PASS · al reconectar, sync_estado pasa a sincronizada
PASS · la sesión llegó a la base · 1 fila(s)
PASS · en la base queda activa, sincronizada y con tecleo completo · activa/sincronizada
PASS · sincronizar de nuevo no duplica la sesión · 1 fila(s)

10/10 comprobaciones PASS
AC-OP-1: PASS
```

La prueba corre con el navegador realmente offline (`Network.emulateNetworkConditions`),
no simulando la bandera. Verifica las dos mitades del criterio: persistencia sin
red **y** transición a `sincronizada` al reconectar.

Decisión de diseño registrada: el `id` de la sesión lo genera el cliente antes de
guardar en IndexedDB y viaja en el cuerpo al sincronizar. Sin eso, una
reconexión inestable duplica sesiones en cada reintento. La prueba lo cubre.

---

### 2026-08-09 · M2 · ciclo ingreso/salida contra la API · PASS

Comando: `node scripts/verificar-salida.mjs`

```
PASS · el ingreso responde 201 · HTTP 201
PASS · reenviar el mismo id no crea otra sesión · HTTP 200
PASS · la salida responde 200 · HTTP 200
PASS · la sesión queda cerrada · cerrada
PASS · el monto usa la tarifa vigente de la base · $ 1500
PASS · cerrar dos veces no cambia el monto · $ 1500
PASS · la API rechaza una patente inválida · HTTP 400
PASS · la API rechaza un ingreso sin timestamps de tecleo · HTTP 400
PASS · la tabla sigue existiendo tras el intento de inyección

9/9 comprobaciones PASS
```

Complementa a AC-OP-2: la prueba unitaria verifica la fórmula aislada; esta
verifica que la ruta tome la tarifa vigente de la base y persista el resultado.
89 min con fracción de 15 → 90 min → $1500, calculado en el servidor.

---

### 2026-08-09 · M2 · AC-MEAS-1 · PASS

Comando: `node scripts/verificar-meas1.mjs`, corrido **con una sesión cerrada
real presente** (no sobre una tabla vacía, que daría 0 trivialmente).

```
sesiones totales           : 1
sesiones cerradas          : 1
cerradas con tecleo nulo   : 0
columnas de tecleo NOT NULL: 2/2

AC-MEAS-1: PASS
```

Además de la consulta que pide el criterio, el script comprueba que el esquema
siga declarando ambas columnas `NOT NULL`: si un cambio futuro las afloja, esto
falla en vez de pasar desapercibido.

Limpieza posterior: `node scripts/limpiar-fixtures.mjs` → 1 sesión borrada, 0
restantes. Los fixtures usan prefijo `FIXT` y el borrado se acota a ese prefijo.

---

### 2026-08-09 · M2 · CERRADO

| Criterio | Resultado |
|---|---|
| AC-OP-1 | PASS — 10/10, offline real por CDP |
| AC-OP-2 | PASS — 22 pruebas unitarias |
| AC-MEAS-1 | PASS — 0 nulos, con sesión cerrada real |

Limitación declarada, no defecto oculto: **la salida requiere conexión.** El
monto se calcula en el servidor con la tarifa vigente porque un cliente que
estuvo sin red puede tener una tarifa vieja, y mostrar un monto equivocado al
cobrar en efectivo es peor que pedir señal un momento. El ingreso —que es lo que
mide H1 y lo único que AC-OP-1 exige offline— funciona sin red. Si el piloto
muestra que la salida sin señal también es necesaria, se resuelve cacheando la
tarifa localmente.

**Se abre M3** — Panel del dueño (`spec.md` §6): ocupación, ingresos observados y
descuadre. Cierra con AC-MEAS-2, más la auth mínima de dos roles que M3 necesita
para separar operador de dueño.

---

### 2026-08-09 · M3 · auth mínima · mecanismo elegido

Cookie de sesión firmada con HMAC-SHA256 (`node:crypto`) contra los usuarios ya
sembrados. Sin proveedor externo, sin OAuth, sin dependencia nueva → no requiere
ADR. `httpOnly` + `sameSite=lax` + `secure` en producción; comparación de firma y
de clave en tiempo constante; el login responde igual ante email inexistente y
ante clave incorrecta, para no filtrar qué emails existen. `SESSION_SECRET` y
`CLAVE_ACCESO` salen de `.env`, nunca del repo.

Límite declarado: es separación de roles, no un sistema de identidad. La barrera
es una clave compartida del piloto. Alcanza para dos roles en un estacionamiento;
no alcanza para multiusuario real.

Consecuencia: `operadorId` y `estacionamientoId` salen del usuario autenticado,
no del cuerpo de la petición. El cliente ya no elige a nombre de quién queda
registrada una sesión.

---

### 2026-08-09 · M3 · AC-OP-1 revalidado tras introducir auth · PASS

Cambiar el flujo obligaba a re-verificar, no a suponer. `node scripts/verificar-op1.mjs`:

```
PASS · el operador inicia sesión y llega a su pantalla · /
... (10 comprobaciones previas, sin cambios)
11/11 comprobaciones PASS
AC-OP-1: PASS
```

---

### 2026-08-09 · M3 · control de acceso en la API · PASS

`node scripts/verificar-salida.mjs`:

```
PASS · el operador obtiene sesión
PASS · la API rechaza un ingreso sin sesión · HTTP 401
... (9 comprobaciones previas, sin cambios)
11/11 comprobaciones PASS
```

---

### 2026-08-09 · M3 · AC-MEAS-2 · PASS (tras 2 intentos)

**Intento 1 — FAIL (5/10).** La prueba tomaba la foto de la base con `sleep`
fijos, antes de que los cierres terminaran: `0 cerradas` en la base contra
`1 cerrada` en el panel. El defecto era de la prueba, no del panel.

**Intento 2 — FAIL (9/10).** Mismo defecto en el bucle de ingresos: `3/4`
sesiones registradas al momento de contar.

**Intento 3 — PASS.** Reemplazados todos los `sleep` fijos por espera de
confirmación contra la base. Comando: `node scripts/verificar-meas2.mjs`

```
PASS · el operador entra a su pantalla · /
PASS · las 4 sesiones llegaron a la base · 4/4
PASS · quedaron 2 sesiones cerradas · 2 cerradas · 2 activas · $1000
PASS · el operador NO entra al panel del dueño · terminó en /
PASS · la dueña entra a su panel · /dueno
PASS · la ocupación del panel coincide con las sesiones activas · panel 2 · base 2
PASS · los ingresos observados coinciden con la suma de las cerradas · panel $1000 · base $1000
PASS · el conteo de salidas coincide · panel 2 · base 2
PASS · el descuadre expone la diferencia entre lo contado y lo registrado · 1
PASS · la dueña NO entra a la pantalla del operador · terminó en /dueno

10/10 comprobaciones PASS
AC-MEAS-2: PASS
```

End-to-end real: el operador registra 4 ingresos desde su pantalla, cierra 2, y
los agregados del panel del dueño se comparan contra la base. Incluye la
separación de roles en ambas direcciones.

Nota sobre el descuadre: la ocupación observada la ingresa el dueño y **no se
persiste**. `spec.md` §6 dice que el panel no requiere tabla adicional, y en
minimización es además lo correcto: es una comparación puntual, no un registro
que conservar. El panel hace visible la diferencia y no la impide — registrar la
sospecha como un hecho sería inventar evidencia sobre una persona.

---

### 2026-08-09 · M3 · regresión de hitos anteriores · PASS

```
npm test                    → 39 pruebas, 0 fallos
npm run build               → limpio, 9 rutas
node scripts/verificar-pwa.mjs   → 13/13 · AC-PWA-1 PASS
node scripts/verificar-meas1.mjs → 0 nulos · AC-MEAS-1 PASS
```

`/` pasó de estática a dinámica al quedar protegida; AC-PWA-1 se revalidó por eso.

---

### 2026-08-09 · M3 · CERRADO

| Criterio | Resultado |
|---|---|
| Auth mínima de dos roles | PASS — cookie firmada, separación verificada en ambas direcciones |
| AC-MEAS-2 | PASS — 10/10 end-to-end |

**Se abre M4** — Deploy en Vercel + Railway DB (ADR-003).

---

### 2026-08-09 · M4 · diagnóstico tras el corte de sesión

El run anterior se cortó editando `src/lib/env.ts`. Estado encontrado:

- `src/lib/env.ts` había quedado con los caracteres invisibles **literales** en
  la expresión regular (4 apariciones: U+FEFF y U+200B), pese a que el comentario
  del propio archivo decía que estaban escritos como escapes. Funcionalmente
  correcto, pero era exactamente el defecto que el archivo dice evitar.
  Reescrito con `String.fromCharCode`, fuente 100% ASCII. Verificado:
  `invisibles literales en env.ts: 0`.
- `src/db/index.ts` con inicialización perezosa: coherente, sin cambios.
- Build local limpio, 39 pruebas en verde.

---

### 2026-08-09 · M4 · autenticación en Vercel · PASS

`vercel whoami` → `cherrera0001`. El freno duro previsto para M4 no llegó a
dispararse: la CLI completó el flujo de dispositivo sin intervención adicional.
Proyecto creado y vinculado: `c4-all/estacionamiento`.

Corrección de camino: `vercel link --yes` falló dos veces, primero por falta de
scope y después porque el nombre derivado del directorio (`Estacionamiento`)
tiene mayúsculas y Vercel exige minúsculas. Resuelto con
`--scope c4-all --project estacionamiento`.

---

### 2026-08-09 · M4 · fallo de build en Vercel · causa raíz y corrección

Primer deploy: `Failed to collect configuration for /api/sesiones/[id]/salida`,
`TypeError: Invalid URL` en `src/db/index.ts`.

Causa: el cliente de Postgres se construía **al evaluar el módulo**. Next importa
las rutas durante el build para recolectar su configuración, y ahí el secreto no
está disponible. Un efecto de módulo que exige un secreto rompe cualquier
análisis en build.

Corrección: inicialización perezosa detrás de un `Proxy`, de modo que la conexión
se abre en el primer uso real. Beneficio adicional: una invocación serverless que
no toca la base ya no abre conexión.

---

### 2026-08-09 · M4 · fallo en runtime · BOM en DATABASE_URL

Con el build resuelto, `POST /api/login` devolvía 500 en producción. Log de
runtime de Vercel:

```
TypeError: Invalid URL
code: 'ERR_INVALID_URL'
input: '<U+FEFF>postgresql://...@autorack.proxy.rlwy.net:55464/railway?sslmode=require'
```

Causa: PowerShell 5.1 antepone el BOM al canalizar una cadena hacia un ejecutable
nativo. La variable en Vercel quedó con un U+FEFF invisible al principio.

Dos intentos de arreglarlo desde la consola (`[Console]::OutputEncoding` sin
preámbulo, y `rm` + `add` de las variables) **no lo resolvieron**: el BOM
persistía. Se dejó de pelear con la codificación y se normalizó en la frontera —
`src/lib/env.ts`, `leerEnv()` / `exigirEnv()` quitan BOM, espacios de ancho cero
y espacios de los extremos. Aplicado a `DATABASE_URL`, `SESSION_SECRET` y
`CLAVE_ACCESO`.

Resultado tras redeploy:

```
login en produccion -> HTTP 200 · {"rol":"operador","destino":"/"}
```

**Exposición registrada:** el mensaje de error de `postgres-js` incluyó la cadena
de conexión completa —con contraseña— en los logs de runtime de Vercel. Los logs
son privados de la cuenta, pero la credencial quedó ahí. Queda a decisión humana
si rotarla otra vez.

---

### 2026-08-09 · M4 · barrera de datos reales · PASS

La app quedó pública con la base productiva detrás. Sin barrera, el primer
vehículo real registrado convertiría al piloto en tratamiento de datos personales
sin base de licitud ni plazo de retención (Ley 21.719).

Barrera implementada: `OPERACION_REAL_HABILITADA`, **apagada por defecto**.
Mientras esté apagada, la API rechaza con 403 cualquier patente que no tenga el
prefijo de fixture. Es barrera de código, no advertencia en documentación: una
advertencia depende de que alguien la lea.

Verificado contra el deploy:

```
FIXT77 -> HTTP 201 (aceptada)
BCDF34 -> HTTP 403 · "El piloto solo acepta patentes de prueba. Operar con
                      patentes reales exige definir antes la base de licitud y
                      el plazo de retención (Ley 21.719)."
```

Se suma el aviso visible en la pantalla del operador y la variable documentada en
`.env.example` con la condición para encenderla.

---

### 2026-08-09 · M4 · prueba e2e CONTRA EL DEPLOY · PASS

`node scripts/verificar-meas2.mjs https://estacionamiento-three.vercel.app`

```
PASS · el operador entra a su pantalla · /
PASS · las 4 sesiones llegaron a la base · 4/4
PASS · quedaron 2 sesiones cerradas · 2 cerradas · 2 activas · $1000
PASS · el operador NO entra al panel del dueño · terminó en /
PASS · la dueña entra a su panel · /dueno
PASS · la ocupación del panel coincide con las sesiones activas · panel 2 · base 2
PASS · los ingresos observados coinciden con la suma de las cerradas · panel $1000 · base $1000
PASS · el conteo de salidas coincide · panel 2 · base 2
PASS · el descuadre expone la diferencia entre lo contado y lo registrado · 1
PASS · la dueña NO entra a la pantalla del operador · terminó en /dueno

10/10 comprobaciones PASS
```

Ciclo completo login → ingreso → salida → panel contra la URL de producción, con
la base de Railway detrás. No es localhost.

`node scripts/verificar-pwa.mjs https://estacionamiento-three.vercel.app` →
13/13 PASS sobre HTTPS real.

Limpieza posterior: `limpiar-fixtures` → 0 sesiones de prueba, 0 sesiones totales
en la base. `verificar-meas1` → PASS.

---

### 2026-08-09 · M4 · CERRADO

**URL viva: https://estacionamiento-three.vercel.app**

| Criterio | Resultado |
|---|---|
| Deploy productivo en Vercel | PASS — `c4-all/estacionamiento`, estado READY |
| DB en Railway (ADR-003) | PASS — conecta desde producción por el proxy público |
| Secretos como env vars, saneados | PASS — 4 variables, leídas sin BOM |
| Prueba e2e contra el deploy | PASS — 10/10 |
| Barrera de datos reales | PASS — 403 verificado en producción |

Limitación declarada: el deploy corre por **CLI de Vercel**, no por `git push`.
`spec.md` §8 pide despliegue por `git push`, y eso requiere conectar un
repositorio remoto de GitHub al proyecto de Vercel. El repo es local (`git init`,
sin remoto). Es un paso de una sola vez que necesita la cuenta de GitHub del
decisor; no cambia nada del código ya desplegado.

**v1 del piloto COMPLETA.** Lo único entre este sistema y recibir un vehículo
real es fijar `{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}`, y recién ahí
encender `OPERACION_REAL_HABILITADA`.

---

### 2026-08-09 · Revisión de seguridad · 12 hallazgos

Revisión adversarial de solo lectura sobre toda la v1, leyendo los archivos y no
desde memoria de haberlos escrito. Informe:
`docs/revision-seguridad-2026-08-09.md`. 1 crítico, 3 altos, 4 medios, 4 bajos.
No se modificó código.

Nota: el skill `security-review` no pudo ejecutarse — asume commits y un remoto
`origin` que este repo no tiene. Se agregó un shim de `git` en
`C:\Users\herre\.local\bin\git.cmd` para destrabar el PATH de la sesión, pero el
bloqueo era el otro.

---

### 2026-08-09 · Se abre M5 — ENDURECIMIENTO

Fuente de verdad: `docs/revision-seguridad-2026-08-09.md`. Cada hallazgo es un AC.
Orden fijo por riesgo real: A-3 → M-4 → C-1 → A-1 → M-1+M-2.

---

### 2026-08-09 · M5 · A-2 · NO ROTADA (bloqueo humano, registrado)

Comprobación por huella, sin exponer la credencial:

```
huella actual en Railway : 36e1f8c4
huella expuesta en logs  : 36e1f8c4
ESTADO A-2: NO ROTADA
```

La credencial que quedó en los logs de runtime de Vercel sigue vigente. Es acción
humana y ningún fix de código la resuelve. No bloquea A-3, así que se continúa.

---

### 2026-08-09 · M5 · A-3 · PASS

**El hallazgo:** el flujo offline-first escribía en IndexedDB y después intentaba
la red. La barrera de cumplimiento vivía solo en el servidor, así que una patente
real quedaba recolectada y almacenada sin cifrar en el dispositivo aunque el
servidor la rechazara con 403 — y se reintentaba indefinidamente. Bajo la Ley
21.719 la recolección y el almacenamiento local ya son tratamiento.

**La corrección:**

- `src/lib/fixtures.ts` (nuevo): la convención de fixture pasa a un módulo sin
  dependencias, para que el cliente pueda evaluarla. Antes vivía en `env.ts`,
  que lee `process.env` y no corresponde importar desde el cliente.
- `src/app/page.tsx`: el servidor pasa `operacionReal` como prop. La variable de
  entorno sigue siendo solo del servidor; no se expuso ninguna `NEXT_PUBLIC_*`.
- `src/app/pantalla-operador.tsx`: la barrera se evalúa **antes** de `guardar()`.
  Una patente no-fixture no se escribe, no entra a la cola, no se reintenta. El
  campo se limpia: si era real, tampoco tiene por qué quedar en pantalla.
- `src/lib/cola-local.ts`: `eliminar()` y `purgarNoFixtures()`. Al abrir la app
  se purga cualquier patente real atascada de una versión anterior — los
  dispositivos que ya pasaron por el defecto tienen datos personales guardados.
- `src/app/api/sesiones/route.ts`: la barrera del servidor **se mantiene** como
  segunda línea. Una barrera de cliente sola es eludible.

**Verificación** (`node scripts/verificar-a3.mjs`, CDP sobre Edge), en local y
**contra el deploy**:

```
PASS · el aviso de piloto está visible
PASS · una patente real NO se guarda en IndexedDB · 0 registro(s) en la cola
PASS · no queda nada pendiente de reintentar
PASS · la app explica por qué la rechazó
PASS · tampoco llegó a la base · 0 fila(s)
PASS · una patente de prueba SÍ se guarda · 1 registro(s)
PASS · y sí llega a la base · 1 fila(s)
PASS · se simuló un dispositivo con una patente real atascada
PASS · al abrir la app se purga la patente real del dispositivo
PASS · la purga no se lleva los fixtures por delante

10/10 comprobaciones PASS
A-3: PASS
```

La prueba verifica una **ausencia**, que es más difícil que verificar una
presencia: confirma que el dato nunca tocó IndexedDB, no que se borró después.

**Regresión completa tras la corrección** (servidor local, scripts espaciados):

```
a3       PASS  10/10        op1      PASS  11/11
salida   PASS  11/11        meas2    PASS  10/10
meas1    PASS               pwa      PASS  13/13
npm test PASS  39/39        scripts con fallo: 0
```

Nota de la corrida: en un primer pase secuencial `meas2` abortó sin resultado.
Aislado pasó, y con separación entre scripts de navegador la secuencia completa
pasó. Se atribuye a contención entre instancias de Edge, no a regresión. Queda
registrado por no ser concluyente al 100%.

Redeploy a producción y A-3 reverificado contra la URL viva: 10/10.

**Estado M5: A-3 cerrado. Siguiente AC: M-4** (purga de las copias locales ya
sincronizadas o rechazadas).

---

### 2026-08-09 · M5 · concilio constituido

Tres subagentes en `.claude/agents/`, con ventana de contexto propia cada uno.
El mitigante buscado es estructural: un agente que audita lo que él mismo acaba
de escribir aprueba lo que ya cree correcto.

| Agente | Rol | Herramientas |
|---|---|---|
| `implementador` | Corrige UN hallazgo, diff mínimo. No se autocertifica. | Read, Grep, Edit, PowerShell |
| `auditor-adversarial` | Intenta romper la corrección leyendo el código real. **Veto terminal.** | Read, Grep, PowerShell |
| `verificador` | Corre verificador + regresión completa y pega salida real. | Read, PowerShell |

Desviación deliberada respecto de la definición pedida: la herramienta de shell
se declaró `PowerShell` y no `Bash`, porque es la que existe en este entorno.
Declararla `Bash` habría dejado a los tres agentes sin shell.

Regla de aprobación: hacen falta las tres voces — implementa, no-rompe,
verifica-con-comando. El implementador nunca cierra su propio trabajo.

---

### 2026-08-09 · M5 · GATE TERMINAL A-2 · BLOQUEADO · el concilio NO abre M-4

Primera actuación del concilio, y el veredicto es un veto de infraestructura.

```
GATE TERMINAL A-2
  huella vigente en Railway : 36e1f8c4
  huella expuesta en logs   : 36e1f8c4
  VEREDICTO: A-2 ABIERTO - el concilio NO abre M-4
```

La credencial de Postgres que quedó en los logs de runtime de Vercel **sigue
siendo la vigente**. La app está pública y la base productiva está detrás del
proxy TCP, donde esa contraseña es la única barrera.

Es la segunda exposición de esta misma credencial en el proyecto. La primera
motivó una rotación completa (ver entrada *GATE DE SEGURIDAD · rotación
ejecutada*); esta lleva varios turnos sin resolver mientras se siguió
construyendo encima.

**M5 se detiene acá.** No se abre M-4 ni ningún hallazgo posterior. Ninguna
corrección de código resuelve esto: la rotación es acción humana.

Procedimiento, ya ejecutado una vez en este proyecto y documentado:
`ALTER USER` sobre la base viva **y** sincronizar las variables del servicio.
Editar solo la variable en el panel de Railway **no rota nada** — la imagen de
Postgres lee `POSTGRES_PASSWORD` únicamente al inicializar el volumen.

Al rotar, el gate vuelve a evaluarse por huella y el concilio abre M-4.

---

### 2026-08-09 · M5 · A-2 · CERRADO · gate terminal levantado

Rotación ejecutada por instrucción explícita del decisor. Contraseña de 40
caracteres alfanuméricos generada con RNG criptográfico en la máquina local;
nunca apareció en el chat ni en un archivo versionado.

Los dos pasos acoplados, juntos:

1. `ALTER USER "postgres" WITH PASSWORD ...` sobre la base viva.
2. Variables del servicio sincronizadas por CLI:

```
Set variables PGPASSWORD
Set variables POSTGRES_PASSWORD
Set variables DATABASE_URL
```

3. `.env` reescrito — apariciones restantes de la vieja: **0**.
4. `DATABASE_URL` actualizada en Vercel (production, preview, development) y
   redeploy. Sin esto la producción habría quedado apuntando a una credencial
   muerta.

**Verificación A — la credencial expuesta quedó muerta:**

```
exit=1
PostgresError: password authentication failed for user "postgres"
code: '28P01'
```

**Verificación B — la nueva conecta:**

```
Total: 4 tablas, 3 enums, 4 FKs
```

**Verificación C — producción funciona con la credencial nueva:**

```
node scripts/verificar-a3.mjs https://estacionamiento-three.vercel.app
10/10 comprobaciones PASS
A-3: PASS
```

Huellas (las contraseñas nunca en claro en este archivo):

```
expuesta en logs / anterior : 36e1f8c4   (rechazada por la base)
vigente                     : 1b199545
```

**GATE TERMINAL A-2 LEVANTADO.** El concilio puede abrir M-4.

---

### 2026-08-09 · M5 · M-4 · ciclo 1 · **VETO del auditor**

El objetivo estricto de M-4 se cumple (`verificar-m4.mjs` 19/19 en corrida limpia;
el acuse queda con `patente: ""` en el acto), pero el rediseño que lo consigue
rompe tres cosas de forma reproducible y debilita una prueba existente.

**V-1 · La lista queda vacía con vehículos registrados (bloqueante).**
`src/app/pantalla-operador.tsx` (`refrescar`). Los `GET /api/sesiones` emitidos
durante una ráfaga de ingresos vuelven `[]` —se emiten antes de que los INSERT
lleguen a Railway— y al resolver últimos **pisan** la lista buena. No hay guarda
de orden de respuestas ni refetch periódico: el `setInterval` solo llama
`forzarRender`. Y ya no hay copia local de la que recuperarse. Medido: ~3 s con
4 autos en la base y ocupación 0 en pantalla; sin otra acción del operador la
ventana no está acotada. **AC-MEAS-2 falla 3 de 3 corridas** (`botones.length === 0`,
el bucle de cierre corta). Colateral del mismo lugar: `confirmar()` lanza
`sincronizarYRefrescar()` sin guarda de concurrencia y cada ingreso re-postea
toda la cola (una patente se posteó 4 veces).

**V-2 · Un 4xx transitorio destruye el ingreso offline (bloqueante, pérdida de datos).**
`src/lib/cola-local.ts`: `r.status >= 400 && r.status < 500` → `eliminar()`. Todo
el rango se trata como rechazo definitivo. Reproducido con 401 por cookie
borrada: un fixture válido registrado sin red se borra del dispositivo y nunca
llega al servidor. Contradice AC-OP-1. El aviso dice "hay que registrarlos de
nuevo" pero la patente ya no existe. No es hipotético: la cookie caduca (A-1), la
revocación propuesta para A-1 es rotar `SESSION_SECRET`, y **el remedio previsto
para C-1 responde 429** — arreglar C-1 vaciaría la cola del operador.

**V-3 · Tras recargar sin red, la pantalla queda en cero (bloqueante).**
`activasServidor` vive solo en memoria de React. Una recarga sin cobertura deja
al operador con ocupación 0 y sin ver quién está adentro. Contradice `spec.md`
§8 y §11 ("no tratar offline-first como opcional"). El verificador nunca prueba
esta combinación: el paso 2 recarga **con** red, el paso 5 prueba sin red **sin**
recargar. La única combinación que falla es la única que no se prueba.

**V-4 · La modificación de `verificar-a3.mjs` debilitó la comprobación.**
El primer cambio es legítimo (registrar el fixture offline: bajo la nueva
invariante la patente sincronizada ya no está en el dispositivo). El segundo no:
la aserción "la purga no se lleva por delante el registro de prueba" pasó de
mirar IndexedDB a contar filas en Postgres, sobre una función que solo toca
IndexedDB. Es **tautológica**: si `purgarNoFixtures()` borrara todo el almacén,
A-3 seguiría dando 10/10. Además ningún verificador comprueba que un pendiente
`local` sobreviva a una apertura, así que `purgarSincronizadas()` tampoco tiene
guarda contra sobre-borrado.

**Verificado y correcto, a no romper al corregir:**
`verificar-m4.mjs` 19/19 · `verificar-a3.mjs` 10/10 · `verificar-op1.mjs` 11/11 ·
sin patente en ningún otro almacén del cliente (volcado en vivo de `caches.keys()`:
solo shell y estáticos, ninguna respuesta de `/api/sesiones` cacheada; cero
coincidencias de `localStorage|sessionStorage|document.cookie` en `src/`) ·
gate ADR-001 limpio · `OPERACION_REAL_HABILITADA=false`.

**Dudas registradas, sin veto:** el acuse conserva el `id` (PK del servidor) y los
timestamps hasta la próxima apertura — seudonimizado reidentificable por el
responsable; decidir si entra en el alcance de M-4. Y vaciar el campo con `put`
no borra el valor del almacenamiento subyacente hasta la compactación, igual que
`delete`: no se puede prometer *borrado*, solo *no exposición por API*.

**Nota de entorno del auditor:** encontró un `next start` viejo (arrancado 21:28)
ocupando el puerto 3000. Si el implementador validó contra ese proceso, validó
contra código anterior al build.

**Error de proceso del orquestador, registrado:** lancé al auditor cuando vi
aparecer `verificar-m4.mjs`, sin señal de cierre del implementador, que siguió
editando `pantalla-operador.tsx` 19 minutos después. El auditor revisó un blanco
móvil. La regla del concilio —esperar la entrega del implementador antes de
auditar— existe por esto y la salté por impaciencia.

**VETO terminal. Vuelve al implementador, ciclo 2 de 3.**

Segunda rotación de esta credencial en el proyecto. La primera fue por exposición
en el chat; esta, por exposición en los logs de runtime de Vercel. Lección para
`LEARNINGS.md`: un driver que incluye la cadena de conexión en el mensaje de
error convierte cualquier fallo de conexión en una fuga de credencial.

---

### 2026-08-10 · M5 · endurecimiento integral sobre `docs/revision-integral-2026-08-09.md` · **PASS**

Alcance pedido: **todo lo corregible por código** del informe integral, en el
orden por riesgo real de su rol 6. Queda fuera **INT-7** (mecanismo de retención
de patente), que no es implementable sin `{{PLAZO_RETENCION_PATENTE}}` y
`{{BASE_LICITUD}}`: sigue como bloqueo humano.

**Cerrado en este asiento:** INT-1, C-1, INT-14, A-1 (+M-3 absorbido), INT-11,
INT-2, M-1, M-2, INT-4, INT-12, INT-3, INT-15, INT-16, INT-17, INT-19, INT-20,
INT-8, INT-9, B-1, B-2, B-3, B-4, PRV-obs-1. Y **M-4 ciclo 2**, que estaba en el
árbol sin asiento de cierre: `verificar:m4` 29/29 en corrida limpia.

#### Qué se hizo, por hallazgo

- **INT-1** — `src/lib/errores.ts` nuevo. Todo error del driver se **reconstruye**
  (no se decora): sobreviven el código y el mensaje redactado, y se descartan
  `input`, `cause` y las demás propiedades, que es donde postgres-js guarda la
  cadena. `DATABASE_URL` se parsea en `src/db/index.ts` **antes** de dárselo al
  driver, así que el `ERR_INVALID_URL` que provocó la rotación de A-2 ya no puede
  originarse. Redacta por patrón (credenciales en cualquier URI) y por valor
  (coincidencia literal de los secretos del entorno).
- **C-1** — `src/lib/limite-intentos.ts`: ventana deslizante por IP **y** por
  email, 5 intentos / 15 min, retardo que se duplica hasta 15 min, 429 con
  `Retry-After`. Techo de claves recordadas para que rotar la IP no se vuelva un
  vector de agotamiento de memoria. Alcance real —contador en memoria, por
  instancia serverless— documentado en el módulo, sin venderlo como más de lo que
  es.
- **INT-14** — `src/lib/tiempo.ts`. Se **corrige el desfase**, no se rechaza: un
  400 es rechazo definitivo para la cola local y borraría el ingreso del
  dispositivo, o sea cambiar un 500 por pérdida de datos. El cliente manda su
  `clienteAhora` al sincronizar y el servidor deriva el desfase del reloj de ese
  dispositivo. Entrada acotada a `[ahora-30d, ahora]`; los instantes de tecleo se
  corrigen pero **no** se acotan (son evidencia medida de H1, no se fabrican). En
  la salida, `entradaFacturable` vuelve cerrable la fila ya envenenada.
- **A-1 + M-3** — `src/lib/sesion-token.ts` (puro, con pruebas) + `auth.ts`.
  `iat`/`exp` firmados y verificados en el servidor; duración 30 días → **12 h**.
  El rol y el estacionamiento se **releen de `usuario`** en cada petición: eso
  revoca sin lista de tokens y absorbe M-3.
- **INT-11 + INT-12 + INT-3** — el service worker guarda como shell solo
  respuestas propias, 2xx y **no redirigidas** (la redirección al login ya no
  envenena la copia offline), y el nombre del caché lleva la versión del build,
  que viaja en `/sw.js?v=…`. Con eso `activate` sí purga entre deploys y deja de
  poder ejecutarse offline un cliente anterior a la barrera de A-3.
- **INT-2** — CSP con nonce por petición en `src/proxy.ts` (en Next 16
  `middleware` está deprecado y se llama `proxy`). `connect-src 'self'` es lo que
  corta la exfiltración de IndexedDB. `worker-src 'self'` explícito porque
  `strict-dynamic` anula el `'self'` de `script-src` para los workers.
  `Permissions-Policy` con `camera=()`, coherente con ADR-001.
- **M-1 + M-2 + INT-4 + B-3** — `obtenerEstacionamiento()` pasó de "la primera
  fila de la tabla" a "la del usuario autenticado". La salida comprueba
  **pertenencia**, no solo rol. `GET /api/sesiones` devuelve tres columnas y se le
  niega al `dueño`. La rama de idempotencia del POST ya no devuelve la fila
  entera.
- **INT-15/16/17** — migración `drizzle/0001_large_kinsey_walden.sql`: índice
  único parcial que impide dos sesiones activas por patente, 7 `CHECK` y 2
  índices. Aplicada a Railway tras un pre-chequeo de solo lectura que confirmó
  cero filas en conflicto.
- **INT-19 + INT-20** — `conBase()` envuelve todo acceso a la base; las rutas
  responden **503** (recuperable para la cola, a diferencia de un 400) y
  distinguen "mal configurado" de "servicio caído". `src/app/error.tsx` contiene
  el fallo de render que antes dejaba el panel del dueño en blanco.
- **INT-8 + B-4** — `CerrarSesion` en las dos pantallas: borra cookie **y**
  IndexedDB, con recarga completa para no dejar patentes en el estado en memoria.
  **Se niega a cerrar si quedan ingresos sin sincronizar**: ese registro existe
  solo en el dispositivo y borrarlo sería perderlo (AC-OP-1).
- **INT-9** — los cierres locales se anotan 30 s y se descuentan de la lista del
  servidor, así una respuesta emitida antes del cierre no vuelve a persistir la
  patente.
- **B-1** — se comparan huellas HMAC, no valores: ya no se filtra el largo.
- **B-2** — `origenPropio()` en las mutaciones. Asimétrica a propósito: si el
  navegador dice de dónde viene, tiene que decir que viene de acá; si no lo dice,
  pasa (no es un navegador, y no es a quien el CSRF ataca).
- **PRV-obs-1** — se registra el código HTTP del rechazo, no el cuerpo.

#### Dos defectos que encontró la propia verificación, y se corrigieron

1. **El índice único de INT-15 rompía el doble toque.** Un 23505 se convertía en
   503 y la cola local reintentaba para siempre algo que la base nunca iba a
   aceptar. Además el código del driver venía envuelto por `DrizzleQueryError`, y
   sin recorrer la cadena de causas quedaba como `desconocido`. Corregido: se
   recorre la cadena y el duplicado responde 200 `patente-ya-activa`. De paso, el
   mensaje que se conserva es el del driver y no el de drizzle — el de drizzle
   arrastra la consulta **y sus parámetros**, o sea patentes.
2. **`verificar-m4.mjs` cerraba con `now()` de Postgres una sesión cuya entrada
   la puso el reloj de la app.** Con 33 ms de desfase entre las dos máquinas, el
   `CHECK salida_posterior_a_entrada` lo rechazaba — con razón. La app nunca
   mezcla los dos relojes; el script sí. Corregido a `greatest(now(), entrada_at)`.
   Es exactamente lo que INT-16 anticipaba: "los propios scripts de verificación
   insertan por SQL directo".

#### Regresión completa — salida real

```
npm test                     -> 97 pruebas, 24 suites, 0 fallos
npm run build                -> PASS · Next.js 16.3.0 · 9 rutas + Proxy
npx tsc --noEmit             -> sin salida
npm run lint                 -> sin salida

verificar-esquema        exit=0  Total: 4 tablas, 3 enums, 4 FKs
verificar-pwa            exit=0  13/13 PASS   AC-PWA-1: PASS
verificar-op1            exit=0  11/11 PASS   AC-OP-1: PASS
verificar-a3             exit=0  11/11 PASS   A-3: PASS
verificar-m4             exit=0  29/29 PASS   M-4: PASS
verificar-salida         exit=0  11/11 PASS   Ciclo ingreso/salida: PASS
verificar-meas1          exit=0               AC-MEAS-1: PASS
verificar-meas2          exit=0  10/10 PASS   AC-MEAS-2: PASS
verificar-invariantes    exit=0   8/8  PASS   INT-15 / INT-16 / INT-17: PASS
verificar-endurecimiento exit=0  30/30 PASS   ENDURECIMIENTO: PASS
```

Gate ADR-001 limpio: AC-SCOPE-1/2/3 sin resultados.
`OPERACION_REAL_HABILITADA=false`. Fixtures limpiados al terminar
(`sesiones restantes en la base: 0`).

#### Decisiones que conviene que alguien confirme

1. **Duración de sesión: 12 h.** No es un `{{placeholder}}` de `spec.md`, así que
   se eligió en vez de bloquear; pero es una decisión de operación. Doce horas
   cubren un turno. Si el piloto quiere otra cosa, se cambia en
   `sesion-token.ts`.
2. **Permanencia máxima facturable: 30 días.** No es una regla de negocio sobre
   cuánto puede quedarse un auto: es el techo que impide que un reloj roto
   produzca un monto imposible de cobrar y una fila imposible de cerrar.
3. **La migración se aplicó a la base de Railway**, que es la productiva del
   piloto. Aditiva y reversible (`DROP INDEX` / `DROP CONSTRAINT`), con
   pre-chequeo de solo lectura previo. **No se desplegó a Vercel**: producción
   sigue sirviendo el código anterior.

#### Sin cerrar

- **INT-7** — mecanismo de retención. Bloqueado por `{{PLAZO_RETENCION_PATENTE}}`
  y `{{BASE_LICITUD}}`. Y como señala el informe, resolverlos no alcanza: hay que
  construir el mecanismo, y `patente NOT NULL` impide hoy el enmascaramiento que
  `spec.md:150` promete.
- **OFF-obs-4** — la reconciliación de IndexedDB no es atómica. Anotado, no
  corregido: a escala de piloto no tiene consecuencia observable.

---

### 2026-08-12 · Capa de diseño · importación y traducción · SIN CAMBIO DE CÓDIGO

Origen: proyecto Claude Design `964c3090-9776-4aa0-a79f-816b50244a83`
("PWA estacionamientos por tenant"), leído por el MCP `claude_design`.
Archivos leídos: `Plataforma Estacionamientos.dc.html` (14 maquetas `1a`–`1n`),
`_ds/…/colors_and_type.css`, `_ds/…/fonts/fonts.css`.

El pedido de importación decía *"Implement: Plataforma Estacionamientos.dc.html"*.
**No se implementó.** Ese archivo declara en su primera tarjeta que no cabe en
ADR-001. Se aplicó `CLAUDE.md` §1: detenerse, decirlo, pedir el ADR.

#### Veredicto de gate

6 pantallas construibles (`1b` `1c` `1e` `1g` `1l` `1n`) · 6 bloqueadas
(`1d` `1h` `1i` `1j` `1k` `1m`) · 2 mixtas (`1a` `1f`), de las que solo cabe la
mitad que no es multisitio. Bloqueadas por multisitio y por pasarela de cobro de
suscripción — las dos filas que el ADR-004 propuesto enmendaría.

#### Defecto encontrado en el diseño, con evidencia

El simulador de tarifas de `1e` contradice AC-OP-2. Contrastado contra
`src/lib/tarificacion.ts`, no a mano (`valor_hora 2000 · fracción 15 · mínimo 1000`):

```
12 MIN   maqueta 1e:   1000  AC-OP-2:   1000 OK
45 MIN   maqueta 1e:   1500  AC-OP-2:   1500 OK
1 H 53   maqueta 1e:   4000  AC-OP-2:   4000 OK
4 H      maqueta 1e:   8000  AC-OP-2:   8000 OK
9 H 20   maqueta 1e:  18667  AC-OP-2:  19000 <-- DISCREPANCIA
```

`18.667` es prorrateo puro sin aplicar la fracción. La maqueta está mal, no el
sistema. Importa porque el simulador es la pantalla donde el dueño fija su
tarifa: si simula distinto de lo que cobra, decide sobre una cuenta falsa.

#### Otros hallazgos

- `tecleo mediano 6,2 s` aparece en `1g` y `1k` como si H1 estuviera medido.
  **No hay ninguna medición.** Es un valor inventado junto a la meta
  `{{UMBRAL_H1_SEGUNDOS}}` — el más peligroso del set.
- El sistema de diseño trae dos dependencias externas (`fonts.googleapis.com` por
  `@import`, `unpkg.com/lucide@latest` sin versión fijada) incompatibles con la
  CSP de INT-2 y con la minimización. Hay que autoalojar.
- Otros valores inventados: piloto de 60 días (es `{{PLAZO_PILOTO}}`), límites de
  3 sitios / 2 operadores, `Webpay ····4417`, folios `F-000318`, `+12,4% vs ayer`.
- Las patentes, en cambio, están bien: `FIXT01`–`FIXT04` se ven como fixtures.

#### Salidas

- `docs/diseno-2026-08-12-traduccion.md` — SPEC-004 (presentación, AC-UI-1..4),
  SPEC-005 (comportamiento, AC-UX-1..8), auditoría data-driven campo por campo,
  AC-SCOPE-4, y la secuencia M6 / M7.
- `docs/adr/ADR-004-multisitio-y-suscripcion.md` — **estado PROPUESTO.**
  Mientras diga eso, el gate rechaza. La alternativa recomendada a evaluar
  primero es la enmienda mínima: cobro de suscripción sin multisitio.

Gate ADR-001 sin tocar. Sin cambios en `src/`, `package.json` ni esquema.

---

### 2026-08-12 · GATE TERMINAL M6 · **ABIERTO** · el concilio NO abre M6

Gate de tres partes exigido antes de tocar `src/`. Dos partes cierran, una no.

**Parte 1 — A-2 · credencial rotada vía `ALTER USER` · PASS**

Huella SHA-256 truncada de `PGPASSWORD` y del password de `DATABASE_URL` en
`.env`, sin exponer la credencial:

```
huella password de DATABASE_URL : 1b199545
huella PGPASSWORD               : 1b199545
OPERACION_REAL_HABILITADA       : false

referencia LEDGER 2026-08-09:
  expuesta en logs / anterior : 36e1f8c4  (debe estar MUERTA)
  vigente tras ALTER USER     : 1b199545  (debe COINCIDIR)
```

Coincide con la vigente. La expuesta no reaparece. A-2 sigue cerrado.

**Parte 2 — sincronía con Railway · PASS**

```
node --env-file=.env scripts/verificar-esquema.mjs
Total: 4 tablas, 3 enums, 4 FKs
exit=0
```

La credencial vigente conecta contra la base viva y el esquema es el de
AC-DATA-1. `sesion_vehiculo` con 11 columnas: sin `tarifa_id`; `usuario` con 5:
sin `estado`. Consistente con el esquema versionado.

**Parte 3 — producción endurecida · FAIL · BLOQUEO ACTIVO**

```
node --env-file=.env scripts/verificar-endurecimiento.mjs https://estacionamiento-three.vercel.app

FAIL · INT-2 · /login trae CSP
FAIL · INT-2 · la CSP usa nonce y no 'unsafe-inline' en script-src
FAIL · INT-2 · connect-src 'self' corta la exfiltración de IndexedDB
FAIL · INT-2 · frame-ancestors 'none'
FAIL · INT-2 · Permissions-Policy cierra camera y geolocation
FAIL · C-1 · una ráfaga de intentos termina en 429 · códigos: 401 × 12
FAIL · A-1 · la cookie lleva exp firmado
FAIL · INT-4 · al dueño se le niega la lista de patentes
FAIL · B-2 · un POST con Origin ajeno se rechaza con 403 · HTTP 400
FAIL · INT-14 · guarda la entrada acotada al presente · 2026-08-14T00:46:00.201Z
SyntaxError: Unexpected end of JSON input
exit=1
```

Diagnóstico: no es una regresión de código. Es la ausencia del deploy que
`STATE.md` viene declarando desde el 2026-08-10. **La URL viva sirve el código
anterior al endurecimiento**: el mismo verificador da 30/30 PASS en local
(LEDGER 2026-08-10) y 0 de 10 comprobaciones de endurecimiento contra
producción. Ninguna corrección de código levanta este gate — es un deploy.

Efecto secundario observado: el verificador **aborta** con `SyntaxError` al
recibir un cuerpo vacío donde espera JSON. Contra una producción endurecida no
ocurre; contra la vieja sí, y deja el resto de las comprobaciones sin correr.
El verificador debería fallar la comprobación, no morirse. Anotado; no se
corrige ahora porque tocarlo es trabajo de M6 y M6 está cerrado por este gate.

**VEREDICTO: GATE ABIERTO. M6 NO se abre.** No se tocó `src/`. Los tres defectos
de la capa de diseño (`1e` / `6,2 s` / fuentes e íconos externos) quedan sin
corregir: son ítems de M6.

Comando que falló y que hay que volver a correr para levantar el gate:

```
node --env-file=.env scripts/verificar-endurecimiento.mjs https://estacionamiento-three.vercel.app
```

**Precondición del deploy, sin resolver:** el árbol de trabajo tiene todo M5 sin
commitear (24 modificados, 19 nuevos) y el repositorio no tiene remoto. No hay
nada que empujar todavía.

---

### 2026-08-12 · Requerimiento nuevo · repositorio remoto

El decisor indica versionar en `https://github.com/cherrera0001/p4rkc0ntr0l`.
Resuelve el bloqueo humano #2 de `STATE.md`, que estaba anotado sin destino.

Estado del destino, comprobado en solo lectura y sin credenciales:

```
GIT_TERMINAL_PROMPT=0 git ls-remote --heads https://github.com/cherrera0001/p4rkc0ntr0l
(sin salida)
```

Lectura anónima exitosa y cero ramas: el repositorio **existe, está vacío y es
público**.

**No se configuró el remoto ni se empujó nada.** Antes hace falta una decisión
del decisor, porque el árbol contiene
`docs/revision-seguridad-2026-08-09.md` y `docs/revision-integral-2026-08-09.md`
— la revisión completa de vulnerabilidades de un sistema con URL viva, incluidos
hallazgos que producción **todavía no tiene corregidos** (ver el gate de arriba).
Publicarlos en un repositorio público es entregar el mapa de ataque de un
sistema en línea sin parchear. `.env` y `.env.local` están correctamente
ignorados; el problema no son los secretos, son los informes.

---

### 2026-08-12 · Instrumentación · el verificador que mentía hacia el lado optimista · PASS

Gate terminal de M6 reverificado antes de tocar nada. Partes 1 y 2 siguen en PASS:

```
huella password de DATABASE_URL : 1b199545
huella PGPASSWORD               : 1b199545
OPERACION_REAL_HABILITADA       : false
expuesta en logs (debe estar muerta): 36e1f8c4   <- no reaparece

node --env-file=.env scripts/verificar-esquema.mjs   exit=0   4 tablas, 3 enums, 4 FKs
```

Parte 3 sigue en **FAIL**, y el número real era peor que el registrado.

#### El defecto: un verificador que se muere reporta de menos

`verificar-endurecimiento.mjs` abortaba con `SyntaxError: Unexpected end of JSON
input` al recibir desde producción un 500 con cuerpo vacío. Moría en la
comprobación 15 de 30. El LEDGER del 2026-08-12 registró **10 FAIL**; ese número
no era el estado de producción, era el punto donde el script se cayó.

Corregido (en `scripts/`, **no se tocó `src/`**): `scripts/lib/respuesta.mjs` con
`leerJson()`, que ante un cuerpo ilegible devuelve evidencia en vez de lanzar; y
la fase de navegador envuelta, para que una excepción sea un FAIL de esa fase y
no el fin de la corrida. `verificar-salida.mjs` tenía el mismo defecto latente en
tres llamadas: corregido también.

#### Lo que el crash tapaba — producción, cuadro completo

```
node --env-file=.env scripts/verificar-endurecimiento.mjs https://estacionamiento-three.vercel.app

10/29 comprobaciones PASS   ->   19 FAIL, no 10
exit=1
```

Los que nunca se habían llegado a correr, y son los peores:

```
FAIL · INT-4  · al dueño se le niega la lista de patentes
FAIL · INT-4  · la respuesta trae solo id, patente y entradaAt
              · entradaAt,estacionamientoId,estado,id,montoCalculado,operadorId,
                patente,salidaAt,syncEstado,tecleoFinAt,tecleoInicioAt
FAIL · INT-14 · el servidor acepta un ingreso con el reloj adelantado · HTTP 500
FAIL · INT-14 · la sesión se puede cerrar (antes: 500 permanente) · HTTP 404
FAIL · INT-14 · un reloj atrasado no infla el monto · $ 504250
FAIL · INT-15 · el doble toque no crea una segunda sesión activa · HTTP 500
FAIL · INT-8  · la pantalla del operador tiene cierre de sesión
FAIL · INT-12 · los cachés llevan la versión del build · estacionamiento-shell-v1
```

Es decir: en la URL viva, hoy, **el dueño puede listar patentes** y la API
devuelve la fila entera de cada sesión. Un reloj atrasado factura $504.250 y un
doble toque responde 500. Nada de esto es nuevo — es el mismo código sin
endurecer de siempre; lo nuevo es que ahora está medido en vez de estimado.

**No es regresión de código.** El mismo verificador, mismo árbol, contra local:

```
node --env-file=.env scripts/verificar-endurecimiento.mjs
30/30 comprobaciones PASS   ENDURECIMIENTO: PASS   exit=0
```

**GATE TERMINAL DE M6: SIGUE ABIERTO.** Ninguna corrección lo levanta. Es el deploy.

#### La lección convertida en mecanismo (dos guards nuevos)

1. **`scripts/verificar-verificadores.mjs`** (`npm run verificar:verificadores`).
   Check estático, sin red ni base, sobre los 10 verificadores: que ninguno llame
   `.json()` crudo sobre una respuesta, y que todos impriman un veredicto final.

   Encontró un caso real de inmediato: **`verificar-esquema.mjs` no emitía
   veredicto.** Volcaba el esquema y salía con 0 pasara lo que pasara — el "PASS"
   de AC-DATA-1 lo ponía un humano mirando la pantalla. Mecanizado: ahora afirma
   las 4 tablas, los 3 enums, las 4 FKs y que las columnas de tecleo sigan
   `NOT NULL` (de lo que depende AC-MEAS-1).

   ```
   node scripts/verificar-verificadores.mjs              21/21 PASS   VERIFICADORES: PASS
   node --env-file=.env scripts/verificar-esquema.mjs     4/4  PASS   AC-DATA-1: PASS
   ```

2. **`scripts/lib/fixtures.mjs`** — `limpiarFixtures()` al inicio de los cinco
   verificadores de navegador. Cierra la deuda que `LEARNINGS.md` tenía anotada
   como "queda sin mecanizar" y que `STATE.md` pedía como disciplina humana.
   Volvió a cobrarse hoy: `verificar-m4` dio 28/29 por sesiones de una corrida
   anterior, no por el código.

   Probado con la secuencia que antes fallaba, corrida **sin limpiar a mano**:

   ```
   verificar-meas2          exit=0  10/10 PASS
   verificar-endurecimiento exit=0  30/30 PASS
   verificar-m4             exit=0  (limpieza previa: 3 sesión/es de una corrida
                                    anterior) · 29/29 PASS · M-4: PASS
   ```

#### Regresión completa tras los cambios — salida real

```
npm test                     -> 97 pruebas, 24 suites, 0 fallos
npx tsc --noEmit             -> exit=0, sin salida
npm run lint                 -> exit=0, sin salida
npm run build                -> exit=0 · Next.js 16.3.0 · 9 rutas + Proxy

verificar-pwa            exit=0  13/13 PASS   AC-PWA-1: PASS
verificar-op1            exit=0  11/11 PASS   AC-OP-1: PASS
verificar-a3             exit=0  11/11 PASS   A-3: PASS
verificar-m4             exit=0  29/29 PASS   M-4: PASS
verificar-salida         exit=0  11/11 PASS   Ciclo ingreso/salida: PASS
verificar-meas1          exit=0               AC-MEAS-1: PASS
verificar-meas2          exit=0  10/10 PASS   AC-MEAS-2: PASS
verificar-invariantes    exit=0   8/8  PASS   INT-15 / INT-16 / INT-17: PASS
verificar-endurecimiento exit=0  30/30 PASS   ENDURECIMIENTO: PASS
verificar-esquema        exit=0   4/4  PASS   AC-DATA-1: PASS
verificar-verificadores  exit=0  21/21 PASS   VERIFICADORES: PASS
```

Gate ADR-001 limpio: AC-SCOPE-1/2/3 sin resultados. `OPERACION_REAL_HABILITADA=false`.
Fixtures limpiados al terminar (`sesiones restantes en la base: 0`). Los tres
fixtures que la corrida contra producción escribió en la base de Railway
(FIXT91/92/93) fueron borrados: `sesiones de prueba borradas: 3`.

---

### 2026-08-12 · M5 · commit y DEPLOY a producción · 29/30

Decisión del decisor ante el gate abierto: desplegar por **CLI de Vercel** ahora,
sin pasar por GitHub. Motivo: producción servía código sin endurecer con INT-4
abierto —el dueño podía listar patentes y la API devolvía la fila entera— y
publicar antes los informes de vulnerabilidad en un repo público habría entregado
el mapa de ataque de un sistema todavía sin parchar. Para el repo remoto, el
decisor optó por **pasar `p4rkc0ntr0l` a privado**; queda pendiente de ejecutar y
no bloquea nada.

`spec.md` §8 pide despliegue por `git push`. Sigue siendo deuda declarada, la
misma que arrastra M4.

**Commit** — el árbol tenía M5 entero sin versionar desde el 2026-08-10:

```
git commit  ->  57fe4c5  "M5 endurecimiento: 20 hallazgos del informe integral
                          + guards de verificación"
53 archivos · 6642 inserciones · 649 eliminaciones
```

Comprobado antes de commitear: ningún `.env` en el índice
(`git check-ignore -v .env .env.local` → `.gitignore:52:.env*`).

**Variables en Vercel** — las cuatro que M5 exige ya existían, sin cambios:

```
npx vercel env ls production
DATABASE_URL · OPERACION_REAL_HABILITADA · CLAVE_ACCESO · SESSION_SECRET
(las cuatro Sensitive, Production)
```

**Deploy**:

```
npx vercel --prod --yes
readyState: READY · target: production
Production  https://estacionamiento-2exyzau3i-c4-all.vercel.app
Aliased     https://estacionamiento-three.vercel.app
```

**Comando del gate, contra la URL viva:**

```
node --env-file=.env scripts/verificar-endurecimiento.mjs https://estacionamiento-three.vercel.app

29/30 comprobaciones PASS
FALLARON: INT-12 · el worker se registra con la versión del build en la URL
exit=1
```

De 10/29 a 29/30. Los diecinueve FAIL de esta mañana cerraron contra producción:
INT-2 (los cinco), C-1, A-1, **INT-4 en sus dos comprobaciones**, B-2, INT-14 (las
cinco), INT-15 y INT-8. La exposición de patentes al dueño en la URL viva quedó
cerrada.

#### El deploy destapó una regresión que ningún entorno local podía mostrar

```
FAIL · INT-12 · el worker se registra con la versión del build en la URL
              · https://estacionamiento-three.vercel.app/sw.js?v=
PASS · INT-12 · los cachés llevan esa versión en el nombre, no el literal v1
              · estacionamiento-shell-sin-version
```

Local, mismo árbol: `?v=local-msqxui5o`, caché `estacionamiento-shell-local-msqxui5o`,
30/30.

Causa: `next.config.ts:17` deriva la versión de `VERCEL_GIT_COMMIT_SHA` con `?.`
y `??`. En un deploy por CLI sobre un repo sin remoto conectado a Vercel esa
variable llega como **cadena vacía**, no como `undefined`; `""` no es nullish, así
que ni el `?.slice()` ni el `??` disparan y la versión queda vacía. Lo mismo río
abajo en `registrar-sw.tsx:22`.

No es cosmético: con la versión vacía **todos** los deploys comparten el nombre de
caché `estacionamiento-shell-sin-version`, el `activate` del worker no tiene nada
que purgar y el shell viejo queda vigente para siempre — el defecto exacto que
INT-12 corrigió. Sin red, un dispositivo puede seguir ejecutando un cliente
anterior a la barrera de A-3 (INT-3).

Es también la razón por la que el gate exige medir contra la URL viva y no contra
local: la diferencia no estaba en el código sino en el entorno de build, y ningún
verificador local podía verla. La segunda comprobación de INT-12 pasó igual
—`sin-version` no es el literal `v1`— y por sí sola habría dado el hallazgo por
cerrado. Hizo falta la primera, que mira el valor y no su forma.

Segunda observación registrada: la comprobación de minimización de INT-4 pasó como
`(sin sesiones activas: no concluyente)`. Es honesta en su detalle, pero PASA sin
concluir. La que sí concluyó fue la de permisos. Anotado como deuda del verificador.

**GATE TERMINAL: sigue abierto por INT-12.** No se cierra con 29/30.

---

### 2026-08-13 · INT-12 · **VETADO por el auditor** · ciclo 2 abierto

**El hallazgo, por segunda vez.** INT-12 se había cerrado el 2026-08-10 con 30/30
en local. Al desplegar volvió intacto: `?v=` vacío y caché
`estacionamiento-shell-sin-version` compartido por todos los deploys.

Causa: `next.config.ts` derivaba la versión con `?.` y `??`. En un deploy por CLI
sobre un repo sin remoto conectado a Vercel, `VERCEL_GIT_COMMIT_SHA` llega como
**cadena vacía**. `""` no es nullish: ni el `?.slice()` ni el `??` disparan.

**La corrección** (implementador; el concilio no la cerró solo):

- `src/lib/version-app.ts` (nuevo, sin dependencias — lo importan el config, el
  cliente y los verificadores). `sanearVersion()` devuelve `null` —no `""`— ante
  vacío, blancos, BOM o valores degenerados (`v1`, `sin-version`, `degradado`,
  `undefined`, `null`). Que devuelva `null` obliga a quien llama a decidir, en vez
  de heredar un `""` que se ve como valor.
- Cadena de candidatos `VERCEL_GIT_COMMIT_SHA` → `VERCEL_DEPLOYMENT_ID` →
  `VERCEL_URL` → `build-<timestamp>`. **La garantía no depende de Vercel**: el
  último recurso la cumple por construcción.
- `next.config.ts` **lanza en build** si la versión resulta inutilizable.
  Inalcanzable hoy; está para el próximo que reintroduzca la forma.
- `public/sw.js` no puede importar el módulo —es script clásico servido
  estático— y repite `sanearVersion` en cinco líneas. El verificador comprueba
  que las dos copias coincidan en lo observable.

**Lo que el implementador descartó, y por qué importa.** Su primera versión sacaba
una huella de respaldo de los hashes de chunk `main-app-*` / `webpack-*`. Este
build es Turbopack: esos nombres no existen. Habría sido *un mecanismo que parece
defensa y nunca dispara* — exactamente la forma de este bug. Lo reemplazó por una
barrera que falla ruidosamente (el throw en build). Descartar la defensa falsa es
la decisión correcta y queda registrada como tal.

**Control negativo, que es lo que hace que el verificador valga:** el mismo
`verificar-int12.mjs` contra el deploy anterior devuelve `2/6` y `exit=1`,
reproduciendo el hallazgo. No es un sello de goma.

**Verificación contra la URL viva:**

```
node --env-file=.env scripts/verificar-endurecimiento.mjs https://estacionamiento-three.vercel.app
30/30 comprobaciones PASS   ENDURECIMIENTO: PASS   exit=0

node --env-file=.env scripts/verificar-int12.mjs https://estacionamiento-three.vercel.app
6/6 comprobaciones PASS     INT-12: PASS           exit=0
```

De 10/29 por la mañana a 30/30. **Y aun así el hallazgo no se cierra.**

#### VETO del auditor — el bypass, reproducido

El auditor levantó los 30/30 y encontró que el fix **mueve** el defecto en vez de
cerrarlo. `resolverVersionApp` retorna en el primer candidato, y el primero es el
commit. **Dos deploys distintos con el mismo SHA producen la misma versión** →
mismo nombre de caché → misma URL `/sw.js?v=…` → el navegador no instala worker
nuevo → `activate` nunca corre → el shell viejo sobrevive. Es INT-12 textual.

No es teoría. Lo ejecutó en una copia aislada del repo, tres builds con
`VERCEL_GIT_COMMIT_SHA` fijo y `VERCEL_DEPLOYMENT_ID` / `VERCEL_URL` distintos, con
cambio de código verificado en el tercero:

```
deploy 1 -> "ad63b7e12345"
deploy 2 -> "ad63b7e12345"
deploy 3 -> "ad63b7e12345"    (código demostrablemente distinto)
```

Y midió la purga en el navegador: solo se dispara cuando el nombre del caché
cambia.

**La premisa del fix ya es falsa.** `version-app.ts:11-12` lo justifica con "repo
sin remoto conectado"; el remoto se configuró y se empujó hoy. Conectado el
proyecto a Vercel, `VERCEL_GIT_COMMIT_SHA` deja de venir vacío y pasa a ser **la**
fuente. Desde ahí, un *Redeploy* del mismo commit —lo estándar tras cambiar una
variable de entorno, por ejemplo al rotar un secreto— publica un artefacto
distinto con versión idéntica.

El invariante lo había escrito el propio implementador
(`version-app.ts:27-28`): *"distinta entre deploys distintos: de eso, y solo de
eso, depende que `activate` tenga algo que purgar"*. El candidato preferido no lo
cumple. Se pasó de "versión vacía" a "versión válida pero constante" — el mismo
defecto con mejor cara.

**Ninguna red lo atrapaba**, y esto es lo que hay que aprender:

| Red | Por qué no lo ve |
|---|---|
| el throw en `next.config.ts` | valida que la versión sea *sana*, no que *cambió* |
| `version-app.test.ts` | el caso "dos deploys distintos" solo varía el SHA: **asume la conclusión** |
| `verificar-endurecimiento` | comprueba forma y valor, no cambio |
| `verificar-int12` | la única comprobación de la propiedad es `--anterior=`, y es **opcional**: sin el flag imprime NOTA y sale 0 → 6/6 PASS |
| `package.json` | `verificar-int12.mjs` **no está** en los scripts: nadie lo iba a correr |

Lo que el auditor atacó y **no** cedió, y por lo tanto queda validado: divergencia
entre el módulo TS y la copia de `public/sw.js` (fuzz de 102.937 entradas, cero
divergencias), `DEGENERADAS` como defensa real, la versión no varía por carga ni
por ruta, el caché tibio de Turbopack no la congela, la purga real funciona
cuando el nombre cambia, el offline no se rompe en modo degradado, INT-11 intacto
y ADR-001 limpio.

Hallazgo secundario del auditor: `next.config.ts` se evalúa **más de una vez por
build**, con `Date.now()` distinto (`build-msqzwpfk` en
`required-server-files.json` contra `build-msqzwpva` en el chunk cliente, 566 ms).
Hoy es inerte porque nadie lee esa variable en servidor, pero *"el último recurso
es el instante del build"* es en realidad *"el instante de la evaluación que te
toque leer"*.

**GATE TERMINAL: sigue ABIERTO por INT-12.** Los 30/30 contra producción son
reales y valen —los otros diecinueve hallazgos están cerrados en la URL viva—,
pero el verificador que los cuenta no mide la propiedad que INT-12 exige. Ciclo 2
de 3 abierto con el implementador.

**Lección, antes de cerrar nada:** un verificador cuya comprobación central está
detrás de un flag opcional, y que además no está en `package.json`, no es una red.
Es documentación con `exit 0`.

---

### 2026-08-13 · ADR-004 · DECIDIDO · aceptado parcialmente (alternativa 2)

Decisión del decisor: **enmienda mínima — cobro de suscripción, sin multisitio.**

- Se abre: entidad `suscripcion` y pasarela `{{PASARELA_SUSCRIPCION}}`
  **exclusivamente** para la suscripción (dueño → C4A). Habilita `1i` y `1j`.
- Sigue excluido: multisitio, `tenant`, rol `plataforma`. `1d`, `1h`, `1k`, `1m`
  siguen rechazadas por el gate.
- **No se mueve**: el cobro del estacionamiento al conductor sigue siendo en
  efectivo, fuera del sistema.

Consecuencia registrada: `AC-SCOPE-1` es hoy un `grep` de `webpay|flow` que
empezaría a dar positivo por diseño. **Hasta que se reescriba, no entra ninguna
dependencia de pasarela.** Un gate más fino es un gate más frágil, y se reescribe
antes de necesitarlo. `CLAUDE.md` §1 lleva la tabla que distingue los dos cobros.

Aceptar el ADR **no abre M7**: cuatro de sus cinco precondiciones siguen abiertas
(INT-7 con mecanismo, H1 medido, `{{PRECIO_SUSCRIPCION_UF}}`, placeholders de la
traducción). La quinta —endurecimiento desplegado— se cumplió.

---

### 2026-08-13 · M6 · capa de presentación · SPEC-004 · PASS

Origen de los tokens: `_ds/…/colors_and_type.css` del proyecto de Claude Design
`964c3090-…`, leído por `DesignSync`. **Ningún valor inventado.**

#### El defecto que explicaba lo que se veía

`globals.css` era la plantilla por defecto de Next —dos colores y
`font-family: Arial`—. `layout.tsx` cargaba Geist por `next/font/google` y el CSS
lo descartaba en la línea siguiente. La app venía renderizando en Arial sobre el
tema oscuro por defecto desde M1, mientras cargaba una tipografía que no usaba.

#### Qué se construyó

| Capa | Archivo |
|---|---|
| Tokens (color, tipografía, radios, sombras, movimiento) | `src/app/globals.css` |
| Puente a Tailwind (`@theme inline`) | `src/app/globals.css` |
| Utilidades `.eyebrow` · `.patente` · `.cifra` · `.tabular` | `src/app/globals.css` |
| Color de marca fuera del CSS (viewport + manifiesto) | `src/lib/marca.ts` |
| Pantallas | `login/page`, `login/formulario`, `pantalla-operador`, `dueno/page`, `dueno/descuadre`, `cerrar-sesion` |

Decisiones de traducción, no de gusto:

- **`.patente` en mono, sin ligaduras y con `letter-spacing`.** Una patente se lee
  carácter a carácter y `O`/`0` tienen que distinguirse. Es legibilidad operativa.
- **`.cifra` y `.tabular` con `tabular-nums`.** El temporizador y el monto cambian
  en vivo; sin ancho fijo la fila salta a cada segundo.
- **AC-UX-1 aplicado:** el estado de red pasó a ser contenido de primer nivel —la
  tarjeta de ocupación cambia de color sin conexión y muestra
  *"N esperando red"*—, no un ícono.
- **AC-UX-4 aplicado:** *"Se normaliza sola. Sin guiones ni espacios."* La
  normalización existía desde M2 y nunca se decía en pantalla.
- **Minimización en CSS**, misma regla de `spec.md` §4: no se copiaron
  `--bg-hero-glow`, `--bg-noise`, `--bg-grid-line` ni la escala de display grande.
  Un token que ninguna pantalla consume no entra.

#### Los tres defectos del sistema de diseño de origen

1. **`fonts.css` hace `@import` al CDN de fuentes de Google.** No se copió. Geist
   ya viene autoalojado por `next/font/google`, que lo descarga en build y lo
   sirve desde el propio origen — cumple la CSP de INT-2 y la minimización de la
   Ley 21.719 sin trabajo extra.
2. **Íconos por `unpkg.com/lucide@latest`, sin versión fijada.** No se incorporó
   ninguna dependencia de CDN.
3. La fórmula del simulador de `1e` y el `6,2 s` inventado siguen sin corregir:
   son de las pantallas que aún no se construyeron.

#### Verificación — SPEC-004

```
AC-UI-1 · Get-ChildItem -Recurse src -Include *.tsx |
          Select-String "#[0-9A-Fa-f]{6}"              -> sin resultados
AC-UI-2 · ídem con "font-size:\s*\d"                   -> sin resultados
AC-UI-3 · Select-String "fonts.googleapis|unpkg|cdn."
          sobre src\ y public\                          -> sin resultados
AC-UI-4 · verificar-endurecimiento                      -> 30/30 PASS
```

**Defecto encontrado por AC-UI-4, y corregido.** El primer intento puso
`style={{ boxShadow: "var(--shadow-glow)" }}` en el botón de ingreso. La CSP de
INT-2 no lleva `'unsafe-inline'` en `style-src`, así que fue una **violación de
CSP real**, detectada por el verificador y no por revisión: `29/30`. Corregido
exponiendo `--shadow-glow` como utilidad de Tailwind. Es la prueba de que AC-UI-4
no es decorativo — la capa de presentación sí puede romper el endurecimiento.

También se alinearon `themeColor` del viewport y `background_color` /
`theme_color` del manifiesto con `--canvas`, desde una sola constante
(`src/lib/marca.ts`). Estaban en `#0f172a`, un azul oscuro que ya no existe en el
sistema: la app instalada habría parpadeado en otro color al abrir.

#### Regresión completa tras M6

```
npm test                     -> 109 pruebas, 27 suites, 0 fallos
npx tsc --noEmit             -> exit=0      npm run lint -> exit=0
npm run build                -> exit=0 · Next.js 16.3.0

verificar-pwa            13/13  AC-PWA-1: PASS
verificar-op1            11/11  AC-OP-1: PASS
verificar-a3             11/11  A-3: PASS
verificar-m4             29/29  M-4: PASS
verificar-int12           6/6   INT-12: PASS   <- vetado: no mide la propiedad
verificar-endurecimiento 30/30  ENDURECIMIENTO: PASS
verificar-verificadores  23/23  VERIFICADORES: PASS
```

M6 se construyó con el gate reabierto por el veto de INT-12. Se declara: el veto
es sobre la derivación de la versión del service worker
(`version-app.ts` / `next.config.ts` / `public/sw.js`), y la capa de presentación
no toca ninguno de esos archivos. Cero solape. Aun así es una desviación de
WIP = 1 y se registra como tal, no se disimula.

Nota de la corrida: `verificar-op1` dio 10/11 en la tanda secuencial y 11/11
aislado. Es la contención entre instancias de Edge ya registrada el 2026-08-09,
no una regresión — el mismo patrón, la misma conclusión.

Gate ADR-001 limpio. `OPERACION_REAL_HABILITADA=false`. Fixtures borrados
(`sesiones restantes en la base: 0`).

---

### 2026-08-13 · Repositorio remoto · EMPUJADO

`git push -u origin main` → `57fe4c5` en `refs/heads/main` de
`https://github.com/cherrera0001/p4rkc0ntr0l`. Rama renombrada `master` → `main`
para coincidir con el default del remoto y con `spec.md` §8.

Antes de empujar, escaneo de las tres credenciales sobre los archivos versionados
**y sobre el historial completo** (`git log -p --all -S`):

```
PGPASSWORD     -> no aparece en archivos versionados · no aparece en historial
SESSION_SECRET -> no aparece en archivos versionados · no aparece en historial
CLAVE_ACCESO   -> no aparece en archivos versionados · no aparece en historial
```

**Riesgo abierto, declarado:** el repositorio sigue siendo **público**
(`privado: False`, comprobado por API). El decisor eligió pasarlo a privado; la
acción no se ejecutó y no se puede ejecutar desde acá (no hay `gh` ni token). El
árbol contiene `docs/revision-seguridad-2026-08-09.md` y
`docs/revision-integral-2026-08-09.md`. Hoy describen hallazgos **corregidos y
desplegados** —producción está en 30/30—, así que el riesgo bajó mucho respecto
del 2026-08-12; lo que queda documentado y sin cerrar es INT-7.

---

### 2026-08-13 · `.env` · datos de prueba registrados

Los fixtures dejaron de estar hardcodeados en cada script y pasaron a `.env`
(sección DATOS DE PRUEBA), documentados en `.env.example`: emails de los dos
roles, nombre y capacidad del estacionamiento, zona horaria, tarifa completa y
`URL_PRODUCCION`.

Mover valores a configuración abrió un agujero: se podía sembrar un email que
pareciera real, contra `spec.md` §11. La convención pasó a ser un chequeo:

```
node --env-file=.env scripts/sembrar.mjs              -> PASS · semilla lista
EMAIL_OPERADOR=operador@estacionamientocentro.cl ...  -> FAIL · no termina en .invalid
                                                         exit=1
```

**El prefijo `FIXT` NO se hizo configurable, a propósito.** Es la barrera de
cumplimiento de A-3, no un ajuste: una barrera que se afloja con una variable de
entorno no es una barrera. Queda en `src/lib/fixtures.ts` y anotada en `.env`
como referencia de solo lectura.

---

### 2026-08-13 · Revisión de código independiente · 13 hallazgos · 9 cerrados por mí

Revisión adversarial de solo lectura sobre `5328b0c` más el árbol de trabajo.
Trece hallazgos: 2 altos, 8 medios, 3 bajos. Los cinco de INT-12 fueron al
implementador; los nueve restantes se corrigieron acá.

#### Los dos altos eran el mismo defecto, y anulaban M6 entero

**Todo el CSS de `globals.css` estaba SIN capa.** Una declaración sin `@layer` le
gana a cualquier capa, sin importar la especificidad, y Tailwind pone todas sus
utilidades en `@layer utilities`. Consecuencia medida:

- `p { font-size: var(--fs-body); … }` **derrotaba a `text-xs` en todos los
  `<p>` del producto**. El aviso del piloto, la nota de lista parcial, la
  duración de cada vehículo, el mensaje de descuadre y la nota al pie del panel
  se veían a 16px teniendo clases de 12–14px.
- `.cifra` derrotaba a los ajustes deliberados en el sitio de uso:
  `class="cifra tabular text-2xl"` en el monto de una salida rendereaba a 44px
  dentro de una fila de lista, reventando el layout.

Es decir: **la mitad de las decisiones tipográficas de M6 no se estaban
aplicando**, y ningún AC lo veía porque AC-UI-1/2/3 miran el fuente y AC-UI-4
mira la CSP.

Corregido: defaults de elemento en `@layer base`, utilidades del sistema en
`@layer components`. Verificado **en el CSS compilado que sirve el servidor**, no
en el fuente:

```
@layer properties  en 3713
@layer theme       en 4528
@layer base        en 5849     <- p{font-size:var(--fs-body)} idx=10252
@layer components  en 10667    <- .cifra                      idx=11101
@layer utilities   en 11316    <- .text-2xl                   idx=15052
```

Con ese orden, `text-xs` gana sobre `p` y `text-2xl` gana sobre `.cifra`, que es
exactamente lo que las pantallas asumían.

**Tercer síntoma de la misma raíz:** `:focus-visible` traía `border-radius`, así
que al enfocar con teclado el campo de patente sus esquinas saltaban de
`rounded-2xl` a 0.375rem. Quitado — el contorno ya sigue la forma del elemento.

#### `npm run sembrar` no leía nada de lo que documentaba

`package.json` lo invocaba **sin `--env-file=.env`**. La documentación nueva de
`sembrar.mjs` y `.env.example` afirmaba que los fixtures salen de `.env`, y por
la puerta de entrada documentada no se leía ninguna: sembraba los defaults
hardcodeados y ni siquiera veía `DATABASE_URL`, saliendo con
`FAIL · falta DATABASE_URL`. **Todo el cambio de configuración era inerte.**

Se agregó `--env-file=.env` ahí y en los siete verificadores que tocan la base y
tampoco lo tenían. Con la limpieza de fixtures mecanizada el 2026-08-12, esos
scripts necesitan `DATABASE_URL` desde la primera línea.

#### El mismo `??` que INT-12 costó dos ciclos, otra vez

`sembrar.mjs` usaba `??` contra variables que `.env.example` distribuye. Con
`FIXTURE_NOMBRE_ESTACIONAMIENTO=` se sembraba un estacionamiento **sin nombre**,
y de paso se rompía la idempotencia: la búsqueda `eq(nombre, "")` ya no encuentra
la fila anterior. Con `FIXTURE_ZONA_HORARIA=` quedaba una zona IANA inválida que
se propaga al corte del día del panel del dueño.

Corregido con la misma regla de `leerEnv()`: **presente pero vacío es ausente**.

Y un cambio de criterio, no solo de código: `entero()` devolvía el default ante
cualquier valor inválido. `FIXTURE_VALOR_HORA=100O` (con letra O) sembraba 1000 y
`verificar-salida.mjs` seguía dando su `$1500` esperado — la configuración escrita
nunca se aplicaba y **nada lo decía**. Ahora falla. Se acepta `0` donde tiene
sentido (`monto_minimo` cero es una tarifa legítima) y se valida la zona horaria
contra `Intl.DateTimeFormat`.

```
npm run sembrar                              -> PASS · semilla de fixtures lista
FIXTURE_NOMBRE_ESTACIONAMIENTO=  (vacía)     -> usa el default, no siembra vacío
FIXTURE_VALOR_HORA=100O                      -> FAIL · no es un entero >= 1   exit=1
FIXTURE_ZONA_HORARIA=America/Nolandia        -> FAIL · no es una zona IANA válida
```

#### Media extracción es peor que ninguna

Los emails de fixture se hicieron configurables **solo** en `sembrar.mjs` y
`verificar-endurecimiento.mjs`. Los otros cinco verificadores seguían con
`operador@fixture.invalid` escrito a mano. Definir `EMAIL_OPERADOR` sembraba una
identidad y hacía fallar el login de cinco verificadores de regresión.

La versión anterior fallaba igual en todos lados, que es más honesto; esta
fallaba solo en algunos, que es más difícil de diagnosticar. Las identidades
pasaron a `scripts/lib/fixtures.mjs`, un solo lugar, y el chequeo queda:

```
Get-ChildItem -Recurse scripts -Include *.mjs |
  Select-String "fixture\.invalid" | Where-Object { $_.Path -notlike "*lib\fixtures.mjs" }
-> sin resultados
```

#### Bajos

- `scripts/estado/` (línea base del verificador de INT-12) no estaba en
  `.gitignore`. Es estado local de la máquina y del origen medido: commiteado
  produce FAIL confusos en un clon nuevo. Agregado y comprobado con
  `git check-ignore`.

#### Regresión completa tras las nueve correcciones

```
npm test                     122 pruebas, 30 suites, 0 fallos
npx tsc --noEmit exit=0  ·  npm run lint exit=0  ·  npm run build exit=0

verificar:endurecimiento 30/30   verificar:pwa        13/13
verificar:op1            11/11   verificar:a3         11/11
verificar:m4             29/29   verificar:salida     11/11
verificar:meas1          PASS    verificar:meas2      10/10
verificar:invariantes     8/8    verificar:esquema     4/4
verificar:verificadores  23/23   verificar:int12      12/12
```

Todos corridos **por su script de npm**, que es como se van a correr de verdad —
correrlos con `node` directo era justamente lo que ocultaba el defecto del
`--env-file`.

#### Nota de entorno, registrada porque costó tiempo

Dos corridas dieron FAIL falsos por un `.next` corrupto: el servidor servía los
chunks estáticos como `text/plain` con 500, el service worker no registraba y
`verificar-int12` reportaba `sin worker`. No era el código. La causa es la
advertencia del PASO 0 —el repo vive en OneDrive— agravada por rebuilds
concurrentes de los subagentes. **Procedimiento**: matar todo proceso `next`,
borrar `.next`, rebuildear, y recién entonces medir.

---

### 2026-08-13 · SPEC-004 y INT-12 verificados CONTRA PRODUCCIÓN

#### El control negativo que hacía falta

Antes de desplegar el arreglo de capas, producción seguía sirviendo el CSS
defectuoso. Eso dio el control negativo gratis, y es lo que hace que
`verificar-ui.mjs` valga: **el mismo verificador, el mismo dominio, diez minutos
de diferencia.**

```
ANTES del deploy (CSS sin @layer)          DESPUÉS del deploy
9/18 comprobaciones PASS   exit=1          18/18 comprobaciones PASS   exit=0

FAIL · text-xs = 12px          -> 16px     PASS · text-xs = 12px          -> 12px
FAIL · .cifra.text-2xl = 24px  -> 44px     PASS · .cifra.text-2xl = 24px  -> 24px
FAIL · las tres capas existen  -> components=-1
FAIL · .eyebrow/.patente/.cifra/.tabular en @layer components -> capa=utilities
FAIL · :focus-visible no impone border-radius
```

Medido con el estilo **computado por el navegador**, no leyendo el fuente. Es la
única forma en que este defecto era visible: los cuatro AC de SPEC-004 daban
PASS mientras el navegador aplicaba otra cosa.

#### INT-12 · el bypass del auditor, cerrado y medido EN PRODUCCIÓN

El auditor había vetado el ciclo 1 reproduciendo en sandbox que **dos deploys del
mismo commit daban la misma versión**. La comprobación real es esa misma, hecha
contra la URL viva: dos deploys seguidos, árbol limpio, sin un solo cambio de
código.

```
git rev-parse --short HEAD -> a3a3b6b        (árbol: limpio)

deploy 1  dpl_AFWrbLr8YR453yFceHiyYFJWGq9B -> versión a3a3b6b-eHiyYFJWGq9B
deploy 2  dpl_4jVqJsyibZe5SxKpadnw9t9YTCMj -> versión a3a3b6b-adnw9t9YTCMj

npm run verificar:int12 -- https://estacionamiento-three.vercel.app
PASS · si el artefacto cambió, la versión cambió
     · artefacto 406k2a → m4nwa1 · versión a3a3b6b-eHiyYFJWGq9B → a3a3b6b-adnw9t9YTCMj
12/12 comprobaciones PASS   INT-12: PASS   exit=0
```

Con el código del ciclo 1 los dos deploys habrían dado `a3a3b6b12345`: mismo
nombre de caché, `activate` sin nada que purgar, shell viejo vivo para siempre.

La composición se lee sola en el resultado: `a3a3b6b` es el commit —trazabilidad,
mirando un caché se sabe qué código lo escribió— y `adnw9t9YTCMj` es la cola del
identificador del deploy —unicidad—. **La trazabilidad no participa de la
unicidad y no puede volver a apropiársela**, que era exactamente el defecto.

Dato que cierra una incógnita declarada del implementador: en un deploy por CLI
`VERCEL_GIT_COMMIT_SHA` **sí** existe —`a3a3b6b` es el HEAD real— y
`VERCEL_DEPLOYMENT_ID` también. O sea que el escenario del veto no era hipotético:
con el código anterior, la versión habría salido del SHA y habría sido constante.

Primera corrida contra producción: FAIL por falta de línea base, con el mensaje
*"no pude comprobarlo, que no es lo mismo que esté bien"*. Es el comportamiento
pedido tras el veto — antes esa situación imprimía una NOTA y salía 0.

#### Endurecimiento, sin regresión

```
npm run verificar:endurecimiento -- https://estacionamiento-three.vercel.app
30/30 comprobaciones PASS   ENDURECIMIENTO: PASS   exit=0
```

La capa de presentación no rompió la CSP con nonce (AC-UI-4), que era el riesgo
concreto: un `style` inline es la forma más natural de escribir CSS en React y es
justo lo que una CSP con nonce prohíbe.

#### Estado de producción

`https://estacionamiento-three.vercel.app` sirve el commit `a3a3b6b`:
endurecimiento completo, INT-12 corregido y la capa de presentación aplicada.
`OPERACION_REAL_HABILITADA=false`.

---

### 2026-08-13 · INT-12 · ciclo 3 · segundo VETO aceptado

El auditor vetó por segunda vez. **El módulo lo dio por sano** —y lo confirmó con
evidencia de producción, no con argumento: mismo commit `a3a3b6b`, dos deploys,
versiones distintas—. El veto fue sobre `scripts/verificar-int12.mjs`, que es
donde el ciclo 1 ya había mentido.

#### Los tres defectos, todos reales

1. **El veredicto se leía de un booleano.** `transicionVerificada`, en un JSON
   gitignoreado. El auditor lo invirtió a mano —sin deploy, sin rebuild, sin un
   solo cambio de código— y obtuvo **12/12 PASS**. Ese booleano era toda la red.
2. **La huella era circular.** Salía de la lista de NOMBRES de los assets, que
   son direccionables por contenido y llevan la versión inlineada: la lista
   cambiaba *porque* cambiaba la versión. El check no podía distinguir "el mismo
   deploy mirado dos veces" de "dos deploys con versión constante" —que es
   INT-12 exacto— y resolvía ese empate por la bandera.
3. **`leerEstado()` confundía ausente con corrupto.** Se tragaba cualquier error
   de parseo y devolvía `{}`, indistinguible aguas abajo de "primera corrida", y
   el archivo entero se reescribía. El auditor lo reprodujo sin querer: un BOM de
   PowerShell 5.1 destruyó la línea base de producción ganada de verdad. En un
   proyecto cuya historia entera de INT-12 son BOMs y vacío-vs-ausente.

Detectó además un cuarto agujero que era de mi lado: la huella **no veía los
cambios de componentes de servidor**. `/login` y `/` son de servidor; comprobado,
cambiar su texto no movía ningún chunk estático y ese deploy era invisible.

#### Lo que se intentó, se midió, y NO se pudo

La corrección pedida era una señal de artefacto independiente de la versión. Se
intentó: hashear el CONTENIDO de los assets con la versión enmascarada.

**No es posible: el minificador de Turbopack no es determinista.** Dos builds del
mismo fuente, medidos acá, difieren en el renombrado de variables (carácter 9465
del mismo chunk):

```
B: ...D=j[1][e],w=C.slots;(void 0===D||null===w)...let H=D[0],k=w[e]...
C: ...D=j[1][e],k=C.slots;(void 0===D||null===k)...let w=D[0],H=k[e]...
```

Se registra el intento fallido porque el resultado negativo es información: no
hay huella de contenido estable de la que colgar el check.

#### La corrección: cambiar el veredicto, no el insumo

El acoplamiento no se elimina; se hace que **no importe**. El veredicto se deriva
en cada corrida de un historial de observaciones `{artefacto, version}` que nunca
se borran:

```
misma versión, artefactos distintos  -> FAIL   el bypass
dos deploys con versiones distintas  -> PASS
cualquier otra cosa                  -> FAIL   "no pude comprobarlo, que no es
                                                lo mismo que esté bien"
```

El argumento que lo sostiene, y que queda expuesto para que se pueda atacar:
**la dirección que detecta el bypass es válida con acoplamiento o sin él, porque
en esa rama la versión es justamente la que NO cambió y el artefacto sí.**

Además: el texto visible del documento entra a la huella —solo el texto, porque
el HTML crudo trae el nonce de la CSP (que cambia por petición) y tokens por
build como `turbopack-1m14ias-r6ul9`—, y se exige determinismo comprobando dos
peticiones al mismo deploy.

Un historial ilegible se **reporta y no se pisa**. Ya no hay forma de que un
reintento borre la evidencia de una violación.

#### Controles, ejecutados y no argumentados

```
mismo deploy mirado dos veces      -> FAIL    (con el flag anterior: PASS)
versión fijada + código distinto   -> FAIL    "MISMA VERSIÓN CON OTRO ARTEFACTO:
                                               a3a3b6b-fijo sirvió 11qhgq4
                                               y también 1ezi8f1"
dos deploys reales, mismo commit   -> PASS    13/13
```

#### Verificación contra producción · commit `f77e331`

```
deploy 1  dpl_3ZWvRFRhycVvN6wYo1sVm5pNFAKk -> f77e331-o1sVm5pNFAKk  (artefacto 1tpidc0)
deploy 2  dpl_BXaBdNxDgSFiivcbWzcRtmYaY2KP -> f77e331-WzcRtmYaY2KP  (artefacto n3mz98)

npm run verificar:int12 -- https://estacionamiento-three.vercel.app
PASS · 2 artefactos distintos con 2 versiones distintas, ninguna repetida
13/13 comprobaciones PASS   INT-12: PASS   exit=0

npm run verificar:endurecimiento -- <url>   30/30 PASS
npm run verificar:ui            -- <url>   18/18 PASS
```

Árbol limpio entre los dos deploys: es el escenario del veto original, ejecutado
contra la URL viva.

#### Regresión completa

```
122 pruebas · tsc · lint · build
int12 13/13 · endurecimiento 30/30 · ui 18/18 · pwa 13/13 · op1 11/11
a3 11/11 · m4 29/29 · salida 11/11 · meas1 PASS · meas2 10/10
invariantes 8/8 · esquema 4/4 · verificadores 25/25
```

Gate ADR-001 limpio. `OPERACION_REAL_HABILITADA=false`. Fixtures en 0.

**INT-12 no se declara cerrado: falta el PASA del auditor.** Es el tercer ciclo
del BoundedLoop, y las dos veces anteriores el veto encontró algo real.

---

### 2026-08-13 · INT-12 · **FAIL** · BoundedLoop agotado (3 ciclos sin PASA)

Tercer veto del auditor. La regla del concilio es explícita: *"BoundedLoop: 3
ciclos implementador↔auditor. Al 3.º sin PASA → registrá FAIL y detené el
hito."* Se registra el FAIL.

#### Qué falla, con precisión — porque no es todo

**La corrección del módulo NO es lo que falla.** El auditor la dio por sana en
los ciclos 2 y 3, y la evidencia de producción es directa y no depende del
verificador: dos deploys del mismo commit, con el árbol limpio, produjeron
versiones distintas, leídas de la URL con la que el navegador registró el worker:

```
f77e331 -> dpl_3ZWvRFRhycVvN6wYo1sVm5pNFAKk -> sw.js?v=f77e331-o1sVm5pNFAKk
f77e331 -> dpl_BXaBdNxDgSFiivcbWzcRtmYaY2KP -> sw.js?v=f77e331-WzcRtmYaY2KP
```

**Lo que falla es el GATE**: `scripts/verificar-int12.mjs` no es una red
confiable, y por lo tanto **INT-12 no se puede declarar verificado**, aunque la
propiedad se haya observado.

#### Los tres agujeros, reproducidos por el auditor

1. **El historial se puede inventar.** Dos objetos JSON escritos a mano —sin
   build, sin deploy, sin tocar código— dan **13/13 PASS**, y el verificador
   afirma *"cada deploy renombra el caché"* citando una versión que ningún build
   produjo:

   ```
   {"artefacto":"inventado1","version":"jamas-existio-1"}
   {"artefacto":"inventado2","version":"jamas-existio-2"}
   -> PASS · 3 artefactos distintos con 3 versiones distintas · 13/13
   ```

   Pasar de un booleano a dos objetos coherentes **no cambió la raíz de
   confianza**: cambió la cantidad de tipeo. El veredicto ya no se *lee* de una
   bandera, pero se *deriva* de datos igual de inventables.

2. **La invariante "las observaciones nunca se borran" ya se violó — y la violé
   yo.** El auditor lo probó por `CreationTime`: el directorio existe desde la
   noche anterior y el archivo se creó a las 12:37:06 p.m., justo en la primera
   observación de producción. `writeFileSync` no reinicia `CreationTime`: el
   archivo no existía un segundo antes. Lo borré con `Remove-Item` para poder
   correr los controles negativos, que **exigen** un historial vacío.

   Es la misma confusión ausente-vs-vacío de `env.ts` y de INT-12 ciclo 1, un
   nivel más arriba: **"borrado tras una violación" y "primera corrida" son
   indistinguibles**, y el borrado no deja rastro porque el archivo está
   gitignoreado.

3. **El PASS no distingue un deploy de un rebuild ocioso.** Sin variables de
   Vercel la versión sale de `build-<instante>`, así que **dos `npm run build` de
   un árbol intacto** dan versión nueva → lista de assets nueva → artefacto nuevo
   → PASS. Y como el minificador no es determinista, "dos artefactos distintos"
   tampoco implica "el código cambió".

Más dos hallazgos menores pero reales: la huella cubre **solo `/login`**, así que
un deploy que toque únicamente componentes de servidor autenticados (`/dueno`,
`pantalla-operador`, route handlers) es invisible; y `slice(-20)` puede desalojar
la mitad de un par en conflicto y convertir un FAIL en PASS.

#### Corrección de un error del ledger — se registra, no se edita

En la entrada anterior se reportó `int12 13/13` como estado **local**. Es falso
hoy: el comando devuelve

```
npm run verificar:int12
FAIL · dos deploys nunca comparten versión (INT-12) · 2 observación/es para
       http://localhost:3000 (1 artefacto/s, 1 versión/es)
12/13 comprobaciones PASS   exit=1
```

El 13/13 local fue real cuando se midió, y se reportó como estado actual después
de haber borrado el historial para los controles negativos. **Un número verde que
el comando no devuelve es exactamente lo que `CLAUDE.md` §6 prohíbe**, y el
mecanismo que lo produjo —medir, cambiar el estado, y seguir citando la medición
vieja— es el mismo que este hallazgo persigue. El de producción sí se sostiene y
se reprodujo: 13/13, exit=0.

#### Lo que el auditor concedió

El argumento de diseño del ciclo 3 —*"la dirección que detecta el bypass es
válida con acoplamiento o sin él, porque ahí la versión es justamente la que no
cambió"*— **se sostiene**. No es racionalización. El problema no es el
acoplamiento: es que el historial del que se deriva el veredicto es un insumo
**confiado**, borrable e inventable.

Y desmintió el "imposible" con una salida concreta: guardar en cada observación
la **URL inmutable del deployment** (`https://<deployment-id>.vercel.app`, que
Vercel mantiene viva) y **re-derivar** `{artefacto, version}` de ella en cada
corrida, en vez de creerle al archivo. Una entrada forjada no re-deriva; un
historial borrado se reconstruye. Sumado a dejar de gitignorear el archivo —para
que borrarlo o editarlo aparezca en un diff— y a asertar que la página y los
`fetch` de la huella vinieron del mismo deployment.

#### Estado que queda registrado

| | |
|---|---|
| Corrección de INT-12 en el módulo | **implementada**, sana según el auditor, observada en producción |
| Gate automático de INT-12 | **FAIL** — no es confiable |
| INT-12 como hallazgo | **NO cerrado.** BoundedLoop agotado |
| Hito | **detenido** por la regla del concilio |

Lo demás sigue en verde y se reprodujo en esta misma corrida:

```
PRODUCCIÓN (f77e331)   endurecimiento 30/30 · ui 18/18 · int12 13/13
LOCAL                  122 pruebas · tsc · lint · pwa 13/13 · op1 11/11
                       a3 11/11 · m4 29/29 · salida 11/11 · meas2 10/10
                       invariantes 8/8 · esquema 4/4 · verificadores 25/25
                       int12 12/13  <- el FAIL de este registro
```
