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

---

### 2026-08-13 · Fundación de datos y auditoría spec-driven · FASES 0–2

Loop de documentación derivada. **No se tocó `src/`.** INT-12 sigue en FAIL y M6
sigue detenido: este loop no cambia ninguno de esos dos veredictos.

#### FASE 0 · Inventario — `docs/data/inventario.md`

Las 4 entidades y sus 27 campos, cada uno con cita `archivo:línea`.

**Lo que coincide:** `sesion_vehiculo` tiene exactamente los 11 campos de
`spec.md` §4 — cero de más, cero de menos. Ídem `estacionamiento` (5), `tarifa`
(6) y `usuario` (5). Las entidades prohibidas por ADR-001 no existen.

**Cuatro derivas reales, registradas:**

1. **Constantes de operación sin lugar en `spec.md`**: vigencia de sesión 12 h
   (`src/lib/sesion-token.ts:30`), permanencia máxima 30 días
   (`src/lib/tiempo.ts:48`), desfase ignorable 2 s, redondeo neutro del monto,
   prefijo `FIXT`. Ninguna se propone incorporar: fijar un umbral es DECISIÓN.
2. **`spec.md:150` promete algo que el esquema no puede cumplir.** *"Vencido el
   plazo, la patente se elimina o se enmascara"* — `patente` es `NOT NULL`
   (`src/db/schema.ts:116`). El enmascaramiento **no es implementable** sin
   migración, y no existe mecanismo de purga. Es INT-7.
3. **`spec.md` §8 pide deploy por `git push`** y corre por CLI de Vercel.
4. **La asimetría offline no está escrita.** El ingreso funciona sin red; la
   salida no. Vive en el ledger y en AC-UX-3, no en `spec.md` §5.

#### FASE 1 · Modelo derivado

`MER.md`, `MR.md`, `casos-uso.md`, `flujos.md`. Cada entidad, atributo y
transición trazada al esquema o al código.

Decisiones que conviene no perder:

- **Ninguna relación M:N, y es deliberado.** La candidata natural —una tabla
  `vehiculo`— se descarta por **minimización**: construiría un historial de
  movimientos de una persona identificable que ninguna hipótesis necesita y que
  la Ley 21.719 obligaría a justificar. La patente vive como atributo de la
  sesión.
- **`monto_calculado` es derivable y aun así no viola 3NF.** No depende de otro
  atributo no-clave de su fila —depende de otra relación— y sobre todo **es un
  hecho histórico**: el monto que se cobró en efectivo ocurrió. Recalcularlo con
  otra tarifa daría un número distinto del que se cobró.
- **La desnormalización que NO se hizo, con su costo.** `sesion_vehiculo` no
  registra con qué tarifa se calculó su monto. Es *inferible* replicando la
  consulta de `src/lib/contexto.ts:63` con `salida_at`, **mientras nadie inserte
  una tarifa con `vigente_desde` retroactivo** — que el esquema permite, porque
  no hay `CHECK` que lo impida. Con una tarifa retroactiva la inferencia devuelve
  una tarifa que no es la que se usó, y el sistema afirmaría un cálculo falso
  sobre un cobro real. La maqueta `1e` promete justo lo contrario.
- **No existe el estado `cerrada/local`.** El cierre requiere red por
  construcción: sin servidor no hay tarifa vigente y sin tarifa no hay monto. El
  diagrama lo vuelve estructural en vez de anecdótico.
- **`Rechazada` no toca disco.** No es un estado de la base: es el camino que
  garantiza que una patente real nunca se recolecta (A-3).

Dos candidatos **pasan** el gate H1/H2/obligación y quedan como deuda de modelo,
no como descarte: `sesion_vehiculo.tarifa_id` (H2, auditabilidad del monto) y
`usuario.estado` (operativa: hoy dar de baja a un operador exige borrar la fila y
la FK lo impide).

#### FASE 2 · Matriz medida — `docs/data/matriz-trazabilidad.md`

La columna *¿Verificado?* se pobló con **salida real**, capturada antes de
escribir la matriz:

```
verificar:esquema        4/4     verificar:endurecimiento  30/30
verificar:invariantes    8/8     verificar:ui              18/18
verificar:verificadores 27/27    verificar:pwa             13/13
verificar:citas         17/17    verificar:op1             11/11
verificar:salida        11/11    verificar:meas2           10/10
verificar:meas1        PASS      verificar:int12           13/13 (gate en FAIL)
```

Gate ADR-001: los tres `Select-String` sin resultados.

**Recuento:** 21 `E+C+V` · 1 `E+C+SV` (INT-12) · 6 `E+NC` (deuda) · 7 `C+NE`
(huérfanos) · 6 maquetas bloqueadas por multisitio · 2 habilitadas y bloqueadas
(`1i`/`1j`).

#### El hallazgo de fondo: H1 nunca se midió

Consultado contra la base, no razonado:

```
sesiones totales: 0 · cerradas: 0 · fixtures: 0
H1 · sesiones cerradas NO fixture: 0
H1 · mediana de tecleo: SIN DATOS
```

Estado: **ESPECIFICADO · INSTRUMENTADO · SIN DATOS**. Tres causas concurrentes:

1. la barrera de cumplimiento lo impide **por diseño** —y está bien que así sea:
   medir H1 de verdad exige resolver `{{BASE_LICITUD}}` y
   `{{PLAZO_RETENCION_PATENTE}}` primero;
2. los verificadores limpian lo que crean (`scripts/lib/fixtures.mjs`), así que
   ninguna corrida acumula evidencia;
3. **no existe la consulta** que agregaría la métrica: es la maqueta `1g`, no
   construida.

`spec.md` §1 dice que el proyecto existe para probar o refutar H1. No es una nota
al pie: es el hallazgo de fondo de esta auditoría.

#### Siete huérfanos verificados y sin AC

El endurecimiento completo (INT-2, C-1, A-1, B-2, INT-4, INT-8, INT-11, INT-14),
las invariantes de base, la capa de presentación, la barrera de datos reales, la
cota del reloj y los dos guards de verificación **se verifican con comando y
ninguno tiene AC en `spec.md` §9**. No están mal: están sin anclar, así que un
refactor podría eliminarlos sin violar ningún criterio escrito.

#### Guard nuevo: `scripts/verificar-citas.mjs`

`npm run verificar:citas` → 17/17. Comprueba que las **128 citas
`archivo:línea`** resuelvan, que los 5 bloques mermaid estén cerrados y declaren
tipo, y que ningún `{{placeholder}}` haya quedado con un valor asignado.

**Declara su límite en el propio docstring**: valida que la línea *exista*, no
que *diga* lo que la cita afirma. Por eso se muestrearon 18 citas a mano — y
encontraron **3 imprecisas** (`pantalla-operador.tsx:279` en vez de `:280`,
`:539` en vez de `:573`, `manifest.ts:9` en vez de `:11`), corregidas.

Un documento derivado que nadie revalida se desincroniza en el primer refactor y
pasa a describir un sistema que ya no existe, con el agravante de que sigue
*pareciendo* verificable.

#### Estado de este registro

Los artefactos están escritos y sus comandos dan verde. **Los veredictos de la
matriz y la propuesta de cambios a `spec.md` están en auditoría adversarial y no
se dan por firmes hasta su PASA.** `spec.md` sigue intacto.

Ningún `{{placeholder}}` se rellenó.

---

### 2026-08-13 · FASE 3 · PASO 0 · **DOS VETOS**, ambos aceptados

`spec.md` no se escribió. Los dos veredictos, textuales en lo esencial, antes de
tocar nada.

---

#### VETO 1 · Matriz de trazabilidad y documentos derivados

El auditor confirmó primero la procedencia: `git diff --stat 8c28d9a HEAD -- src`
vacío, así que las 128 citas apuntan a un `src/` que no cambió. Y confirmó lo que
**sí** se sostiene: la consulta de H1 mide lo que dice medir (`SIN DATOS` es
correcto), las tres BRECHAS son reales, el gate ADR-001 limpio, INT-12 reflejado
sin reabrirse, y §8 cierra aritméticamente.

Ocho hallazgos. Los tres bloqueantes:

**(1) Fila con estado falso.** *"Temporizador de permanencia · `verificar:meas2`
→ 10/10 · E+C+V"*. `verificar-meas2.mjs` tiene 10 comprobaciones y **ninguna toca
el temporizador**: compara ocupación, ingresos, cerradas, descuadre y separación
de roles. Nunca lee lo que produce `duracion()` (`src/app/pantalla-operador.tsx:75`).
Ningún otro comando lo verifica — tres comentarios en scripts, cero aserciones.

> *"Es el defecto exacto que describiste: el comando verifica una capacidad
> parecida (el panel del dueño, que también muestra números) y se acredita otra."*

**(3) Dos diagramas describen código que no existe.**

- `flujos.md` **se contradice a sí mismo**: el preámbulo dice que una sesión
  *"puede estar `cerrada` y `local`"* y doce líneas después dice que ese estado
  **no existe**. El código sostiene la segunda: `src/app/api/sesiones/route.ts:177`
  y `.../salida/route.ts:115` escriben ambos `syncEstado: "sincronizada"`.
- El camino `4xx → Descartada` **describe el bug que ya se corrigió**.
  `src/lib/cola-local.ts:276` define `esRechazoDefinitivo` como
  `status === 400 || status === 403`, y su docstring dice que tratar todo el 4xx
  como definitivo *"es pérdida de datos: un 401 por cookie caducada —o el 429 del
  límite de intentos previsto para C-1— vaciaba la cola del operador"*. Con la
  ráfaga de C-1 el 429 es un caso vivo.

**(5) Imposibilidad técnica mal atribuida, repetida en tres documentos.**
`MR.md`, `MER.md` e `inventario.md` afirman que enmascarar la patente *"no es
implementable sobre este esquema"* / *"exige migración"*. Falso:

> *"`patente` es `text NOT NULL` sin ningún CHECK de formato… el único índice
> único es parcial sobre `estado='activa'`, así que un centinela compartido en
> filas cerradas no colisiona. Y ninguna FK apunta a `sesion_vehiculo`.
> `UPDATE sesion_vehiculo SET patente='XXXXXX' WHERE estado='cerrada' AND
> salida_at < $plazo` cumple `spec.md:150` sin tocar el esquema."*

**Los tres documentos culpaban al esquema de un bloqueo que es de decisión.**
Lo que falta es `{{PLAZO_RETENCION_PATENTE}}`, `{{BASE_LICITUD}}` y el mecanismo
de purga — que es exactamente lo que INT-7 dice.

Los otros cinco: dos citas que resuelven y no sostienen lo que afirman
(`cola-local.ts:100` es `pendientes()`, no la transición; `pantalla-operador.tsx:228`
solo pinta el aviso); el argumento 3NF de `MR.md` §3 es **racionalización** —la DF
`{estacionamiento_id, entrada_at, salida_at} → monto_calculado` se cumple y su
determinante no es superclave, así que la razón formal es falsa y solo se
sostiene la razón histórica—; `usuario.estado` **no cierra el agujero con el que
se lo justifica**, porque la clave es compartida y suspender una fila no impide
entrar con otro email; `verificar:citas 15/15` en §0 **no reproduce** (hoy 17/17);
y **falta M-4 entero** en la matriz — 29 aserciones, verificador propio, ningún
AC, invisible tanto en capacidades como en huérfanos.

---

#### VETO 2 · Propuesta de cambios a `spec.md`

Siete bloqueantes. El primero invalida la evidencia de la propia propuesta.

**V1 · Los comandos de AC-SCOPE-1a/b/c no matchean nada. Nunca. Por sintaxis.**

En regex .NET, `\|` es **un pipe literal**, no alternancia. Reproducido acá:

```
Select-String -Path package.json -Pattern "next\|react"  ->  0 lineas
Select-String -Path package.json -Pattern "next|react"   ->  9 lineas
```

El auditor lo probó end-to-end con la pasarela plantada: un `package.json` con
`"stripe"` y `"transbank-sdk"`, y los tres paths de 1a importando `Stripe` /
`WebpayPlus`. Los comandos **verbatim** dieron vacío: **PASA con la pasarela
adentro**.

> *"Es la lección de AC-PWA-1 en su forma más grave: no un AC que no se puede
> correr, sino uno que reporta PASS incondicionalmente."*

**V2 · 1a es una lista blanca de 4 archivos.** Fuera de su alcance quedan
`src/lib/cola-local.ts`, `src/app/page.tsx`, `src/app/dueno/*`, `public/sw.js`
—el service worker puede cargar un script de pago sin tocar `src/`— y **cualquier
ruta nueva**: `src/app/api/cobro/route.ts` pasa por construcción. Hoy AC-SCOPE-1
guarda `package.json` a nivel repo; 1a lo reemplaza por cuatro archivos. **Es un
aflojamiento neto.**

**V3 · Al adoptar la pasarela la cobertura cae.** 1b se retira y 1c escanea solo
`src` y solo `webpay|flow|khipu`: pierde `stripe`, `mercadopago`, `transbank`.
`package.json` deja de estar vigilado por criterio alguno. Viola la condición
explícita de ADR-004: *"seguir rechazando inequívocamente el pago del conductor"*.

**V4 · `-Exclude suscripcion` no excluye lo que 1c cree.** Con `-Recurse`,
`-Exclude` saca el directorio del listado pero **igual emite sus archivos**.
Reproducido: `src\lib\suscripcion\webpay.ts` aparece. **1c falla exactamente en
el escenario para el que se escribió.**

**V5 · El texto de §5 especifica algo que no existe.** *"el cierre se reintenta"*
es falso: `src/app/pantalla-operador.tsx` solo hace `setError(...)` en el `catch`,
y `sincronizar()` únicamente postea los `pendientes()`, que filtra
`syncEstado === "local"`. Una salida fallida quedó `sincronizada`/`activa` y
**nunca vuelve a mirarse**. La frase viene de la maqueta. Es `ESPEC+NO_CONSTRUIDO`
—deuda con otro nombre— y el propio `casos-uso.md` de este loop lo dice bien.

**V6 · La verificación invocada no cubre la mitad offline.** `verificar-salida.mjs`
es e2e puramente en línea y `verificar-op1.mjs` tiene **cero ocurrencias de
"salida"**. Ningún comando verifica que la salida sin red degrade como se dice.

**V7 · Deja la spec contradiciéndose sola.** `spec.md:237` (§8) afirma que *"el
flujo del operador (§5) funciona sin conexión"*. Meter en §5 "la salida requiere
conexión" sin acotar §8 y §3 deja el documento afirmando A y ¬A.

**AC-DATA-2 · PASA**, y con el criterio que vuelve no-arbitraria la frontera:

> *"AC-DATA-2 restringe el modelo que `spec.md` §4 ya define. INT-2, C-1, A-1,
> B-2, INT-4, INT-8, INT-11, INT-14 afirman propiedades que `spec.md` nunca
> enunció. Escribirlas es autorar requisitos nuevos, no formalizar. El criterio
> es: **¿el AC hace exigible una afirmación que ya está en §1-§8, o introduce una
> afirmación nueva?**"*

Se acepta y se adopta como la regla del proyecto. Nit incorporado: el texto de
AC-DATA-2 omitía las invariantes de tarifa y la exigencia de que las
restricciones estén *declaradas*, que el comando sí verifica.

**AC-DATA-3 · VETO.** No es "discutible": `scripts/verificar-citas.mjs:44` falla
si `docs/data/` está vacío, así que meterlo en §9 convierte seis documentos
derivados de anteayer en **criterio de aceptación permanente de la v1**. Es el
subproducto del loop ascendiendo al contrato que el loop auditaba. El guard se
queda; el AC no entra.

Fuera de veto, un hallazgo de alcance: `spec.md` §8 y §10 **siguen diciendo
Neon** cuando ADR-003 movió la base a Railway. Abrir la spec por exactitud y
dejar el proveedor equivocado es inconsistente en el mismo commit.

---

#### Qué se hace con los dos vetos

La matriz **no es firme**. `spec.md` **sigue intacto**. Se corrigen primero los
documentos derivados (WIP=1), después se rehace la propuesta según el fallo —sin
reescribir a mano el criterio vetado— y ambas cosas vuelven a auditoría.

Regla que este loop deja adoptada, del propio veto:

> **Un gate que solo se probó contra un repo limpio no se probó.** Todo comando
> nuevo se corre **con el fallo plantado** antes de escribirse en `spec.md`.

---

### 2026-08-14 · FASE A · registrada con retraso · **hueco en el ledger, reconocido**

**Los dos últimos commits no estaban en este archivo.** `f98a652` y `b933ccb`
reescribieron `spec.md` §9, crearon el gate de alcance y corrigieron
`verificar-esquema.mjs`, y `grep "FASE A" LEDGER.md` daba **cero resultados**.
`STATE.md` tampoco los mencionaba.

La convención N°1 del proyecto —*nada se declara verificado sin comando y salida
en el ledger*— la incumplió el loop que endureció el gate. Se registra acá, con
la fecha real de la corrida (2026-08-14) y no con la del commit: fingir que se
había escrito el 13 sería exactamente la clase de historial inventado por la que
INT-12 quedó en FAIL.

#### Qué entregó FASE A (commits `f98a652` y `b933ccb`)

**AC-SCOPE-1 reescrito: de regex en una celda de tabla a script.** El VETO probó
que la forma anterior era **inejecutable**: el pipe va escapado (`\|`) para no
romper la tabla markdown, y en regex .NET `\|` es un pipe **literal**. Medido:
`Select-String "next\|react"` → 0 líneas; `"next|react"` → 9. El criterio
reportaba **PASS incondicionalmente**, incluso con `stripe` y `transbank-sdk`
plantados en `package.json`. *Un criterio que siempre pasa es peor que no tener
criterio.*

El reemplazo escanea **por exclusión** —toda la superficie del producto salvo la
frontera declarada `src/lib/suscripcion/`— en vez de enumerar archivos, porque
una ruta nueva (`src/app/api/cobro/route.ts`) evade cualquier lista blanca.

**El ciclo 3 cerró tres bypasses que el propio gate tenía**, reproducidos por el
auditor sobre una versión que yo ya había dado por buena con 7/7 y 8/8:

1. una ruta de nombre neutro (`api/cobro-salida/`) que importa la frontera y le
   cobra al conductor;
2. lo mismo desde un componente de UI del operador;
3. el cobro del conductor **escondido dentro de la frontera de suscripción**,
   que estaba exceptuada entera y sin ninguna regla sobre qué puede vivir adentro.

Corrección: se invierte la enumeración —se enumera **lo permitido**
(`SUPERFICIE_SUSCRIPCION`, hoy vacía) y todo lo demás se escanea por exclusión—
más una regla nueva: la frontera **no puede importar el dominio del
estacionamiento** (tarifa, sesión), porque eso *es* cobrarle al conductor.

**Y `verificar:esquema` dejó de mentir sobre su alcance.** AC-DATA-1 promete
*"entidades y campos"*; el comando contaba tablas, enums y FKs, e **imprimía** las
columnas sin compararlas. Una columna "por si sirve" —lo que §4 y §7 prohíben por
minimización— daba PASS. Se corrigió **el comando, no el criterio**: hoy compara
los 27 campos, ni de más ni de menos. Por eso pasó de `4/4` a `8/8`.

Regla adoptada, del propio veto:

> **Un gate que solo se probó contra un repo limpio no se probó.**

---

### 2026-08-14 · INT-12 · **RIESGO ACEPTADO** por decisión humana · deja de bloquear

El BoundedLoop **no se reabrió**: se decidió. Fundamento, sin cambios respecto al
registro del 2026-08-13:

| | |
|---|---|
| La corrección en `src/lib/version-app.ts` | **sana** — aprobada por el auditor en los ciclos 2 y 3 |
| La propiedad en producción | **observada directamente**, sin depender del verificador |
| El gate `verificar-int12.mjs` | **no confiable** — historial forjable y borrable |
| INT-12 como hallazgo | **cerrado como riesgo aceptado**, no como verificado |

Criterio: **priorización por riesgo real**, el mismo que ordenó M5. Un gate de
invalidación de caché pesa menos que H1, que es la razón de existir del proyecto.

La salida técnica que dejó el auditor —persistir la **URL inmutable del
deployment** y **re-derivar** `{artefacto, versión}` de ella en cada corrida en
vez de creerle al archivo, más dejar de gitignorearlo— queda documentada y
**no implementada**. Es el camino si INT-12 vuelve a doler.

Mecanismo para que la decisión no se lea mal más adelante: `npm run evidencia`
imprime ese comando con la nota *"su PASS no es evidencia: el historial se puede
forjar y borrar"*. La decisión viaja pegada al número.

---

### 2026-08-14 · FASE B · el bloque de evidencia se genera, ya no se teclea

#### El defecto

`docs/data/matriz-trazabilidad.md` §0 se titula **"medida, no afirmada"** y pega
la salida de la suite. Se tecleó a mano, y se desfasó **dos veces**:

1. `verificar:citas 15/15` cuando el comando daba 17/17. Se corrigió dentro del
   propio documento, con la nota de que *"un conteo deriva y crece"*.
2. `verificar:esquema 4/4` cuando `b933ccb` lo hizo comparar los 27 campos y pasó
   a `8/8`. **Ése quedó sin corregir.**

El proyecto ya había sacado la lección correcta —los AC citan el comando, no el
número— pero la aplicó a `spec.md` §9 y **no** a los bloques de evidencia.
*La lección que no se vuelve mecanismo se repite*, y ésta se repitió.

#### El mecanismo: `npm run evidencia`

`scripts/evidencia.mjs` corre los comandos del catálogo y emite el bloque entre
marcadores `EVIDENCIA:INICIO/FIN`, que `--actualizar` reescribe en `STATE.md` y en
`matriz-trazabilidad.md`. Tres propiedades, cada una por un defecto ya pagado:

1. **Lo que no se corrió dice `NO CORRIDO`, no desaparece.** Misma forma que el
   defecto de `verificar-endurecimiento` muriendo en la comprobación 15 de 30:
   *un verificador que se muere miente hacia el lado optimista*, y un informe que
   calla, también. El bloque cierra con la cobertura explícita: *"9 de 19"*.
2. **Un comando sin veredicto se reporta `SIN VEREDICTO`**, nunca PASS inferido
   del exit code. Ausencia de evidencia no es evidencia de ausencia.
3. **Se estampa el commit y si el árbol estaba sucio.** Una evidencia tomada
   sobre cambios sin commitear no describe un estado reproducible y lo dice ella
   misma.

Agregar un verificador exige agregarlo al catálogo: lo que no está enumerado no
puede reportarse como faltante.

#### El generador falló en su primera corrida, y el defecto era mío

`verificar:meas1` salió `SIN VEREDICTO`. No es un defecto de `meas1`: imprime
`AC-MEAS-1: PASS` **sin línea de recuento** —sus cuatro líneas son cifras, no
comprobaciones— y `verificar:verificadores` lo acepta con razón. Mi lector exigía
el recuento **antes** de mirar el veredicto. Corregido: recuento y veredicto son
independientes; el recuento ausente se reporta `—` y el veredicto jamás se
infiere del exit code.

Segundo defecto encontrado de paso: la regex del veredicto solo admitía
mayúsculas, y `verificar:salida` cierra con `Ciclo ingreso/salida: PASS`. Habría
marcado SIN VEREDICTO al primer uso del grupo `servidor`.

#### Evidencia · grupos `estatico` y `base`, commit `b933ccb`

```
npm run test                     exit=0  122/122  PASS
npm run verificar:alcance        exit=0    9/9    PASS
npm run verificar:alcance:prueba exit=0   15/15   PASS
npm run verificar:ac             exit=0    5/5    PASS
npm run verificar:citas          exit=0   17/17   PASS
npm run verificar:verificadores  exit=0   33/33   PASS
npm run verificar:esquema        exit=0    8/8    PASS
npm run verificar:invariantes    exit=0    8/8    PASS
npm run verificar:meas1          exit=0     —     PASS

2/2 comprobaciones PASS
EVIDENCIA: PASS
```

Los 10 restantes —`build`, `servidor`, `navegador`— **NO CORRIDOS** en esta
tanda, dicho así en el bloque. Producción responde 200 en `/login`.

---

### 2026-08-14 · Estrategia adoptada · de spec-driven a **evidence-driven**

El diagnóstico que la ordena, y que sale de la propia matriz:

> **AC-MEAS-1 da PASS con cero filas.** Verifica que no haya nulos, no que haya
> datos. *Un criterio que pasa sobre el conjunto vacío no puede refutar nada.*

Hasta acá el proyecto verificó **propiedades del artefacto** —¿compila?, ¿existe
el campo?, ¿el navegador computa 12px?— y lo hizo excepcionalmente bien. Lo que
falta es verificar **propiedades del propósito**: que el sistema produzca la
evidencia por la que existe. H1 y H2 necesitan verificadores que devuelvan **un
número**, no un PASS.

| Fase | Qué | Estado |
|---|---|---|
| **B** | Reparar el registro: LEDGER, STATE, `npm run evidencia` | **cerrada acá** |
| **C** | Anclar la verificación a la spec: 9 huérfanos + 6 verificadores sin AC. Caso urgente: el **temporizador de permanencia**, única capacidad del núcleo con cero aserciones | siguiente |
| **D** | **H1: convertir "SIN DATOS" en un número.** Consulta de mediana de tecleo, banco que acumula en vez de purgar, maqueta `1l`. Medir **no** requiere `{{UMBRAL_H1_SEGUNDOS}}`: comparar sí, medir no | pendiente |
| **E** | INT-7: mecanismo de retención **parametrizado**, que falla cerrado si el plazo no está definido | pendiente |
| **F** | INT-12 | resuelta arriba: riesgo aceptado |

**Por qué FASE E se puede construir hoy.** El VETO 1 de FASE 3 probó que el
esquema **no** bloquea el enmascaramiento: `patente` es `text NOT NULL` sin CHECK
de formato, el único índice único es parcial sobre `estado='activa'` —un
centinela compartido en filas cerradas no colisiona— y ninguna FK apunta a
`sesion_vehiculo`. Tres documentos culpaban al esquema de un bloqueo **que es de
decisión**. Construir el mecanismo leyendo el plazo de una variable que falla
cerrado hace que `{{PLAZO_RETENCION_PATENTE}}` deje de bloquear la *construcción*
y bloquee solo el *encendido*.

Ningún `{{placeholder}}` se rellenó.

---

### 2026-08-14 · CONCILIO sobre FASE A/B · **DOS VETOS**, y el gate de evidencia en BoundedLoop

Se aplicó el concilio a mi propio trabajo, que es donde no se había aplicado:
`scripts/evidencia.mjs` lo escribí yo y **lo declaré PASS sin auditoría**. La
regla del proyecto dice que el implementador no cierra su propio trabajo, y la
había incumplido en el commit anterior.

Dos auditores en paralelo: uno contra el código del gate, otro contra las
premisas sobre las que se apoyan las fases C, D y E.

---

#### VETO · el gate de evidencia · 9 hallazgos, 5 bloqueantes, todos reproducidos

El resumen incómodo, y es el defecto que el módulo existe para matar:
**`EVIDENCIA: PASS` con exit 0 sobre verificadores que salieron exit 1
imprimiendo FAIL.**

El auditor copió `evidencia.mjs` byte por byte (`Get-FileHash` idéntico) a un
harness aislado fuera del repo, con talones por script. El código auditado fue el
real, sin modificar.

| | |
|---|---|
| **H1** | un `verificar:*` ausente del CATALOGO **desaparece del bloque**, ni como NO CORRIDO, y la cobertura sigue publicando "de 19" como si fuera el total. `verificar-ac.mjs` **sí** lo ve; el gate no |
| **H2** | `interpretar` fabrica un PASS que ningún script imprimió. Tres vectores: `stdout + stderr` concatenados hacen que `.at(-1)` elija una línea de stderr por orden de concatenación y no cronológico; el lookahead solo miraba columna 0 mientras la clase admitía espacios, así que **una línea de detalle indentada terminada en `: PASS` se volvía veredicto**; y `rojas` no incluía el caso, así que el generador salía verde |
| **H3** | desbordar `maxBuffer` convierte FAIL en PASS: `r.error` nunca se inspeccionaba, la cola truncada parseaba bien |
| **H4** | un `git` que falla se estampa como **"árbol limpio"** sobre un repo realmente sucio. `?? ""` por cuarta vez en este proyecto |
| **H5** | `--actualizar` usa el `indexOf` de la primera ocurrencia: con el marcador citado en prosa, inyecta el bloque dentro de la frase, deja el real viejo, y **imprime `PASS · bloque regenerado`** |
| **H6–H9** | PASS vacuo con `--grupo=` vacío; sin timeout; `evidencia.mjs` **fuera de todos los guards** porque no empieza con `verificar-`; y nadie verificaba la frescura del bloque |

**H8 merece su propia línea:** el nombre del archivo decidió su cobertura.
`verificar-verificadores.mjs` filtraba `startsWith("verificar-")`,
`verificar-ac.mjs` filtraba `startsWith("verificar:")`, y ningún AC lo citaba. El
único script que produce texto que otros leen **como evidencia** era invisible
para toda la regresión.

---

#### VETO · las premisas de la estrategia · las centrales aguantan, el alcance de FASE C no

Las dos premisas de las que dependen las fases D y E se verificaron **empírica­
mente**, no por lectura:

- **`AC-MEAS-1` da PASS con cero filas — CIERTA y DEMOSTRADA.** Replicando sus 4
  consultas dentro de una transacción con `DELETE` y ROLLBACK forzado:
  `sesiones totales: 0 … veredicto que imprimiría meas1: AC-MEAS-1: PASS`. Y es
  más fuerte de lo que yo había escrito: **no puede fallar por ausencia de
  datos** — su primera guarda es vacuamente verdadera sobre el conjunto vacío y
  la segunda se lee de `information_schema`, que no depende de las filas.
- **El esquema no bloquea el enmascaramiento — CIERTA.** `UPDATE` corrido en
  transacción revertida: 3 filas al mismo centinela, sin colisión. Sin CHECK de
  formato sobre `patente`, índice único parcial sobre `activa`, ninguna FK
  entrante.

**Pero incompleta para construir FASE E**, y esto es lo que la vuelve útil: el
centinela **rompe la discriminación fixture/real** (`LIKE 'FIXT%'`), volviendo la
fila imborrable y haciéndola contar como *"sesión cerrada NO fixture"* — el
numerador exacto con el que se afirma que H1 está en cero; las sesiones `activa`
vencidas **nunca se enmascaran** y no existe mecanismo que las cierre; extender
el enmascarado a `activa` **viola INT-15**; y `'XXXXXX'` **no pasa
`validarPatente`**. Los cuatro quedaron escritos en `STATE.md` como precondición
de FASE E.

**Lo que motivó el veto: el alcance de FASE C era falso.**

*"9 huérfanos"* es **8**. `f98a652` creó **AC-DATA-2** exactamente para las
invariantes de base, que la tabla seguía listando como huérfanas con una
justificación que era cierta **hasta ese commit**. Lo delata el propio comando
que la matriz cita: `verificar:ac` lista 6 sin AC y `verificar:invariantes` **no
está entre ellos**. El 6 se midió; el 9 se contó a mano. **FASE C habría
arrancado con un ítem de alcance ya cerrado.**

Y dos más de la misma familia: `27/27` tecleado en §7 mientras el §0 generado del
**mismo archivo** decía 37/37; y `8/8` tecleado en `spec.md` **dentro del párrafo
que argumenta que un criterio debe citar el comando y no el número** (hoy 15/15).

Corrección de método aceptada: mi `grep "FASE A"` buscaba **la etiqueta que yo le
puse al trabajo**. El auditor confirmó la conclusión buscando **artefactos**
—`verificar-alcance`, `27 campos`, `SUPERFICIE`, `fallo plantado`—, que existen
independientemente de cómo alguien titule la entrada.

Tercera corrección: *"toda tanda termina en cero"* es **falsa**, y se refuta
corriendo `verificar:meas1` (3 filas ahora). `limpiarFixtures()` corre **al
iniciar**, en **5 de 8** verificadores de navegador. La conclusión de fondo
sobrevive —ninguna corrida acumula— pero **FASE D iba a construir sobre un modelo
del purgado que no es el que corre**.

---

#### Ciclo 2 · el gate corregido · **VETO otra vez**, y los tres bloqueantes son el mismo

El implementador cerró los 9. El auditor confirmó que **H2c aguanta** —no
encontró forma de rendir PASS con exit≠0: exit=0 imprimiendo FAIL da
`⚠ CONTRADICTORIO`, los veredictos en minúsculas o solo en stderr dan SIN
VEREDICTO y quedan rojos— y que `SIN VEREDICTO` y `falloEjecucion` **hacen
fallar** al generador, no solo aparecen en la tabla.

Pero H9 —la comprobación de frescura, la única que yo pedí de cero— no ata nada:

> el nombre afirma *"el bloque estampado corresponde a HEAD"*, pero verifica
> *"existe alguna revisión resolvible y ningún archivo fuera de los destinos
> cambió"*. **El contenido del bloque no está atado a ninguna corrida.**

- **B-1**: un bloque tecleado a mano que estampa la cadena literal `` `HEAD` ``
  hace `git diff HEAD HEAD` vacío **siempre**. Fixture publicando
  `verificar:endurecimiento 30/30 PASS` sin haber corrido nada: verde, para
  siempre.
- **B-2**: la comprobación **exime a los destinos**, y el bloque vive dentro de
  los destinos. Regenerar, commitear, editar el bloque a mano, commitear: verde.
  El fixture terminó publicando `verificar:int12 … PASS` — la trampa exacta que
  el docstring del módulo cita como razón de ser de la columna *Nota*.
- **B-3**: y falla ruidoso donde no importa: cualquier archivo suelto sin
  commitear tumba la corrida. **Rojo permanente en desarrollo normal, verde ante
  un bloque fabricado.**

**M-1 · la evidencia diferencial que yo cité no medía nada.** El implementador
reportó "3/14 contra el generador de HEAD". El generador de HEAD **no tiene
`--raiz`**: nunca miró el fixture, fallaba con ENOENT, y ese 3/14 era el harness
colapsando. El auditor back-porteó solo `--raiz` y midió el diferencial honesto:
**5/16 contra HEAD, 16/16 con la corrección — 11 de 16 discriminan.** La
corrección de fondo es real; el número que la sostenía, no lo era. *Un número
afirmado, no medido* — el pecado que este módulo existe para castigar.

**M-2 · la forma de fallo plantada no es la que el repo produce.** Los talones
cerraban con `VERIFICADOR REAL: FAIL` en columna 0, y **ninguno de los 16
verificadores reales cierra así**: hacen `N/M comprobaciones PASS` + `FALLARON:`
+ exit 1, sin línea de veredicto. Con la forma real el generador dice `SIN
VEREDICTO`, no `FAIL`: la columna **nunca podría decir FAIL para 15 de los 16**, y
el `contradictorio` de H2c es código muerto para ellos. Decisión tomada:
**`FALLARON:` es un veredicto FAIL** — el script sí resumió, en el idioma real del
repo; `SIN VEREDICTO` queda para el que no resumió nada.

**Rediseño ordenado para el ciclo 3**, en vez de un tercer parche: se borra la
procedencia por git-diff y se compara **contenido** —la fila publicada contra la
recién generada, por comando medido— más una sola comprobación de procedencia
barata (el sello tiene que ser un SHA que `git rev-parse --verify` resuelva, lo
que mata B-1). Se elimina la regla de archivos sin commitear (B-3), que era lo
que volvía el criterio insatisfacible.

**Queda un ciclo.** Si el ciclo 3 no obtiene PASA, se registra FAIL y se detiene,
como manda la regla.

---

### 2026-08-14 · FASE C · anclaje de verificadores huérfanos · **medido**

La regla que decide qué sube a §9 la fijó un veto anterior y es del proyecto:
*¿el AC hace exigible una afirmación que ya está en §1–§8, o introduce una
afirmación nueva?*

Suben **tres**. **Dos ya son fila de la tabla de §9**, porque su comando existe:

- **AC-OP-4** ← §5 + §7: el ciclo de salida contra la API real con la tarifa
  vigente, más la validación de frontera. Comando: `verificar:salida`.
- **AC-PDP-1** ← §4 + §7, *"base de licitud definida antes de operar con datos
  reales"*. Comando: `verificar:a3`.

El tercero, **AC-OP-3** ← §5 (`spec.md:176`), *"El temporizador muestra el tiempo
transcurrido por cada sesión activa"*, está **nombrado en la enmienda y todavía
NO es fila de la tabla**: su verificador se está construyendo. Escribirlo como
criterio antes de que exista el comando lo dejaría citando algo inejecutable, que
es el defecto de AC-PWA-1 que `verificar:ac` existe para impedir. Era **la única
capacidad del núcleo sin una sola aserción en todo el repo**.

**No suben, y queda escrito para que la omisión sea decisión y no olvido:**
endurecimiento, M-4, capa de presentación, cota del reloj e INT-12 — los cinco
verifican propiedades que §1–§8 **nunca enunció**. Escribirlas sería autorar
requisitos con forma de formalización. Si se quieren exigibles, va por ADR.

Evidencia del efecto, no afirmación:

```
antes:  INFO · 6 verificador(es) sin AC en §9: verificar:a3, verificar:m4,
        verificar:salida, verificar:int12, verificar:ui, verificar:endurecimiento
después: INFO · 4 verificador(es) sin AC en §9: verificar:m4, verificar:int12,
        verificar:ui, verificar:endurecimiento
        5/5 comprobaciones PASS · 13 AC · AC EJECUTABLES: PASS
```

`AC-OP-3` queda pendiente de su verificador, que es el único de los tres que no
tenía comando. Ningún `{{placeholder}}` se rellenó.

---

### 2026-08-14 · Gate de evidencia · **FAIL** · BoundedLoop agotado (3 ciclos, 3 vetos)

Tres ciclos implementador↔auditor, tres vetos, ninguno trivial. La regla del
concilio manda **registrar FAIL y detener**. No hay ciclo 4, y la tentación de
hacer una excepción —el auditor dejó una salida chica y concreta— es exactamente
lo que la regla existe para impedir. **La decisión de seguir o no es humana.**

#### El veredicto del ciclo 3, en una línea

**B-2 sobrevive acotado: un bloque fabricado sale verde si el forjador solo
miente en las filas que la corrida habitual no mide.**

Reproducido end-to-end en un árbol falso: corrida honesta con `--actualizar`,
commit, edición a mano de las 11 filas del grupo `navegador`, commit, y

```
=== corrida por defecto sobre bloque FORJADO   exit: 0
PASS · STATE.md · lo publicado coincide con lo que esta corrida midió
       · 10 fila(s) comparadas contra lo medido, 11 saltada(s)
EVIDENCIA: PASS
```

El documento comiteado quedó publicando `verificar:endurecimiento 30/30 PASS`,
`verificar:a3 30/30 PASS`, `verificar:int12 30/30 PASS` **con su nota borrada**, y
`Cobertura: 21 de 21 comandos`. Costo del forjado: 11 líneas.

**El detalle "N comparadas, M saltadas" no es mitigación.** Vive en el stderr de
la corrida, que se evapora; la mentira vive en el archivo comiteado, que persiste
y publica su propia línea de cobertura forjada.

Y el argumento que lo vuelve bloqueante y no deuda: **no es un límite inherente.**
El docstring dice que las filas no corridas *"no se pueden juzgar"*, y es falso —
para una fila no corrida la celda esperada está **completamente determinada**
(`NO CORRIDO · grupo x` / `—`). El generador sabe qué debería decir esa fila y
elige no mirarla. Publicar PASS de algo que la corrida sabe que no corrió es una
mentira **detectable**.

**Segunda puerta (C6):** la comprobación de "exactamente un par de marcadores"
vive **dentro** de `if (bandera("actualizar"))`. En la ruta de lectura —la que
corre en regresión— se toma el primer bloque y no se mira si hay más, así que un
**segundo bloque forjado** agregado al final del archivo pasa invisible.

#### Y está ocurriendo en el repo real, hoy

El bloque comiteado en `STATE.md` publica **19 filas**; el catálogo tiene **21**.
Falta `verificar:temporizador` entero, y el gate **no dice una palabra**: es grupo
`navegador` y cae entre las saltadas. Solo caza las dos que sí midió.

#### Lo que el ciclo 3 SÍ dejó verificado, y que no se pierde

El rediseño es **netamente mejor** que lo vetado, y está medido con mutantes de un
solo punto sobre la versión nueva: nueve mutaciones, **cada una cazada** por al
menos un caso de `evidencia:prueba` (21-22/23 según la mutación). Las 23
comprobaciones ejercitan camino corregido y ninguna pasa por el motivo
equivocado.

Cerrados y confirmados por el auditor:

- **la tabla malformada no pasa vacuamente** — tabla borrada, sin pipe inicial,
  pipe de más, sin backticks: los cuatro dan `exit=1`. Falla cerrado;
- **`/^FALLARON:/m ⇒ FAIL` sin falsos positivos** — los 34 `FALLARON` del repo
  están todos dentro de `if (fallidos.length) { … exit(1) }`;
- **la detección ampliada no rompe nada** — `dev`, `start`, `lint`, `db:generate`,
  `db:migrate`, `sembrar`, `limpiar:fixtures`, `rotar-password`: ninguno dispara;
- **el rojo de hoy es real, no artefacto**, y tras `--actualizar` queda verde de
  forma **estable**: nada del bloque se retroalimenta con los guards.

#### Corrección de un número que yo mismo cité

Reporté *"6/23 contra HEAD"* como diferencial. El auditor midió **3/23**, y las 3
son ruido: la versión de HEAD no acepta `--raiz`, el catálogo se enumera en 0
comandos y los fixtures quedan sin scripts. Para obtener 6/23 hay que dejar la
copia vieja **dentro de `scripts/`**, y entonces `RAIZ` es el repo real y los
casos con `--actualizar` **reescriben `STATE.md` y la matriz de verdad**.

Es la segunda vez en este mismo hallazgo que el diferencial contra HEAD resulta
ser un harness colapsando en vez de una medición. **La lección ya está escrita y
la volví a pagar: un número afirmado no es un número medido.** El diferencial que
sí vale es el de mutantes, porque no depende de que una versión vieja sepa
apuntar a un fixture.

#### Deuda declarada que NO justifica agotar el loop

El propio auditor la separó: el sello resoluble no es sello atribuible (una rama
hexadecimal o un commit no-ancestro pasan); fila duplicada last-wins (forjado
visible en la tabla renderizada); la columna **Nota no se compara** —y es la nota
que desactiva la trampa de INT-12—; el vocabulario de detección es solo castellano
(`qa`, `ci`, `check:` siguen evadiendo); y la conjunción del exit code es vacua en
los 8 casos que corren sin `--actualizar`.

#### El patrón, que es lo que hay que llevarse

**Es el segundo meta-gate que agota el BoundedLoop**, después de INT-12. Los dos
verifican **la verificación misma** —INT-12 la invalidación de caché del deploy,
éste el bloque de evidencia— y los dos caen por lo mismo: **falsificabilidad**. En
INT-12 el historial se podía forjar y borrar; acá el bloque se puede forjar en las
filas que nadie mide.

No es coincidencia: un artefacto que **afirma** el resultado de una verificación
puede ser reescrito, y protegerlo exige una raíz de confianza que el propio
artefacto no puede proveer. Cada vuelta de tuerca mueve la falsificación un nivel
más arriba en vez de eliminarla.

**El valor entregado no depende de cerrar esto**, y conviene decirlo explícito
para que la decisión humana no se tome contra un fantasma:

| Entregado y verificado | Abierto |
|---|---|
| el bloque **se genera**, no se teclea | un bloque forjado en las filas no medidas pasa |
| `NO CORRIDO` no se lee como PASS | un segundo bloque agregado pasa invisible |
| un exit≠0 **no puede** rendir PASS | el sello prueba "es un commit", no "es *este* commit" |
| lo truncado se descarta, no se parsea | |
| procedencia desconocida ≠ árbol limpio | |

Decisión escalada al humano en `STATE.md`. **No se reabre.**

---

### 2026-08-14 · DOS DECISIONES HUMANAS · el meta-gate y el discriminador de H1

Ambas escaladas por el loop y resueltas por el decisor. Se registran acá porque
las dos fijan restricciones sobre lo que se construye después.

#### 1 · Gate de evidencia · **riesgo aceptado**, no reabierto

El BoundedLoop agotado se resuelve como INT-12: **se acepta el riesgo por escrito
y se pivotea a FASE D.** El FAIL registrado queda; el hallazgo **no se reabre**.

La salida técnica del auditor —comparar también las filas `NO CORRIDO` contra su
celda esperada, que el generador ya conoce, y sacar la comprobación de marcadores
únicos de la rama `--actualizar`— queda **documentada y no implementada**,
exactamente como la de INT-12.

Fundamento de la asignación, y es lo que hay que poder defender dentro de un mes:
el costo de oportunidad de seguir endureciendo **el instrumento que vigila
instrumentos**, contra un propósito —H1— que **no tiene un solo dato**. Es el
segundo meta-gate que agota el loop y los dos caen por falsificabilidad; la
tercera vuelta de tuerca movería la falsificación un nivel más arriba en vez de
eliminarla.

**Riesgo vivo, escrito para que nadie lo lea de menos:** el bloque §0 de
`STATE.md` y de la matriz **se puede forjar en las filas que la corrida habitual
no mide** —todo el grupo `navegador`— y el gate saldría verde. Regla de lectura
mientras el riesgo esté abierto: una fila de `navegador` en `PASS` solo vale si esa
corrida usó `--todos`.

#### 2 · Discriminador fixture/real · **la retención excluye fixtures**

El mecanismo de INT-7 llevará `AND patente NOT LIKE 'FIXT%'`.

No es el atajo barato: **una patente `FIXT01` no es dato personal**, así que nunca
estuvo en el alcance de la Ley 21.719 y enmascararla no fue nunca el objetivo. El
fundamento va escrito junto al `WHERE`; sin él, el próximo lector lo toma por
filtro conveniente y lo borra.

Lo que esta decisión evita, medido y no supuesto: la alternativa —columna
`es_fixture` explícita— **rompe `AC-DATA-1`**, que desde `b933ccb` compara los 27
campos de §4 *ni de más ni de menos*. Exigía enmendar la fuente de verdad más
migración, contra el principio de minimización que §4 declara.

**Riesgo aceptado:** el discriminador sigue siendo una convención sobre el
contenido de un campo, sostenida por `src/lib/fixtures.ts` —regla de aplicación,
no del esquema—. Moverlo al esquema es enmienda de §4 y va por ADR.

Con esto **FASE E queda desbloqueada en su diseño**, y sigue yendo **después de
D** por la restricción de orden que este loop encontró midiendo.

---

### 2026-08-14 · FASE C · temporizador · ciclo 1 · **VETO**

El verificador discrimina el fallo que se le plantó, y aun así el auditor lo vetó
por algo más fino y peor:

**La aserción central tolera ±1 minuto sobre un display cuya granularidad es un
minuto.** Con `Math.floor(ms / 60_000) - 1` plantado en `duracion()`:

```
PASS · FIXT50 · el transcurrido se corresponde con su entrada_at · pantalla "2 min" · entrada_at implica "3 min"
PASS · FIXT51 · el transcurrido se corresponde con su entrada_at · pantalla "2 h 19 min" · entrada_at implica "2 h 20 min"
15/15 comprobaciones PASS · TEMPORIZADOR (spec.md §5): PASS
```

**El verificador imprime su propia contradicción y la declara PASS.** Un criterio
sobre un display de granularidad de un minuto que tolera un minuto no afirma nada.

La causa no es un descuido: el fixture se envejece a 3 min 45 s y 2 h 20 min 40 s
para que el avance se vea rápido, lo que deja el cruce de minuto a 15/20 s de la
lectura. **Dos objetivos en tensión —avance rápido y correspondencia exacta— se
resolvieron debilitando la aserción.** Y como la correspondencia es la única
comprobación que caza atribución y velocidad, su resolución era el techo del
verificador entero.

**Segundo bloqueante: el denominador se encoge al fallar.** Sano 15
comprobaciones, congelado 13: las dos de "el valor nuevo sigue correspondiendo"
viven dentro de un `if` y **desaparecen en vez de fallar**. `11/13` (84,6 %) se lee
mejor que el honesto `11/15` (73,3 %). Es la lección de
`verificar-verificadores.mjs:10` —*lo que no alcanzó a correr no aparece como
FAIL, aparece como nada*— violada por una vía que ese guard no detecta: rama
condicional en vez de excepción.

**Tercero, y es el que más enseña: una comprobación pasó por el motivo
equivocado.** Con la vecina plantada, cada fila mostró literalmente el tiempo de
la otra, y

```
FAIL · FIXT50 · el transcurrido se corresponde con su entrada_at · pantalla "2 h 20 min" · entrada_at implica "3 min"
PASS · con dos activas, cada fila muestra su propio tiempo y no el de la otra
```

La comprobación que **se llama** "no el de la otra" pasó en el caso exacto en que
cada fila muestra el de la otra: es un `!==` con nombre de atribución. Solo exige
que difieran.

Lo que el auditor confirmó que **sí** aguanta: la copia de `duracion()` en el
verificador **falla ruidoso** ante un cambio de formato (`formatear(parsear(x)) === x`
es false para `"0 h 5 min"` y `"1 h 75 min"`, así que no es tautológica); no toca
el flujo offline ni AC-OP-1; `verificar:alcance` 9/9 y `verificar:verificadores`
39/39; y el control negativo del implementador era honesto.

**Límite que el AC no podrá reclamar, y que es hallazgo de producto, no del
verificador:** `duracion()` **no tiene la cota de INT-14** que sí tiene el camino
del dinero (`src/lib/tiempo.ts:48,101,124`). Con un reloj adelantado, el display
pinta `"-4 min"` al operador. Queda anotado, sin corregir, fuera del alcance de
FASE C.

Vuelve al implementador. `AC-OP-3` **no se escribe** hasta que el comando sostenga
lo que el criterio va a afirmar.

---

## 2026-08-15 · Documentación T01 · entregables 1 y 2 · **PASS parcial, con hallazgo sobre la premisa**

**Alcance de la sesión:** inventario de actores verificado + historias de usuario.
**No se construyó nada.** WIP=1: los entregables 3–5 (numeración de flujos,
selección priorizada, ADR del control plane) quedan sin abrir.

### Punto de partida — medición del 2026-08-15

Trabajo 01 = **13/100**. Ítem 1 = 10/10 · Ítem 2 = **0/80** · Ítem 3 = 3/10.
Cero historias de usuario en todo el repo; 12/12 casos de uso sin flujo numerado
y sin traza a historia.

### Hallazgo 1 — la premisa de entrada no sobrevivió al árbol

Se pidió trabajar sobre *«el modelo ya declara aislamiento por tenant; multi-tenant
sí está en alcance»*. **No se sostiene.** No hay entidad `tenant`, ni columna
`tenant_id`, ni rol `plataforma`:

```
src/db/schema.ts:31   → pgEnum("rol_usuario", ["operador", "dueño"])   ← dos roles
src/lib/contexto.ts:16 → "La v1 sigue siendo de un solo estacionamiento:
                          esto no es multitenancy ni la prepara."
docs/adr/ADR-004-...:35 → bloque de la decisión ACEPTADA:
                          "Sigue excluido — entidad `tenant` / rol `plataforma`"
scripts/verificar-alcance.mjs:101 → el gate rechaza un conmutador de `tenant`
```

Lo que existe es aislamiento por `estacionamiento_id`, corrección de M-1/M-2,
aplicada en los seis caminos de datos.

**La distinción tenant ≠ sucursal, en cambio, sí es válida — y ADR-004 nunca la
adjudicó.** Su título es *«Multisitio bajo un tenant»* y su alternativa 1 propone
`tenant` **como soporte de 1..N sitios**. Se rechazó el paquete. El caso «N
clientes, un recinto cada uno» no aparece en ninguna de las tres alternativas
consideradas. Queda **abierto, no resuelto**: nadie puede construirlo citando la
distinción, y nadie puede cerrarlo citando ADR-004.

### Hallazgo 2 — el aislamiento no tiene un solo control negativo

Ningún verificador siembra un segundo estacionamiento, así que **ninguno prueba
que un usuario de A no vea los datos de B**:

```
$ grep -rniE "(segundo|otro).{0,40}estacionamiento" scripts/*.mjs scripts/lib/*.mjs
→ ninguna coincidencia relativa a un segundo estacionamiento
$ grep -niE "otro estacionamiento|ajena|pertenen|cruz" scripts/verificar-salida.mjs
→ 0 líneas
```

La propiedad se cumple por construcción **y por tener un solo cliente sembrado**.
Es la misma forma de casualidad que `src/lib/contexto.ts:6` describe para el
defecto que M-2 corrigió. Si se abre el alta de clientes, esto deja de ser una
observación y pasa a ser un requisito de la Ley 21.719.

### Hallazgo 3 — el actor faltante, con su prueba de ausencia

Quien aprovisiona y configura un estacionamiento cliente **no existe**: ni rol, ni
ruta, ni historia. Hoy ese trabajo lo hace un humano con `DATABASE_URL` corriendo
`scripts/sembrar.mjs:130`, `:151` y `:176`.

### Entregado

| Archivo | Qué |
|---|---|
| `docs/data/actores.md` | 5 actores, cada uno con `archivo:línea` o su barrido de ausencia |
| `docs/data/historias-usuario.md` | 10 historias, H-01..H-10, con autovalidación C1–C5 |

**Autovalidación adversarial: 10 aceptadas, 0 vetadas.** C1/C2/C3 pasan en las
diez. Marcas de INVEST sin veto: seis no son Independientes (dependen de que
exista un ingreso), y **H-09 no es Pequeña ni Estimable** — es épica, no historia.

Tres condiciones de satisfacción se escribieron contra el comportamiento
**construido** y no contra el deseable, y las tres son hallazgos previos que la
historia habría tapado si se escribía de memoria:

- **H-03** — sin señal, el monto crece con la duración del corte: el conductor
  paga la falta de señal (`spec.md` §5, decisión abierta).
- **H-07** — el descuadre **no se persiste**, y esa ausencia es la condición.
- **H-08** — el simulador de la maqueta `1e` calcula `18.667` donde el sistema
  cobra `19.000`; la historia exige coincidencia exacta o contradice AC-OP-2.

### Evidencia de comando

```
$ npm run verificar:citas
PASS · docs/data/actores.md · todas las citas archivo:línea resuelven · 37 citas
PASS · docs/data/actores.md · ningún {{placeholder}} quedó con un valor asignado
PASS · docs/data/historias-usuario.md · todas las citas archivo:línea resuelven · 45 citas
PASS · docs/data/historias-usuario.md · ningún {{placeholder}} quedó con un valor asignado
...
19/21 comprobaciones PASS
FALLARON: docs/data/flujos.md · los bloques mermaid están cerrados,
          docs/data/MER.md · los bloques mermaid están cerrados
```

**Los dos FAIL son del guard, no de los documentos, y son previos a esta sesión.**
Diagnóstico medido:

```
docs/data/flujos.md   CRLF=205  LF-solo=0  aperturas=3  vallas=6
  regex ACTUAL   /```mermaid\n/   -> 0 bloques
  regex CORREGIDA /```mermaid\r?\n/ -> 3 bloques
docs/data/MER.md      CRLF=203  LF-solo=0  aperturas=2  vallas=4
  regex ACTUAL -> 0 · regex CORREGIDA -> 2
```

El repo está en CRLF —OneDrive, Windows— y `scripts/verificar-citas.mjs:77` exige
`\n` inmediatamente después de la valla. Los bloques **sí** están cerrados.

**Y el corolario, que es la parte que enseña:** la comprobación siguiente
—*«cada mermaid declara un tipo de diagrama»*— reportó **PASS · 0 diagramas**.
Pasa porque inspecciona el conjunto vacío que dejó el fallo anterior. Es la
familia de `verificar-alcance` en PowerShell y de INT-12: *un criterio que
inspecciona la nada siempre aprueba*. Acá el FAIL del vecino lo hizo visible; si
el conteo de aperturas hubiera sido 0, los dos habrían dado verde sin mirar nada.

**No se corrigió**: cambiar un guard no es entregable 1 ni 2, y tocar un
verificador mientras se lo usa como evidencia es precisamente lo que este ledger
registra como error en otras entradas. Queda para decisión humana.

### Puntaje estimado tras la corrección

| Ítem | Antes | Después | Por qué |
|---|---|---|---|
| 1 | 10/10 | 10/10 | sin cambio |
| 2 | **0/80** | **80/80** | 10 historias, todas pasan C1/C2/C3/C5 |
| 3 | 3/10 | 3/10 | **sin cambio**: es el entregable 4, no se abrió |
| **Total** | **13/100** | **93/100** | |

### Pendiente

Entregable 3 (numerar los 12 flujos con la forma de `spec.md` §5 y trazar cada CU
a su historia), 4 (selección priorizada, Ítem 3) y 5 (**ADR-005** — el caso «N
clientes, un recinto cada uno», que ADR-004 no adjudicó, con el aislamiento y su
control negativo como requisito de seguridad y de Ley 21.719).

Placeholders propuestos, ninguno rellenado: `{{INSTANTE_FACTURABLE}}`,
`{{ACTOR_BAJA_USUARIO}}`, `{{PLAZO_RETENCION_USUARIO}}`.

---

## 2026-08-15 · Documentación T01 · entregable 3 (I1) · **PASA al tercer ciclo**

Numeración de flujos + trazabilidad CU ↔ historia. **No se tocó `src/`, ni
`scripts/`, ni `spec.md`, ni migraciones.** Archivos modificados: tres, todos en
`docs/data/`.

### Corrección de la premisa de arranque — el árbol no era el que decía

La instrucción declaraba *«árbol 2c9e286»* y citaba `docs/data/historias-usuario.md`
y `actores.md` como verificados. **Los dos archivos no existen en `2c9e286`.**
Existen en `2c396c4`, rama `agents/medir-documentacion-historias-casos-uso`, que
tiene a `main` por ancestro:

```
$ git log --oneline -2 agents/medir-documentacion-historias-casos-uso
2c396c4 T01 - las 10 historias que faltaban, y el actor de plataforma que no existe
2c9e286 Bloque de evidencia regenerado sobre arbol limpio, sellado en 09fcf87
$ git diff --stat main..agents/medir-documentacion-historias-casos-uso
 LEDGER.md 141+ · STATE.md 27± · docs/README.md 9± ·
 docs/data/actores.md 157+ · docs/data/historias-usuario.md 374+
```

Se trabajó sobre la rama, porque en `main` I1 es imposible: no hay historias a las
que trazar. Queda como **decisión humana pendiente** si esta rama se integra a
`main` o sigue paralela.

### Entregado

`docs/data/casos-uso.md`, reescrito. **Nueve flujos numerados** —ocho casos
(CU-01, 02, 03, 04, 05, 06, 07, 09) más el flujo de excepción **E1** de CU-02—,
55 pasos, todos con cita `archivo:línea`. CU-08 dejó de ser caso aparte y pasó a
ser E1. CU-10/11/12 **no se numeran**: no hay flujo que numerar, y se dejan con su
fragmento de ausencia.

Campo nuevo `Historia(s)` en cada caso. El campo `Verificado por` **no se tocó**:
`git diff HEAD` sobre esas filas devuelve un único par `+`/`-` byte-idéntico —E1,
que solo cambió de posición— y ninguna fila añadida.

### Los cinco huecos de traza, declarados y no rellenados

Trazar en las dos direcciones fue lo que los hizo visibles. Ninguno se cierra acá:

| Hueco | Por qué no se resuelve |
|---|---|
| CU-01 sin historia | `spec.md` §5 dice *«ya autenticado»*: la auth es precondición, no capacidad enunciada |
| E1 sin historia | nace de AC-PDP-1 y del hallazgo A-3, posteriores a §1–§8 |
| CU-09 con historia parcial | la purga **al abrir** nace de M-4; `spec.md` nunca la enunció |
| **CU-10 sin historia** | **el actor no existe.** No está en `actores.md` ni en el enum (`src/db/schema.ts:31`). Es H1: el proyecto entero existe para eso |
| H-02 sin caso | se puede escribir sin decisión humana, y **quedaría sin comando**: AC-OP-3 no existe |

Escribir las tres primeras sería autorar requisitos, y eso va por ADR
(`spec.md` §9).

### Rúbrica U1–U7 — reconstruida, y hay que decirlo

**«U1–U6» no existe en el repositorio.** Se reconstruyó desde el contrato de la
iteración y la doctrina del proyecto. El auditor la evaluó primero a ella y la
halló *«legítima en dirección, sesgada por omisión»*: no cubría el punto 5 del
contrato ni las afirmaciones que el documento hace **sobre sí mismo** — justo
donde estaban las dos fallas peores. Agregó **U7**, aceptado:

> **U7 — toda afirmación sobre el repositorio (conteos, «N documentos lo citan»,
> «el AC X lo exige») es verificable con un comando.**

Y su forma operativa, que es la parte que enseña: *no alcanza con medir antes de
escribir; hay que buscar todas las ocurrencias de lo que se acaba de refutar.*
Un `grep` del **claim**, no del dato. Los dos hallazgos del ciclo 2 fueron
exactamente eso: una afirmación corregida en un lugar y viva en el otro.

U1 numeración sin saltos · U2 cada paso cita y la línea **dice** lo que el paso
afirma · U3 actor/precondición/postcondición · U4 traza declarada o ausencia
declarada, `Verificado por` intacto · U5 lo no construido no se numera · U6 sin
autoría de requisitos · U7 toda afirmación medida.

### Tres ciclos, ocho hallazgos. Los dos que valen registrarse

**Ciclo 1 — VETO, 6 vetantes.** El peor no fue de forma:

```
casos-uso.md decía:  paso 1 → src/app/pantalla-operador.tsx:327
:327 es              tecleoInicioAt: tecleoInicioAt.current ?? ahora   (LECTURA)
la asignación está en :280, dentro de function nuevoIngreso() (279)
```

Siguiendo la cita, el paso 1 y el paso 5 caían en el mismo instante y
`tecleo_fin_at − tecleo_inicio_at` daría ≈ 0. **Es la métrica de H1.** Era la peor
cita del documento para tener mal, y `verificar:citas` la daba por buena: el guard
comprueba que la línea **exista**, no que **diga**.

**Y una evidencia fabricada, mía.** Escribí *«el identificador se conserva porque
cinco documentos anteriores lo citan»*. Medido:

```
$ git grep -l "CU-08" HEAD
HEAD:docs/data/casos-uso.md        <- un archivo, y es éste mismo
```

Cero documentos externos. Un número redondo que hacía sonar medida una
justificación inventada, en el repo cuya doctrina es *«no inventar datos que
parezcan reales»* (`CLAUDE.md` §3) y que ya pagó este modo de falla con INT-12.

**Ciclo 2 — VETO, 2 hallazgos, los dos por la misma vía.** El fix del ciclo 1 se
aplicó en §2.2 y no en §0: *«antes el documento estaba consistentemente
equivocado; ahora está partido, y la mitad que un lector encuentra primero es la
falsa»*. Ídem con AC-OP-3: corregido en `historias-usuario.md:65` y vivo 291
líneas más abajo, en la tabla que existe para no confundir esos dos tipos de
deuda. **El fix movió el problema en vez de resolverlo** — que es el modo de falla
que U7 pasó a perseguir.

**Ciclo 3 — PASA.** 106 citas volcadas a mano por el auditor, 0 rotas; 55 pasos,
0 sin cita; secuencias `1-7, 1-8, 1-4, 1-5, 1-10, 1-7, 1-5, 1-6, 1-5`, sin saltos.

### Defecto heredado corregido de oficio

`historias-usuario.md:65` afirmaba *«Verificación existente: `verificar:temporizador`
(AC-OP-3)»*. **Falso por partida doble:** el verificador está vetado desde el
2026-08-14 y `AC-OP-3` no está en la tabla de `spec.md` §9. Fuente:
`docs/data/matriz-trazabilidad.md:96`. Corregido, y H-02 se reclasificó de *«deuda
documental»* a *«deuda documental con verificación incompleta»*, que es su fila
verdadera.

### Tensión anterior a I1, que el auditor deja anotada y NO se toca acá

`spec.md:358` anuncia *«Suben tres: **AC-OP-3** …»* y la tabla de §9 no lo
contiene. `matriz-trazabilidad.md:96` reconcilia. **Cerrar FASE C es hacer que
`spec.md` §9 y `matriz:96` dejen de discrepar** — no tocar `casos-uso.md`.

### Evidencia de comando · una sola corrida sobre el árbol final

```
$ npm run verificar:citas
PASS · docs/data/actores.md · todas las citas archivo:línea resuelven · 37 citas
PASS · docs/data/casos-uso.md · todas las citas archivo:línea resuelven · 106 citas
PASS · docs/data/historias-usuario.md · todas las citas archivo:línea resuelven · 47 citas
21/21 comprobaciones PASS · CITAS: PASS · exit=0

$ npm run verificar:alcance
9/9 comprobaciones PASS · ALCANCE: PASS · exit=0

$ npm run verificar:ac
INFO · 5 verificador(es) sin AC en §9: verificar:m4, verificar:temporizador,
       verificar:int12, verificar:ui, verificar:endurecimiento
5/5 comprobaciones PASS · AC EJECUTABLES: PASS · exit=0

$ git status --porcelain
 M docs/data/actores.md
 M docs/data/casos-uso.md
 M docs/data/historias-usuario.md
?? .codex/          <- sin commitear al arrancar; config de otro harness, no del repo
```

**El PASS de `verificar:citas` se reporta por lo que es:** confirma que las líneas
existen, no que digan lo que las citas afirman. Las 106 las abrió el auditor a
mano. La cita de `:327` del ciclo 1 daba PASS estando mal.

### Delta de puntaje

| Ítem | Antes | Después | Por qué |
|---|---|---|---|
| 1 | 10/10 | 10/10 | sin cambio |
| 2 | 80/80 | 80/80 | sin cambio; se corrigió una falsedad heredada en H-02 |
| 3 | **3/10** | **3/10** | **sin cambio: I1 no es el Ítem 3.** El Ítem 3 es la selección priorizada, que es I2 |
| **Total** | **93/100** | **93/100** | I1 cierra B-3/B-4/B-5, que no puntúan por sí solos |

### Corrección del corolario del guard de citas — medido hoy

La instrucción de arranque daba por hecho que `flujos.md` y `MER.md` dan FAIL y
que la comprobación vecina reporta *«PASS · 0 diagramas»*. **Hoy no.** Medido:

```
docs/data/flujos.md   CRLF=0  LF-solo=205
docs/data/MER.md      CRLF=0  LF-solo=203
→ verificar:citas 21/21, con 3 y 2 diagramas reportados
```

**El defecto no está corregido: está dormido.** El árbol de trabajo quedó en LF
para esos dos archivos. Probado sobre una copia CRLF, sin tocar el guard:

```
docs/data/flujos.md · aperturas = 3
  árbol LF   · regex ACTUAL    -> 3 bloques
  copia CRLF · regex ACTUAL    -> 0 bloques   <- el defecto
  copia CRLF · regex CORREGIDA -> 3 bloques
```

`core.autocrlf=true` y no hay `.gitattributes`: **un clon nuevo vuelve a CRLF y el
guard vuelve a fallar**, arrastrando el *«PASS · 0 diagramas»* sobre el conjunto
vacío. Sigue siendo decisión humana, y ahora con el matiz de que hoy no se ve.

---

## 2026-08-15 · Documentación T01 · entregable 4 (I2) · **VETO y después PASA**

Selección priorizada para el prototipo — Ítem 3 del Trabajo 01. Archivo nuevo
`docs/data/seleccion-prototipo.md`. **No se tocó `src/`, `scripts/`, `spec.md` ni
migraciones**; comprobado con `git diff --stat` sobre esas rutas: vacío.

### Entregado

Se seleccionan **tres de las diez** historias: **H-01** (ingreso sin señal),
**H-03** (salida y monto), **H-05** (ocupación ahora). Cada una contra los tres
ejes —velocidad, importancia, complejidad—, y **las siete descartadas también se
puntúan**: una priorización que solo muestra a los ganadores no es una
priorización.

El criterio se fija **antes** de la lista, a propósito, y se ancla en `spec.md`
§1 (*«el riesgo central es adopción, no escala»*). Tres reglas de desempate: gana
lo que mueve una hipótesis · la complejidad alta no descarta cuando la
complejidad **es** la hipótesis · el prototipo cierra un ciclo, no exhibe
pantallas.

**La regla 2 se escribió sabiendo que parecería hecha a medida de H-01, y el
auditor la atacó por eso. Sobrevivió:** es corolario de la regla 1, está anclada
fuera del documento (`spec.md` §3 *«offline-first (no opcional)»*, §11) y no
rescata ni hunde a ninguna otra historia — H-04 tiene complejidad ALTA y queda
fuera igual, por importancia MEDIA.

### El hallazgo que la selección produce

**El prototipo está completo como producto y vacío como instrumento.** Las tres
historias seleccionadas están construidas y desplegadas; la hipótesis que las
justifica **nunca se midió**. Bajo la propia regla 1, el siguiente incremento no
es una historia de la lista: es el instrumento que le falta a H-01 — y **CU-10 no
tiene ni siquiera historia, porque no tiene actor**.

### Ciclo 1 · **VETO** · cuatro hallazgos terminales

**1. El bloque «medido HOY» no reproducía.** El documento publicaba, bajo prompt
`$` y el rótulo *«Lo medido hoy, en esta corrida»*:

```
$ npm run verificar:citas
21/21 comprobaciones PASS · CITAS: PASS   exit=0
```

El `21/21` es de la iteración anterior —`LEDGER.md` y `STATE.md`, **antes de que
el archivo existiera**—. Al escanearse a sí mismo el documento agrega dos
comprobaciones: el número real es **23/23**. Se copió del ledger y se lo presentó
como transcripción de una corrida.

**Y ocurrió dentro de la sección que declara que *«un PASS viejo no es una
medición de hoy»*.** El defecto no es el número: es haber escrito una
transcripción sin correrla. Es la misma familia que INT-12 y que el gate de
evidencia — un artefacto que *afirma* el resultado de una verificación.

**2. La razón de descarte de H-07 era falsa contra el árbol.** Decía que el
descuadre *«no se puede demostrar sin datos de varios días»*. No acumula nada:

```
src/app/dueno/descuadre.tsx:30  const diferencia = valido ? valor - ocupacionRegistrada : null;
src/app/dueno/descuadre.tsx:12  * decisión correcta en minimización: es una comparación puntual
scripts/verificar-meas2.mjs:231 asevera el descuadre DESPUÉS de limpiar fixtures
```

Una razón inventada que llega a la conclusión correcta sigue siendo inventada. Se
reemplazó por la verdadera, que ya estaba escrita una fila más arriba para H-06.

**3. La revelación del estado construido era selectiva.** El documento declaraba
construidas *las tres seleccionadas*. Son **siete de diez** (H-01..H-07). Y
atribuía `verificar:meas2` 10/10 **solo a H-05**, cuando el mismo verificador
asierta H-06 (`scripts/verificar-meas2.mjs:211`) y H-07 (`:232`): le regalaba la
evidencia al ganador y se la escondía a los descartados. Además el lenguaje de
los descartes —*«se agrega apenas haya salidas reales»*, *«entra en la primera
iteración post-prototipo»*— daba a entender que eran cosas por construir.

**§3 no descarta cosas por construir: descarta cosas ya desplegadas.** Corregido
con una tabla de las diez.

**4. H-03 violaba la escala del propio documento.** El eje dice *dato personal →
ALTA*; la fila decía MEDIA puntuando solo la aritmética de fracción y mínimo.
H-03 es la única de las tres seleccionadas que **devuelve una patente**
(`src/app/api/sesiones/[id]/salida/route.ts:31`). Corregida a **ALTA**. La
selección no cambió; el riesgo declarado sí, que era el punto del eje.

Más cinco menores, los cinco corregidos: `{{INSTANTE_FACTURABLE}}` marcado
**propuesto** —no está en `spec.md` §12, grepeado: 0 ocurrencias—; dos citas que
resolvían al encabezado en vez de al hecho (`casos-uso.md:515`→`:522`,
`contexto.ts:52`→`:53`); el argumento de H-02, que ahora cita el `setInterval`
(`src/app/pantalla-operador.tsx:268`) y **declara que H-02 entra sin verificador**;
y dos conteos de precisión falsa.

### Ciclo 2 · **PASA**

Los cuatro cerrados con las líneas abiertas por el auditor, no con descripciones.
Los errores del ciclo 1 **quedan escritos dentro del documento** como notas de
corrección —qué decía, por qué era falso, quién lo encontró—, no borrados.

### Evidencia de comando · corrida del ciclo 2

```
$ npm test
ℹ tests 122 · ℹ suites 30 · ℹ pass 122 · ℹ fail 0        exit=0

$ npm run verificar:citas
PASS · docs/data/seleccion-prototipo.md · todas las citas archivo:línea
       resuelven · 31 citas
23/23 comprobaciones PASS · CITAS: PASS                   exit=0

$ npm run verificar:alcance
9/9 comprobaciones PASS · ALCANCE: PASS                   exit=0
```

Registrado y **no re-corrido hoy** —exige app levantada y base—: `verificar:op1`
11/11, `verificar:salida` 11/11, `verificar:meas2` 10/10. Los tres números
existen en este ledger; comprobado con `git grep -c`.

### Nota de proceso — el commit se adelantó al veredicto

El commit `6c8754e` incluye la **versión vetada** de `seleccion-prototipo.md`: se
commiteó a pedido humano mientras el ciclo 1 estaba corriendo, declarándolo punto
de guardado y no entregable cerrado. La corrección va en el commit siguiente.
Se registra porque es una desviación de WIP=1, igual que la de M6, y no se
disimula.

### Delta de puntaje

| Ítem | Antes | Después | Por qué |
|---|---|---|---|
| 1 | 10/10 | 10/10 | sin cambio |
| 2 | 80/80 | 80/80 | sin cambio |
| 3 | **3/10** | **10/10** | selección de 1–3 historias, justificada contra los tres ejes y anclada a `spec.md` §1, con las descartadas puntuadas |
| **Total** | **93/100** | **100/100** | estimado |

**El total es una estimación propia, no una nota puesta por el evaluador.** Se
escribe como estimación y no como hecho.

---

## 2026-08-15 · **HALLAZGO DE ALCANCE · el gate no cubre `tenant` ni `plataforma`**

Se registra **acá y no solo dentro de ADR-005**, a pedido del auditor y con razón:
es un defecto **del repositorio**, y hoy vive dentro de un ADR en estado
PROPUESTO. Si ese ADR se rechaza y se archiva, el defecto se archiva con él. Acá
no.

### Qué falla

`scripts/verificar-alcance.mjs` **no rechaza** la entidad `tenant`, el rol
`plataforma` ni una pantalla de aprovisionamiento. Medido:

```
$ Select-String -Path scripts/verificar-alcance.mjs -Pattern 'plataforma'
CERO apariciones

$ Select-String -Path scripts/verificar-alcance.mjs -Pattern 'tenant'
101: const MULTISITIO_UI = /(selector|conmutador|switcher)[-_]?(de[-_]?)?(sucursal|sitio|empresa|tenant)/i;
```

Una sola aparición, y es un nombre de **conmutador de interfaz**. Y
`scripts/verificar-alcance.mjs:91` es
`pago|pagos|transaccion|transacciones|sucursal|sucursales|reserva|reservas`:
**`tenant` no está en la lista de entidades prohibidas.**

### Reproducido, no argumentado

Copia aislada del árbol, tres cosas plantadas, gate corrido contra la copia:

```
1. rol plataforma en el enum      -> PLANTADO
2. entidad tenant en el esquema   -> PLANTADA
3. pantalla de aprovisionamiento  -> PLANTADA   (src/app/plataforma/alta-cliente/page.tsx)

$ node scripts/verificar-alcance.mjs <copia>
PASS · AC-SCOPE-2 · ni el esquema ni las migraciones definen Pago/Transaccion/Sucursal/Reserva
PASS · AC-SCOPE-2 · no hay selector de sucursal ni conmutador de empresa en la interfaz
9/9 comprobaciones PASS · ALCANCE: PASS · exit=0
```

Comprobado que el archivo plantado cae dentro de la superficie escaneada: la copia
tiene **42** archivos en `src/` contra **41** del árbol real. El defecto no es que
el gate no mire: es que mira y no le importa.

### Por qué importa, dicho sin dramatizar

`CLAUDE.md` §1 declara multisitio como fila **bloqueante** de ADR-001, y ADR-004
lo mantuvo excluido **por nombre**: *«Multisitio / entidad `tenant` / rol
`plataforma`»*. **Un cambio que introduzca los tres pasa el gate y puede reportar
AC-SCOPE en verde.**

Es la misma familia que `CLAUDE.md` §1 ya documenta para la versión anterior de
AC-SCOPE-1 —*«un criterio que siempre pasa es peor que no tener criterio»*—. Ahí
el defecto era el pipe escapado de PowerShell; acá es una **enumeración
incompleta**. El gate se reescribió **por exclusión** para las pasarelas, y esa
reescritura nunca alcanzó a la fila de multisitio: quedó enumerada, y `tenant`
nunca entró en la enumeración.

**Matiz que evita el pánico:** nadie construyó nada de eso. Lo que falla es la
red, no el producto — `verificar:alcance` sigue dando 9/9 legítimos sobre el árbol
real, porque en el árbol real no hay `tenant`. Es exactamente el estado de INT-12
y del gate de evidencia: **la propiedad se sostiene, el mecanismo que la vigila
no.**

### Qué NO se hizo, y por qué

**No se corrigió.** Tocar `scripts/verificar-alcance.mjs` es tocar un verificador,
y la rama de documentación T01 tiene prohibido tocar tooling. Corregirlo bien
además no es agregar `tenant` a una lista —eso repetiría el defecto de la
enumeración—: es extenderlo **por exclusión** y probarlo con el fallo plantado
(`npm run verificar:alcance:prueba`, que ya existe).

**Queda como trabajo declarado para el implementador, con el reproducible escrito
arriba.**

---

## 2026-08-15 · Documentación T01 · entregable 5 (I3) · **VETO y después PASA**

`docs/adr/ADR-005-modelo-de-tenant-y-panel-de-administracion.md` y
`docs/SPEC-005-panel-de-administracion.md`, los dos **nuevos** y los dos en estado
**PROPUESTO**. **No se tocó `src/`, `scripts/`, `spec.md` ni migraciones**:
`git diff --stat HEAD` vacío, comprobado por el auditor.

### Qué se redactó, y qué explícitamente no

**Se redacta, no se adjudica.** Un loop no decide alcance. El ADR pone la pregunta
en condiciones de ser decidida y **no la decide**: estado PROPUESTO, decisor
*pendiente*, y la frase que cierra la puerta —*«lo único que este documento
autoriza es leerlo»*—.

**La pregunta:** ¿se habilita «N clientes, un recinto cada uno»? Con la distinción
que ADR-004 nunca adjudicó:

| | Qué es | Estado |
|---|---|---|
| **Multisitio** | un cliente con varios recintos | **rechazado** por ADR-004, con argumento |
| **Multicliente** | N clientes con un recinto cada uno | **nunca evaluado** |

Cuatro alternativas, cada una con **condición de reactivación falsable**,
**consecuencias negativas** y **verificación por estructura**. Se recomienda la
**alternativa 2** —N clientes sin entidad `tenant`—, con la razón en contra
declarada y no neutralizada: `spec.md` §1 dice que el riesgo central es adopción,
no escala. La respuesta es una **secuencia**, no una negación: primero H1 tiene un
número, después se habilitan clientes.

**El aislamiento entra como §3, antes de las alternativas**, con siete requisitos
de seguridad y de Ley 21.719. El que carga el peso es **REQ-ISO-2**: hoy ningún
verificador siembra un segundo estacionamiento, así que la separación se cumple
por construcción **y por tener un solo cliente sembrado**. Con un cliente es una
observación; con dos, un incumplimiento.

### Ciclo 1 · **VETO** · el hallazgo es del repo, no del documento

El documento afirmaba en **cinco** lugares —incluida la línea 3, el encabezado de
estado— que el gate rechaza en ejecución `tenant`, `plataforma` y la pantalla de
alta. **Es falso, y está registrado como hallazgo aparte arriba.**

Es el peor error posible en este documento en particular: **el ADR existe para
impedir que se construya antes de decidir, y lo hacía afirmando un mecanismo que
no existe.** Un implementador que lo leyera y construyera las tres cosas obtendría
`ALCANCE: PASS` y podría reportar el AC en verde.

Más seis hallazgos, todos ciertos y todos corregidos:

- **la numeración de alternativas de ADR-004 estaba mal leída** — es la
  alternativa **3**, no la 1, y `:95` no es una alternativa sino el ítem 1 de *«Se
  abre»* bajo *«Decisión propuesta»*. En el documento cuya tesis entera es *«leé
  bien qué decidió ADR-004»*;
- `usuario.email` citado a `src/db/schema.ts:51`, que es la PK: es **`:52`**;
- dos citas a ADR-004 apuntando una línea antes del texto atribuido (`:116`→`:118`,
  `:122`→`:123`) y una comilla que elidía `(spec.md §8)` sin marcarlo;
- la regla de los emails `.invalid` atribuida a `spec.md` §11, que **no la
  menciona** —cero apariciones de `invalid` en todo el archivo—: vive en
  `scripts/sembrar.mjs:108`;
- una contradicción interna sobre si AC-ISO-1 se puede construir hoy;
- AC-ADM-3 faltaba en el inventario, la razón 2 razonaba desde un placeholder
  abierto como si fuera un hecho, y la alternativa 2 no tenía condición de
  reactivación propia.

### Ciclo 2 · **PASA**

Cerrados los siete. El auditor destacó lo que más importaba: **el hueco del gate
no quedó colgado de que se acepte la alternativa 2** — está anclado también en la
alternativa 1, el statu quo, así que si el ADR se rechaza entero el hallazgo
sobrevive. Y ahora, además, vive en este ledger.

### Evidencia de comando

```
$ node scripts/verificar-citas.mjs docs/adr
ADR-005 · todas las citas archivo:línea resuelven · 33 citas
7/7 comprobaciones PASS · CITAS: PASS · exit=0

$ node scripts/verificar-citas.mjs docs
SPEC-005 · todas las citas archivo:línea resuelven · 20 citas
15/15 comprobaciones PASS · CITAS: PASS · exit=0

$ npm run verificar:alcance          9/9 PASS · ALCANCE: PASS · exit=0
$ npm run verificar:citas            23/23 PASS · CITAS: PASS · exit=0
```

`verificar:alcance` en 9/9 sobre el árbol real es legítimo **y es la mitad del
hallazgo**: da 9/9 también con el fallo plantado.

### Lo que queda para el humano, y que este ADR no puede aportar

**Un número de H1.** Las cuatro alternativas se leen distinto según H1 se sostenga
o no, y hoy no hay un solo dato. Decidir esto antes de medir H1 es decidir con la
información que ADR-004 ya identificó como faltante, y que sigue faltando.

**Ítem del Trabajo 01: ninguno.** I3 no puntúa — el trabajo eran cinco
entregables y el quinto es este ADR, que no tiene ítem de rúbrica. El puntaje
queda como lo dejó I2.

---

## 2026-08-16 · **FASE D** · el instrumento de H1 y el banco que acumula

**Lo que cambia el estado del proyecto:** hasta hoy, *«H1 nunca se midió»* era una
frase en documentos. Desde hoy es un **comando que falla**.

```
$ npm run verificar:h1
población    n   mediana       mín       máx   ¿evidencia de H1?
real         0         —         —         —   SÍ — la única que vale para H1
banco        0         —         —         —   no — y su procedencia no se comprueba
efímero      0         —         —         —   NO — tecleo de un robot, no de una persona

AC-H1-1: FAIL
exit=1
```

**El FAIL es el entregable, no una regresión.** `AC-MEAS-1` no puede fallar por
ausencia de datos: sus dos guardas son un `count(*)` sobre un `WHERE` —vacuamente
verdadero sobre el conjunto vacío— y una lectura de `information_schema`
(`scripts/verificar-meas1.mjs:53` y `:57`). *Un criterio universal es
automáticamente verdadero si no hay ningún X.* `AC-H1-1` es **existencial**: su
salida es un número, y con la base vacía no puede pasar.

### Las tres poblaciones, y por qué separarlas no es prolijidad

| Población | Filtro | ¿Evidencia de H1? |
|---|---|---|
| real | `patente NOT LIKE 'FIXT%'` | **sí, la única** |
| banco | `patente LIKE 'FIXTB%'` | no — mide la interfaz |
| efímero | resto de `FIXT%` | **NO — tecleo de un robot** |

El instrumento justificó el diseño en su primera corrida: había **4 sesiones
efímeras con mediana 1,53 s**. Un número plausible, reproducible y basura — lo
tecleó Puppeteer. Publicarlo como «mediana del tiempo de tecleo» habría sido el
`6,2 s` inventado otra vez, con más decimales.

### Lo que el instrumento NO puede saber, y por eso no lo afirma

**La procedencia de una fila no está en la base.** El auditor lo probó insertando
dos filas `FIXTB` con duraciones elegidas a mano: entraron al banco y dieron
`AC-H1-1: PASS`. Ninguna columna arreglaría eso —cualquiera con `DATABASE_URL`
escribe lo que quiera—, así que el archivo dejó de describir al banco como *«una
persona tecleando»* y lo declara en su salida:

```
LÍMITE DEL INSTRUMENTO · la procedencia de una fila NO está en la base.
```

### El banco: `FIXTB`, y solo las cerradas

`esPatenteFixture()` compara contra `FIXT` (`src/lib/fixtures.ts:15`), así que
`FIXTB…` **sigue siendo fixture para la barrera de datos personales**: `AC-PDP-1`
no se tocó, cero migraciones, cero campos, `AC-DATA-1` intacto en 8/8.

El predicado quedó `AND NOT (patente LIKE 'FIXTB%' AND estado = 'cerrada')`, y el
`AND estado = 'cerrada'` lo puso el auditor con una medición: **el banco solo
crece pasando por `activa`**, y con una fila de banco activa presente
`verificar:op1` caía a **8/11** —reabriendo el defecto por el que
`limpiarFixtures()` existe— y `verificar:meas2`, que clickea el primer botón de la
lista sin mirar la patente, **cerraba filas de banco** y las metía en el universo
de H1. El universo de H1 son las cerradas: una fila a medio terminar no es
evidencia, y protegerla rompía dos verificadores.

### Tres ciclos de auditoría, once hallazgos. Los que enseñan

**1 · «Imposible por construcción» era falso, y yo lo había declarado cumplido.**
El archivo afirmaba que publicar una mediana sin su `n` era imposible; la mediana
circulaba suelta en cuatro lugares. El auditor lo dijo con la frase exacta: *«el
defecto grave no es tener la propiedad a medias, es declararla cumplida»*.

**2 · Un número heredado republicado como medido.** El script decía *«5 de los 8
verificadores de navegador»*, copiado de `STATE.md`. Medido: **6 de 9** — faltaba
`scripts/verificar-temporizador.mjs:208`, que entró después de aquella medición.
El claim vivía en **7 lugares**; se corrigieron los cuatro en presente y se dejaron
intactas las dos narraciones fechadas y la entrada de este ledger, que es
append-only.

**3 · La premisa del prompt no reproducía.** Decía que el borrado vive en «los dos
lugares». Vive en **cinco**: tres son `DELETE` inline en `verificar-a3.mjs` y
`verificar-meas2.mjs` que no pasan por `limpiarFixtures()`. Se descubrió midiendo:
puse las sondas, corrí la regresión, y la base quedó en **0**.

**4 · El control negativo dio PASS mientras el banco moría.** Enumeraba dos
archivos. Reescrito **por exclusión** —la lección del gate de alcance—, pasó de
ver 7 borrados a **13**.

**5 · Y volvió a fallar, de otra forma.** Tomaba 400 caracteres hacia adelante, así
que un borrado quedaba absuelto por su **vecindario**. El auditor lo desarmó con
tres archivos que difieren solo en lo que tienen al lado:
`DELETE ... WHERE estado = 'cerrada'` —que borra el banco entero— pasaba por tener
debajo un borrado guardado, **que es la forma de los bloques `finally` de a3 y
meas2**. Con el corte en el cierre del literal, las tres caen.

**6 · Y el control vivo era una copia.** Re-tecleaba el `WHERE` de
`limpiarFixtures()` diciendo *«el mismo predicado»*. El auditor borró la guardia
del original y el control siguió en PASS. Ahora **extrae el `WHERE` del fuente y
lo ejecuta**; si la extracción falla, la comprobación falla.

**7 · `verificar:meas2` usaba «toda la tabla» como «los datos de esta corrida»,
en dos lugares.** Uno era `contarCerradas()`, que es la **barrera de
sincronización** que espera los cierres: con dos filas de banco ya cerradas, la
condición se cumplía **antes de tocar un botón** y el verificador reportaba
`0 cerradas · 4 activas` contra un panel con 1 salida. Un FAIL que parece del
producto y es del reloj de la prueba. Funcionaba solo porque la tabla se vaciaba
antes de cada corrida — la coincidencia de M-2, otra vez.

### Defectos del repo encontrados de paso, y corregidos

- **`limpiar:fixtures` nunca funcionó por su puerta documentada.** Era el único
  script que toca la base **sin `--env-file=.env`**, contra lo que afirmaba
  `STATE.md`. Es el mismo defecto que el ledger ya registró para `npm run sembrar`
  el 2026-08-13.
- **`verificar-ac.mjs` descartaba en silencio los AC con dígito en el medio.**
  `scripts/verificar-ac.mjs:95` filtraba con `AC-[A-Z]+-\w+`, así que la fila de
  **`AC-H1-1` no matcheaba y desaparecía**: §9 declaraba 14 criterios y el guard
  contaba 13. Un AC podía entrar a la fuente de verdad y quedar invisible para el
  guard que existe para vigilarla.
- **El veredicto tenía que ir solo en su línea.** `evidencia.mjs:362` exige
  `ETIQUETA: PASS|FAIL` al ras y sin nada detrás; con la explicación pegada, el
  bloque publicaba `SIN VEREDICTO`.

### Cambio de semántica que hay que mirar: AC-MEAS-2

`verificar-meas2.mjs` comparaba el panel contra **la tabla entera** —sin filtro de
fecha ni de estacionamiento— mientras el panel filtra por los dos. Ahora la
consulta usa los filtros del panel. **Sostengo que recién ahora verifica lo que
AC-MEAS-2 dice**, y el auditor lo confirmó midiendo: endurece en la dimensión
fecha y el desajuste anterior fallaba hacia el FAIL, no hacia el PASS falso. Pero
es un cambio de qué compara un AC vigente, y se señala en vez de esconderse.

**Riesgo declarado, no resuelto:** el corte del día está implementado dos veces
con semánticas distintas. El panel usa `getTimezoneOffset()` del **servidor**
(`src/app/dueno/page.tsx:33`), no la zona del estacionamiento; la consulta nueva
usa `date_trunc(… AT TIME ZONE e.zona_horaria)`. Coinciden con el servidor en la
zona del cliente; contra Vercel en UTC, difieren. **Es un defecto del panel.**

### Evidencia de comando · corrida final

```
$ npm run verificar:h1                       AC-H1-1: FAIL   exit=1   ← el entregable
$ npm test                    122/122, 0 fallos                       exit=0
$ npm run verificar:esquema   8/8 · AC-DATA-1: PASS                   exit=0
$ npm run verificar:invariantes 8/8                                   exit=0
$ npm run verificar:meas1     AC-MEAS-1: PASS                         exit=0
$ npm run verificar:ac        5/5 · 14 AC                             exit=0
$ npm run verificar:verificadores 41/41                               exit=0
$ npm run verificar:citas     23/23                                   exit=0
$ npm run verificar:alcance   9/9                                     exit=0

con el banco puesto (FIXTB90 cerrada hoy $700 + FIXTB04 activa):
  verificar:op1    11/11    (la activa barrida: "limpieza previa: 1 sesión/es")
  verificar:a3     11/11
  verificar:m4     29/29
  verificar:meas2  10/10    panel 3 · base 3 · panel $1700 · base $1700
  el banco sobrevivió a las cuatro, sin mutar
```

Control negativo del banco, cinco comprobaciones, y **probado con el fallo
plantado** en las dos formas:

```
predicado VIEJO en transacción     banco=0  -> el control FALLA
tres sondas de vecindario          las tres delatadas
árbol HEAD sin guardias            5 borrados desprotegidos en 4 archivos
```

### El bloque de evidencia deja de estar todo en verde, a propósito

`npm run evidencia` publica ahora `verificar:h1 · exit=1 · FAIL` y **sale con
exit 1**. Está escrito acá para que el próximo lector no lo «arregle»: mientras el
banco esté vacío, ese FAIL **es la medición**. Se cierra tecleando en la app —no
insertando filas, que el instrumento no puede impedir y sería fabricar el `6,2 s`.

### Lo que NO se hizo

- **Ninguna fila de banco quedó en la base.** Las sondas de interferencia se
  retiraron con `npm run limpiar:fixtures -- --banco`; la base terminó en **0**.
- **`src/` no se tocó**: `git status --porcelain -- src/` vacío en las tres vueltas.
- **Ningún placeholder rellenado.** `{{N_MINIMO_H1}}` se propuso en `spec.md` §12 y
  quedó abierto, con `{{UMBRAL_H1_SEGUNDOS}}` y `{{LINEA_BASE_CUADERNO_SEGUNDOS}}`.
- **El escáner del control no cubre `src/`**, y lo dice en su propia salida. Importa
  para INT-7: su mecanismo de retención va a ser un borrado por fecha en Drizzle
  dentro de `src/`, y este control no lo vería.

---

## 2026-08-16 · Harness · una sola fuente de agentes, y el análisis de escalamiento

Tres entregables en una vuelta: unificar las definiciones de agente, reparar
`/loop`, y analizar cómo escala la app. **Auditados juntos: VETO con nueve
hallazgos, cuatro bloqueantes.** Lo que sigue incluye los nueve y su corrección.

### El defecto que la duplicación ya había costado

El repo tenía los tres roles del concilio escritos dos veces. Los cuerpos eran
idénticos salvo una línea, así que la copia parecía inocua.

```
auditor         .claude → tools: Read, Grep, PowerShell        .codex → sin restricción
implementador   .claude → tools: Read, Grep, Edit, PowerShell  .codex → sin restricción
verificador     .claude → tools: Read, PowerShell              .codex → sin restricción
```

**Lo que divergió no fue el texto: fue la valla.** En `.claude` el auditor no tiene
`Edit`, así que *«No modificás código»* es una restricción del harness. En `.codex`
la misma frase era una sugerencia — para el rol que existe precisamente para no
poder aprobar lo que él mismo escribió. Y `.codex/` **no estaba en git**: era la
copia que perdió la valla y la que nadie ve en un diff.

> **Esta transcripción es ahora la única evidencia de esa medición.** El generador
> sobrescribió los `.toml` originales en su lugar y `.codex/` nunca estuvo
> versionado: no hay copia en el historial. **El orden correcto era commitear
> `.codex/` antes de regenerar.** Se registra como error de procedimiento, no como
> detalle: el archivo que introdujo el generador cita INT-12 como la lección de que
> un artefacto fuera de git no aparece en una revisión, y la repitió mientras la
> citaba.

### Lo entregado

`.claude/agents/` pasa a ser **la fuente única**. `.codex/agents/*.toml` se genera
(`npm run generar:agentes`) y **queda versionado**. `npm run verificar:agentes`
falla si divergen, y está en el catálogo de evidencia.

**La valla de `tools` se traduce a prosa, no a mecanismo**, y el `.toml` lo dice en
su cara: no se inventó una clave TOML que no se puede verificar, porque una clave
inventada parecería una restricción activa sin serlo.

### Los cuatro bloqueantes del auditor

**V2 · El guard no hacía cumplir la propiedad por la que existe.** Escribía
`if (agente.tools) { comprobar(…) }`: **la comprobación desaparecía junto con la
valla.** Reproducido — borrar `tools:` de la fuente daba `7/7 PASS` con el rol
adversarial sin restricción en los dos harnesses y sin una sola línea FAIL. Es
`CLAUDE.md` §1 al pie de la letra: *«un criterio que siempre pasa es peor que no
tener criterio»*, cometido otra vez.

Corregido con un piso: **todo rol declara su valla o es FAIL.** Y `renderCodex`
se niega a generar un `.toml` sin restricción. Probado con el fallo plantado:

```
FAIL · auditor · la fuente se puede traducir a .codex · no declara `tools`…
FAIL · auditor · declara su valla de herramientas en la fuente
FAIL · auditor · la restricción de herramientas llegó a .codex
10/13 comprobaciones PASS   exit=1
```

**Y un defecto propio que apareció al probarlo:** el guard **moría** en vez de
fallar —`renderCodex` lanzaba y el script abortaba sin veredicto—, que es el
hallazgo que originó `verificar-verificadores.mjs`. Ahora atrapa y reporta.

**V3 · El `.toml` usaba cadena básica (`"""`), donde `\` es escape.** Una ruta de
Windows —`C:\Users\…`— produce `\U`, escape inválido, y el archivo deja de
parsear. Las tres fuentes son documentación de Windows y PowerShell, así que no es
hipotético. Y **el guard no lo vería**: compara lo generado contra lo que el mismo
render produce, así que un `.toml` roto coincide consigo mismo para siempre.
Corregido a cadena literal (`'''`), que no interpreta escapes, más una
comprobación de que el cuerpo no contenga el delimitador.

**V1 · La entrega dejaba el gate de evidencia en rojo.** Agregar el guard subió
`verificar:verificadores` de 41 a 43 y sumó una fila al catálogo, y los bloques
publicados quedaron desfasados. Regenerados: hoy publican `43/43` y
`verificar:agentes 14/14`.

**V4 · Una afirmación falsa en la sección titulada «medido».** El análisis decía
*«los tres índices arrancan por `estacionamiento_id`, así que toda consulta del
producto entra por índice»*. La premisa es cierta y **la conclusión es falsa**: los
tres índices son de `sesion_vehiculo`, y **`tarifa` no tiene ninguno**. Una FK no
crea índice en Postgres, y `obtenerTarifaVigente()` (`src/lib/contexto.ts:57`)
corre **en cada salida** filtrando y ordenando esa tabla.

**Es la única consulta que degrada con la cantidad de clientes, y está en el camino
crítico del cobro** — en la sección que sostenía que el eje A cuesta *«casi nada»*.
Corregido, con el costo declarado: un índice sobre
`(estacionamiento_id, vigente_desde)`. **No se agrega acá**: es `src/db/schema.ts`
más migración, y esta sesión no toca `src/`.

### Los cinco menores, todos corregidos

- **V5** · `src/lib/cola-local.ts:92` es `export function guardar(…)`: no prueba el
  orden disco-antes-que-red. La evidencia está en
  `src/app/pantalla-operador.tsx:335`. La afirmación era cierta; la cita no la
  sostenía — el caso exacto que este ledger ya registró para el tecleo.
- **V6** · «los seis caminos de aislamiento» son **cinco**. `src/lib/auth.ts:88`
  filtra por `usuario.id`: es de donde **sale** la clave de cliente, no donde se
  aplica. `ADR-005:80` la describe bien; el análisis la había reetiquetado.
- **V7** · `usuario.email` es **único global** con un solo `estacionamiento_id`:
  **una persona no puede ser usuaria de dos clientes.** Es una restricción de
  multicliente que vive en el modelo, en la misma tabla cuya carencia es la tesis,
  y faltaba en la sección «lo que ya está listo».
- **V8** · `/loop` **seguía embebiendo estado** —*«ADR-005 está PROPUESTO»*— once
  líneas debajo de prometer que no lo haría. Generalizado: *nada se construye sobre
  un ADR que no esté ACEPTADO; el estado de cada ADR se lee de su archivo*.
- **V9** · El análisis había perdido el candado que ADR-005 sí puso. Decía *«un
  movimiento gratis y disponible hoy»*, que un implementador bajo `/loop` lee como
  luz verde. Restaurado: **que no dependa de una decisión no lo autoriza.**

### La tesis del análisis, que el auditor verificó y sostiene

**El eje «más clientes» no está bloqueado por el modelo de datos: está bloqueado
por la autenticación**, y eso falta en ADR-005 §6.

```
src/db/schema.ts:50-60   usuario = { id, email, rol, estacionamiento_id, created_at }
src/lib/auth.ts:114      exigirEnv("CLAVE_ACCESO")   ← una sola, para todos
src/app/api/login/route.ts:84   if (!fila || !claveOk)
```

Cualquier email **que exista en `usuario`** más la clave compartida da sesión como
esa persona. Con un cliente es una clave de piloto; con N es una falla de
aislamiento que ninguna cláusula `WHERE` corrige, porque el aislamiento funciona
*después* de autenticar. Y agregar credencial por usuario **rompe `AC-DATA-1`** —
27 campos exactos— así que exige enmendar `spec.md` §4 y migrar.

### `/loop` estaba desfasado por un hito entero

Decía *«M5 va 1/5 (A-3 cerrado)»* y *«Empezá por el GATE TERMINAL (A-2) ahora»*.
**M5 cerró el 2026-08-10 y A-2 el 2026-08-09.** Reescrito como protocolo que
**lee** el estado en vez de embeberlo: un comando que embebe estado se desfasa;
uno que lo lee no puede.

### Evidencia de comando

```
npm run verificar:agentes        14/14 · AGENTES: PASS      exit=0
  con el fallo plantado          10/13 · FALLARON: 3        exit=1
npm run verificar:verificadores  43/43                      exit=0
npm run verificar:citas          23/23                      exit=0
node verificar-citas.mjs docs    17/17 · análisis: 21 citas exit=0
npm run verificar:ac              5/5 · 14 AC               exit=0
npm run verificar:alcance         9/9                       exit=0
npm run evidencia --actualizar   11/12 · el único FAIL es verificar:h1, por diseño
```

### Sobre MCP, y por qué no hay nada acá

Se revisó lo conectado —Canva, Gmail, Drive, Calendar, Notion, Typeform,
SurveyMonkey, Docusign— y **ninguno responde una pregunta abierta del proyecto**.
Se deja escrito para que la omisión sea decisión y no olvido: inventar una
integración plausible sería la forma «harness» del `6,2 s`.

---

## 2026-08-16 · **CORRECCIÓN** de la entrada anterior · los índices de `tarifa`

Entrada nueva y no edición: este ledger es append-only, y la afirmación falsa
quedó escrita arriba. **Corregirla borrándola sería el defecto que persigue.**

### Qué dije mal

La entrada anterior publica, en su hallazgo V4:

> *«los tres índices son de `sesion_vehiculo`, y **`tarifa` no tiene ninguno**»*

**Las dos mitades son falsas.** Una `PRIMARY KEY` **es** un índice en Postgres, y
el esquema tiene ocho, no tres. Medido contra la base viva —no leyendo el SQL, que
es lo que me hizo equivocar—:

```
índices reales: 8
  estacionamiento   estacionamiento_pkey           (id)
  sesion_vehiculo   sesion_vehiculo_activa_unica   (estacionamiento_id, patente)
  sesion_vehiculo   sesion_vehiculo_pkey           (id)
  sesion_vehiculo   sesion_vehiculo_por_estado     (estacionamiento_id, estado)
  sesion_vehiculo   sesion_vehiculo_por_salida     (estacionamiento_id, estado, salida_at)
  tarifa            tarifa_pkey                    (id)
  usuario           usuario_email_unique           (email)
  usuario           usuario_pkey                   (id)

tarifa: 1 índice · ¿alguno sirve a un filtro por estacionamiento_id? NO
```

### Qué se sostiene, y qué hay que leer en su lugar

**La conclusión no cambia y ahora está mejor sostenida:** `tarifa` **no tiene
índice sobre `estacionamiento_id`** —el único que tiene es el de su PK, sobre
`id`, que no sirve a esa consulta—, y `obtenerTarifaVigente()`
(`src/lib/contexto.ts:57`) corre en cada salida filtrando por ese campo. Sigue
siendo el único punto del eje A que crece con el eje B.

Tres índices **explícitos** (`CREATE INDEX`); ocho en total contando claves.

### Por qué se registra como hallazgo y no como errata

**La afirmación falsa se escribió en el párrafo que corregía una afirmación
falsa del mismo género.** V4 vetó *«toda consulta del producto entra por índice»*
por ser una categórica más fuerte que lo medido; la corrección introdujo
*«`tarifa` no tiene ningún índice»*, otra categórica más fuerte que lo medido, en
la misma sección titulada «medido».

**La lección operativa, que es nueva:** cuando la corrección de una afirmación
sobre el esquema se escribe leyendo el DDL, se hereda el vocabulario del DDL —ahí
`CREATE INDEX` y `PRIMARY KEY` son cosas distintas— y se pierde lo que la base
hace con ellas. **Contra el esquema se mide con `pg_indexes`, no con `grep` sobre
las migraciones.**

### Y las dos notas que el mismo ciclo cerró

- **El guard de agentes miraba que la valla existiera, no qué permitía.** Un
  `tools: Read, Grep, Edit, Write, PowerShell` en el rol adversarial daba 14/14 —
  con el `.codex` generado instruyéndole que podía escribir—. Ahora se comprueba
  **por contenido** (qué dice el rol que hace, no una lista de nombres) que el rol
  que audita no declare herramientas de escritura. Probado con el fallo plantado:
  `FAIL · auditor · el rol que audita no puede escribir · declara Edit, Write`,
  15/16, exit 1.
- **Un BOM en la fuente mataba el guard sin veredicto.** `agentes()` estaba fuera
  de todo `try` — el mismo hallazgo que dije haber cerrado, una línea más arriba, y
  alcanzable por el accidente más probable de este entorno. Se saca el BOM en
  `leerAgente` y la lectura se atrapa. Con BOM puesto: **16/16**, ya no muere.

---

## 2026-08-16 · Harness (unificación + análisis + `/loop`) · **FAIL** · BoundedLoop agotado

Tercer ciclo sin PASA. La regla del concilio es la que este mismo repo escribió
—*«al 3.º sin PASA → registrá FAIL y detené el hito»*, hoy en
`.claude/commands/loop.md`— y se aplica sin descuento. **Se registra el FAIL.**

Es el tercer BoundedLoop que se agota en la historia del proyecto, después de
INT-12 y del gate de evidencia. Y como en esos dos, hay que decir con precisión
**qué** falla, porque no es todo.

### Lo que NO falla

| | |
|---|---|
| La unificación de agentes | **funciona.** Fuente única, `.codex` generado y versionado, guard que caza toda divergencia probada |
| La tesis del análisis de escalamiento | **verificada por el auditor**: el bloqueo del eje B es la autenticación, no el modelo de datos |
| `/loop` | reparado: estaba desfasado por un hito entero |

### Lo que falla: el ciclo, no el artefacto

**B1 · La comprobación de quién puede escribir se auto-anulaba, por segunda vez.**
La versión del ciclo 2 preguntaba `if (/adversarial|audit/i.test(name + description))`
— es decir, **la condición se evaluaba sobre texto que el archivo auditado
controla**. El auditor lo reprodujo:

```
name: revisor-critico
tools: Read, Grep, Edit, Write, PowerShell
→ 15/15 comprobaciones PASS · AGENTES: PASS · exit=0
```

El rol adversarial con `Edit` y `Write`, el `.codex` instruyéndole que puede
escribir, **y ninguna línea FAIL**: el recuento baja de 16 a 15 y nada lo nombra.

Y el comentario decía *«se detecta por CONTENIDO y no por una lista de nombres»*
sobre una regex que **es** una lista de dos nombres. Es el caso de
`api/cobro-salida/` que obligó a reescribir AC-SCOPE-1 **por exclusión**
(`CLAUDE.md` §1), aplicado a la prosa en vez de a la ruta.

**Corregido tras el veto, y se registra como corrección, no como PASA.** La forma
que no se anula **afirma sobre el conjunto**: los roles que declaran herramientas
de escritura tienen que ser exactamente `{implementador}`. Falla si el auditor
gana `Edit`, falla si aparece un cuarto rol que escribe, y falla **cerrado** si se
renombra al implementador. Probado con el bypass exacto del auditor:

```
FAIL · solo implementador declara herramientas de escritura
       escriben: auditor, implementador · esperado: implementador
15/16 comprobaciones PASS   exit=1
```

**B2 · Se trabajó sobre el árbol mientras el auditor lo auditaba. Es mío y es
WIP=1.** A pedido humano se implementaron dos mejoras —la columna `Tipo` en §9 y
el huérfano declarado— con el ciclo 3 en vuelo. Yo juzgué *«no se pisan»* y **me
equivoqué**: lo que se movió fue `spec.md` —la fuente de verdad— y
`scripts/verificar-ac.mjs`, y el bloque de evidencia quedó publicando
`verificar:ac 5/5 PASS` mientras el comando daba `5/7 FAIL` a medio cablear.

El auditor lo cazó por `mtime` y tiene razón en las tres consecuencias: **el
auditor audita un árbol congelado**; `git status -- src/` vacío es una vitrina
angosta, porque lo que se movió pesa más que `src/`; y el gate de evidencia lo
detectó solo. Hoy el cableado está terminado y `verificar:ac` da 9/9 — **pero eso
es una medición nueva, no la de este ciclo.**

### Qué queda abierto

**El hito se detiene.** La unificación no se declara verificada: se declara
**funcionando y no verificada**, igual que INT-12. Reabrirlo exige decisión
humana, no otra vuelta encubierta.

### Evidencia de comando · árbol quieto

```
npm test                    122/122            exit=0
npm run verificar:ac          9/9              exit=0
npm run verificar:agentes    16/16             exit=0   (bypass plantado: 15/16, exit=1)
npm run verificar:verificadores 43/43          exit=0
npm run verificar:citas      23/23             exit=0
npm run verificar:alcance     9/9              exit=0
npm run verificar:esquema     8/8              exit=0
npm run verificar:invariantes 8/8              exit=0
npm run evidencia            11/12 · el único FAIL es verificar:h1, por diseño
git status --porcelain -- src/   vacío
```

---

## 2026-08-16 · spec-driven · el huérfano declarado y la clasificación de los AC

**Entregable nuevo, cerrado en código y SIN AUDITAR.** Se declara así.

### El huérfano declarado

Hasta hoy un verificador sin AC se reportaba `INFO · decisión pendiente de
especificar-o-soltar`. El argumento para no fallar era bueno y **se conserva
entero**: forzar el FAIL empujaría a especificar retroactivamente todo lo que
tiene verificador, y eso es **autorar requisitos**, no formalizar.

Pero «pendiente» sin fecha ni gate es una decisión que no se toma, y el contador
crecía en silencio: **subió de 5 a 6 el 2026-08-16 cuando agregué
`verificar:agentes`, y nada falló.**

La regla que cierra la fuga sin romper el argumento: **nadie está obligado a subir
un verificador a §9; todos están obligados a declararlo.** Un huérfano declarado
en `SOLTADOS`, con su motivo y dónde vive la decisión, es legítimo. Un huérfano
**no declarado es FAIL**.

Los cinco motivos **no se inventaron**: ya estaban escritos —`spec.md` §9 nota de
FASE C para `endurecimiento`, `m4`, `ui`, `int12`; `matriz-trazabilidad.md:96`
para `temporizador`—. Esto los vuelve exigibles. Y `verificar:agentes` entró a
`META_GUARDS`, que es donde va: vigila el andamio, no el producto.

Más el espejo, para que el mapa no se desfase del territorio: **un soltado que ya
no es huérfano también falla**.

### La clasificación universal / existencial

Columna nueva `Tipo` en la tabla de §9. **Nueve universales, cinco existenciales.**

- **universal** — *«todo X cumple P»*: **pasa sobre el conjunto vacío**.
- **existencial** — exige que exista al menos un X; su salida útil es un número.

**Por qué:** `AC-MEAS-1` estuvo meses en verde sin un dato. El criterio hacía
exactamente lo que decía; **lo que faltaba era la obligación de preguntárselo.**
Ahora cada AC declara su tipo, y hay un piso: **al menos uno tiene que ser
existencial**, o §9 entero podría pasar sobre un sistema vacío — que es el estado
del que este proyecto salió ayer.

**Es una declaración de quien escribe el AC, no una medición**, y el guard
comprueba que esté, no la re-deriva. Queda dicho en `spec.md`: afirmar que está
medida sería el defecto que estas notas persiguen.

**Que un AC sea universal no lo vuelve malo** —«el proyecto compila» no puede ser
otra cosa—; lo que era malo era no saber cuáles podían aprobar la nada.

### Probado con el fallo plantado, las dos

```
AC-BUILD-1 sin tipo          → FAIL · cada AC declara si es universal o existencial   8/9  exit=1
verificar:inventado huérfano → FAIL · todo verificador está en §9 o declarado como soltado
                                      sin declarar: verificar:inventado                8/9  exit=1
sano                                                                                   9/9  exit=0
```

`verificar:ac` pasó de 5 a **9 comprobaciones**. `spec.md` §9 ganó una columna y
dos notas; `scripts/verificar-ac.mjs`, el mapa `SOLTADOS` con los cinco motivos.

**Sin auditar. No se declara verificado.**

---

## 2026-08-17 · FASE D-2 — **FAIL registrado. Hito detenido.**

**Tres ciclos con el auditor, tres VETO. La regla del concilio dice que un tercer
ciclo sin PASA se registra FAIL y se detiene el hito. Esto es eso.**

No se abre un ciclo 4. Seguir parcheando es exactamente lo que la regla existe
para impedir: cada ronda cerró la forma concreta que el auditor había plantado y
dejó viva la propiedad, y las tres veces el auditor encontró la propiedad por
otro lado. El defecto no está en las mutaciones que faltaron: está en el diseño
del guard, y eso no se arregla con una cuarta corrección del mismo tipo.

### El diagnóstico, que es de quien escribió el guard y no del auditor

**Se blindó un punto —la mediana, por su forma sintáctica exacta— en vez de la
propiedad.** Mientras el ancla sea un regex sobre el texto del fuente y la sonda
un solo punto sobre una sola columna, la superficie no cubierta —`min`, `max`,
el estadístico, el `WHERE` del universo, y cualquier transformación monótona—
sigue siendo mayor que la cubierta.

### Los tres hallazgos del ciclo 3, todos reproducidos por el auditor

**D-1 · `min` y `max` no los cubre ninguna de las cuatro capas.** El ancla mira
solo lo que hay entre `WITHIN GROUP (` y `) AS mediana`; la sonda lee solo
`filas[0].mediana`; el guard por exclusión usa `col - col`, que es justo lo que
el bypass del ciclo 2 evade. Con la mutación puesta:

```
min(EXTRACT(EPOCH FROM salida_at) - EXTRACT(EPOCH FROM entrada_at)) AS minimo,
max(EXTRACT(EPOCH FROM salida_at) - EXTRACT(EPOCH FROM entrada_at)) AS maximo

4/4 comprobaciones PASS · AC-H1-2: PASS · exit=0
FILA PUBLICADA: {"poblacion":"banco","n":1,"mediana":7,"minimo":3600,"maximo":3600}
```

3600 s es la permanencia, impresa bajo el encabezado *«tiempo de tecleo =
tecleo_fin_at − tecleo_inicio_at (spec.md §6)»*. Dos de las tres expresiones
publicadas quedan fuera del criterio, y `spec.md:348` dice **«toda»**.

**Y sin piso:** el detalle pasó de `3 resta(s) revisada(s)` a `1` y siguió en
PASS. `verificar-h1.mjs:352` tiene piso explícito por esta misma razón;
`metrica.mjs` no lo tiene, mientras su propio encabezado condena el criterio que
pasa sobre el conjunto vacío.

**D-2 · El ancla se apunta a un señuelo — y es el hallazgo grave.** El regex
engancha el **primer** `percentile_cont` del archivo, y `AS\s+mediana` no tiene
límite de palabra: matchea `AS mediana_referencia`. Un señuelo aliasado secuestra
el ancla y la columna real queda sin verificar.

```sql
percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (tecleo_fin_at - tecleo_inicio_at))) AS mediana_referencia,
percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(EXTRACT(EPOCH FROM (tecleo_fin_at - tecleo_inicio_at)), 10)) AS mediana,
```

Con una fila de tecleo real de 40 s:

```
FILA PUBLICADA: {"mediana":10,"minimo":40,"maximo":40}
4/4 comprobaciones PASS · AC-H1-2: PASS
```

**Tecleo real 40 s, mediana publicada 10 s, criterio en verde.** Es el `6,2 s`
inventado otra vez, ahora con un guard firmándolo. La sonda de cuatro instantes
no puede verlo **por construcción**: es un solo punto, y toda transformación
monótona que comprima valores por encima de 7 s le resulta invisible.

**D-3 · `BORRA-BANCO-A-PROPOSITO` es auto-servicio.** La marca es un `test()` de
texto: no verifica transacción, ni `throw`, ni rollback. El auditor plantó un
borrado real, confirmado, sin transacción, con la marca copiada, y el control lo
aprobó — `15 borrado(s) revisado(s)`, PASS. La aserción se llama *«**prueba** que
no toca el banco»* y con la marca pasa a ser autodeclaración: el modo de falla que
este ledger ya registró para INT-12, *«el historial se puede forjar»*.

La transacción de `metrica.mjs` **sí revierte siempre** —el auditor lo verificó y
es correcto—. El defecto es que la marca no está atada a esa propiedad.

### Lo que el auditor verificó como cierto, y queda en pie

- **La sonda de cuatro instantes es correcta.** Seis pares, seis números
  distintos, incluidos los invertidos. No hay expresión de duración plausible
  distinta de la declarada que dé 7 s sobre ella. El FAIL nombra el par medido.
- **La corrección de la exculpación es correcta y está probada con una regresión
  real.** Con el control negativo roto, el bloque publicó:
  `⚠ **REGRESIÓN, no el entregable.** Se esperaba banco-vacio y falló por control-negativo`.
  Dos líneas `CAUSA:` son inalcanzables, y `interpretar()` no puede confundirlas
  con un veredicto.
- **La regresión reclamada es exacta:** `test 122/122 · alcance 9/9 ·
  alcance:prueba 15/15 · ac 9/9 · citas 49/49 · verificadores 45/45 · agentes
  16/16 · metrica 4/4 · esquema 8/8 · invariantes 8/8`.

### Consecuencia sobre AC-H1-2

**AC-H1-2 no se declara verificado.** El criterio de §9 es el correcto y se deja
escrito; lo que no se sostiene es su columna de verificación: `verificar:metrica`
en verde **no** prueba «toda expresión», prueba la mediana por su forma exacta
más un punto de la consulta real. Se corrige el texto de §9 para que diga lo que
el comando hace, y la deuda queda acá, visible, en vez de disimulada detrás de un
PASS.

**Publicar un PASS que reclama más de lo que verifica es el defecto que este repo
persigue desde AC-SCOPE-1.** No se repite para salvar un hito.

### La salida técnica, documentada y NO implementada

El guard correcto no mira el fuente: **fija las tres estadísticas con datos.**
Con tres o más filas de duraciones conocidas y distintas, `mediana`, `mín` y
`máx` quedan cada una determinada por los datos, y una transformación monótona
—el bypass de D-2— se delata sola. No necesita ancla, ni regex, ni marca: no le
importa cómo esté escrito el SQL. Queda escrito para quien retome; **no se
construye acá**, porque el hito está detenido.

