# Protocolo de medición de H1

> **Método, no dato.** Este documento no contiene ni una sola medición: dice cómo
> tomarlas para que sean comparables entre sí. Ningún `{{placeholder}}` se
> resuelve acá — cuántas sesiones hacen falta y contra qué umbral se comparan son
> decisiones humanas abiertas (`spec.md` §12).
>
> Fecha: 2026-08-16 · Deriva de `docs/SPEC-D-medicion-de-H1.md` §3.2.

---

## 0. Qué se está midiendo, y por qué hace falta un protocolo

**H1** (`spec.md` §1): *un operador registra entrada + salida más rápido que en el
cuaderno.*

Comparar dos cosas exige medir las dos **en las mismas condiciones**. Sin un
procedimiento escrito, dos tandas tomadas con distinta persona, distinto teléfono
o distinta hora producen números que no se pueden poner en la misma tabla — y el
resultado se decide por cómo se midió, no por si la hipótesis es cierta.

### Las tres mediciones, y cuál es automática

| # | Qué | Cómo se toma |
|---|---|---|
| 1 | **App · ingreso** | **automática.** El sistema la instrumenta y `npm run verificar:h1` publica su mediana |
| 2 | **App · salida** | **cronómetro.** No está instrumentada — ver abajo |
| 3 | **Cuaderno · entrada + salida** | **cronómetro.** Es `{{LINEA_BASE_CUADERNO_SEGUNDOS}}`, sin resolver |

**Solo la primera es gratis.** Las otras dos las toma una persona con un
cronómetro, y sin ellas H1 no se puede concluir: la 1 sola responde *«cuánto tarda
teclear una patente en la app»*, que es media hipótesis.

> **Por qué la salida no está instrumentada.** `registrarSalida()`
> (`src/app/pantalla-operador.tsx:346`) no marca ningún instante, y `salida_at`
> dice **cuándo** ocurrió, no **cuánto tardó**. Instrumentarla exige campos nuevos
> y `AC-DATA-1` compara los 27 exactos de `spec.md` §4: sería enmendar la fuente de
> verdad más una migración. El fundamento completo está en `spec.md` §6.

---

## 1. Antes de empezar

1. **Vaciá el banco de la tanda anterior** si vas a empezar una serie nueva:
   `npm run limpiar:fixtures -- --banco`. Sin el flag, el banco se conserva: eso
   es lo que lo hace acumulable.
2. **Comprobá el punto de partida:** `npm run verificar:h1`. Va a decir
   `AC-H1-1: FAIL` si el banco está vacío. **Ese FAIL es correcto** — es la
   ausencia de datos hecha visible, no un defecto.
3. **Anotá las condiciones** (§3). Si cambian a mitad de una serie, la serie se
   parte en dos: no se mezclan.

---

## 2. El procedimiento, por sesión

Una **sesión de medición** es un ciclo completo: un vehículo entra y sale.

### 2.1 · Entrada en la app

1. El operador está en su pantalla, ya autenticado.
2. Toca **Nuevo ingreso**. *(acá arranca el cronómetro del sistema)*
3. Teclea la patente y confirma. *(acá para)*

**No hagas nada entre el paso 2 y el 3.** El instrumento mide exactamente ese
tramo: cualquier pausa —mirar el teléfono, hablar con el conductor— entra al
número. Si te interrumpen, **descartá esa sesión** (§4).

### 2.2 · Salida en la app — con cronómetro

1. Arrancá el cronómetro **cuando el operador mira la pantalla para buscar el
   vehículo**.
2. Toca *Salida* sobre la fila.
3. Pará el cronómetro **cuando el monto es legible en pantalla**, que es cuando el
   operador puede cobrar.
4. Anotá el valor junto a la patente.

### 2.3 · El mismo ciclo en el cuaderno

Con **otro** vehículo y el mismo operador, en el mismo turno:

1. Cronómetro al empezar a escribir la patente; parada al terminar el renglón.
2. A la salida: cronómetro al empezar a buscar el renglón; parada **cuando el
   monto está calculado y dicho en voz alta**.

**Las dos mitades, o la comparación no cierra.** En el cuaderno la salida incluye
buscar el renglón y calcular el monto; en la app es un toque. Medir solo la
entrada favorece al cuaderno.

---

## 3. Qué hay que mantener constante, y anotar

Cualquiera de estas que cambie parte la serie:

| Condición | Por qué importa |
|---|---|
| **Quién teclea** | la variabilidad entre personas es mayor que la que se busca medir |
| **Qué dispositivo** | teclado en pantalla, tamaño y latencia cambian el tiempo |
| **Con red o sin red** | el ingreso funciona sin red (`spec.md` §5); la salida **no** |
| **Momento del turno** | la primera hora y la última no son lo mismo |
| **De memoria o leyendo** | leer la patente de un papel no es lo mismo que del auto |

Anotá también **la fecha y el turno**: sin eso, dos series no se pueden separar
después.

---

## 4. Cuándo descartar una sesión

Descartala —y anotá por qué— si:

- hubo una interrupción entre *Nuevo ingreso* y confirmar;
- la patente se tecleó mal y hubo que corregirla **después** de confirmar;
- el operador estaba aprendiendo la interfaz (las primeras son de aprendizaje, no
  de operación);
- la sesión quedó `activa` y se cerró más tarde: la limpieza la barre, y con razón.

**Una sesión descartada no se borra a mano de la base**: si ya se registró, dejala
y anotá su patente en la lista de descartes. Borrar filas selectivamente es
exactamente cómo una muestra se sesga sin que nadie lo note.

---

## 5. La convención de patentes

- **Banco de medición:** `FIXTB` + dígitos → `FIXTB01`, `FIXTB02`, …
  Sobrevive a la limpieza **solo cuando la sesión está cerrada**
  (`scripts/lib/fixtures.mjs`).
- **No uses `FIXT` + dos dígitos**: ése es el espacio de los verificadores, y
  `npm run verificar:h1` falla si alguien lo invade.

Las patentes del banco **son datos de prueba**: no son dato personal y por eso el
piloto puede operar con ellas sin resolver `{{BASE_LICITUD}}`.

---

## 6. Cómo mirar el avance

```
npm run verificar:h1
```

Publica `n`, mediana, mínimo y máximo **por población**, y separa el banco de lo
que dejan los verificadores. Dice además, junto al número, **qué mitad de H1
mide**.

**Lo que este comando no puede saber, y por eso no lo afirma:** de dónde salió una
fila. Un `INSERT` con duraciones a mano entra al banco y da PASS. **Por eso el
banco se llena tecleando en la app y no por SQL** — no hay mecanismo que lo
impida, solo este párrafo.

---

## 7. Lo que este protocolo no resuelve

| Abierto | Qué bloquea |
|---|---|
| `{{N_MINIMO_H1}}` | **cuántas sesiones** hacen falta para que la mediana signifique algo. Mientras no se decida, cada sesión suma y el número es **provisional** |
| `{{LINEA_BASE_CUADERNO_SEGUNDOS}}` | contra qué se compara. Se **mide** con este mismo protocolo (§2.3); lo que falta es tomarla |
| `{{UMBRAL_H1_SEGUNDOS}}` | por debajo de qué valor H1 se da por validada |

Los tres son decisión humana (`spec.md` §12). **Este protocolo produce los
insumos; no produce el veredicto.**
