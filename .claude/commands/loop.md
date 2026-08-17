/loop — trabajo por CONCILIO, con BoundedLoop. Protocolo, no snapshot.

## Por qué este archivo ya no nombra un hito

Hasta el 2026-08-16 este comando decía *"M5 va 1/5 (A-3 cerrado)"* y *"Empezá por
el GATE TERMINAL (A-2) ahora"*. **M5 cerró el 2026-08-10 y A-2 el 2026-08-09**:
quien escribiera `/loop` recibía la orden de abrir un gate resuelto una semana
antes, con la autoridad de un comando del repo.

Un comando que **embebe** el estado se desfasa; uno que lo **lee** no puede. El
estado vive en `STATE.md` y `LEDGER.md`, y ante discrepancia manda el ledger.
**No vuelvas a escribir acá qué hallazgo sigue.**

## ARRANQUE (antes de tocar nada)

1. Leé `CLAUDE.md`, `STATE.md` y la cola de `LEDGER.md`. Reportá **en qué rama
   estás** (`git branch --show-current`) y qué hito está abierto. No lo asumas:
   este repo tiene trabajo en ramas paralelas.
2. `git status`. Si hay cambios sin commitear que no son tuyos, decilo antes de
   seguir.
3. Verificá los bloqueos vigentes que `STATE.md` declare. Si uno es **acción
   humana** —una credencial, un `{{placeholder}}`, una decisión de alcance—
   ningún fix lo resuelve: registralo y detenete.

## CICLO POR HALLAZGO — WIP = 1

1. **`implementador`**: corrige UN hallazgo. Diff mínimo. Devuelve el cambio, su
   verificador y el comando. **No cierra su propio trabajo.**
2. **`auditor-adversarial`**: intenta romperlo **leyendo el código real**. VETO
   (con el bypass o la regresión reproducidos) o PASA. **BoundedLoop: 3 ciclos.**
   Al tercero sin PASA → registrá **FAIL** y detené el hito. No hay cuarto intento.
3. **`verificador`**: corre el verificador del hallazgo **más la regresión
   completa**, y pega **salida real**. Todo verde o es FAIL.
4. **LEARN — obligatorio.** Extraé a `LEARNINGS.md` la lección **generalizable**,
   no el relato. Y el paso que de verdad importa: **si la lección puede repetirse,
   convertila en un guard.** La lección que no se vuelve mecanismo se repite —
   este repo lo pagó con el gate de alcance, con INT-12 y con el banco de H1.
5. **Cierre:** `STATE.md` (sobrescribible), `LEDGER.md` (append-only, secretos por
   huella), `CLAUDE.md` §2 si cambia el estado de un hito. Una línea en el chat.

## REGLAS DEL CONCILIO

- **El implementador nunca cierra su propio trabajo. El auditor nunca implementa.**
  La aprobación exige las tres voces: implementa · no-rompe · verifica-con-comando.
- **Un auditor que aprueba desde una descripción es el modo de falla que este
  concilio existe para evitar.** Está en su definición y no es negociable.
- **La duda es VETO.**
- **U7 — toda afirmación sobre el repositorio es verificable con un comando.** Y su
  forma operativa, que costó dos vetos: no alcanza con medir antes de escribir;
  hay que buscar **todas** las ocurrencias de lo que acabás de refutar. Un `grep`
  del *claim*, no del dato.
- **Nunca pegues una transcripción con prompt `$` que no corriste.** Un número
  copiado del ledger publicado como "medido hoy" ya costó un veto.

## FRENOS

- **Gate ADR-001** (`CLAUDE.md` §1): nada de pago del conductor, LPR, reservas ni
  multisitio, salvo que un ADR lo enmiende.
- **Nada se construye sobre un ADR que no esté ACEPTADO** — ni una versión chica,
  ni el hook preparado. **Leé el estado de cada ADR en su propio archivo**
  (`docs/adr/`): acá no se escribe cuál está adjudicado y cuál no, por la misma
  razón que no se escribe qué hallazgo sigue.
- **Ningún `{{placeholder}}` se rellena.** Si falta un valor, detenete y pedilo.
  Cuáles siguen abiertos lo dice `spec.md` §12, no este archivo.
- **La operación con datos reales está condicionada** a las decisiones legales que
  `spec.md` §4 nombra. El interruptor y su estado se leen del entorno y de
  `STATE.md`.
- Los bloqueos concretos de hoy están en `STATE.md`, no acá.

## EFICIENCIA

Output real = repo + `LEDGER.md` + `STATE.md` + `LEARNINGS.md`. En el chat, una
línea por hallazgo cerrado. Sin recaps ni narración de cada delegación.

## ENTORNO

Windows + PowerShell. Prefijo obligatorio para node/npm/npx/git mientras no se
reinicie Claude Code:

```powershell
$env:PATH = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path','User')
```

Empezá por el ARRANQUE y reportá el estado antes de abrir nada.
