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
