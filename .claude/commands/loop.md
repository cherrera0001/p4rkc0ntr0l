/loop — M5 endurecimiento por CONCILIO. Fuente: docs/revision-seguridad-2026-08-09.md.

GATE TERMINAL (antes de cualquier corrección)
- A-2: verificá por huella si la credencial fue rotada. Si la huella en Railway
  sigue siendo la de los logs → A-2 ABIERTO → el concilio NO abre M-4. Registrá
  el bloqueo y detené: es acción humana, ningún fix la resuelve. Esto es el veto
  del Auditor aplicado a la infraestructura, no una opción.

REANUDACIÓN
- STATE.md + cola de LEDGER.md. M5 va 1/5 (A-3 cerrado). No rehagas PASS.

CICLO POR HALLAZGO (orden fijo: M-4 → C-1 → A-1 → M-1+M-2; WIP=1)
1. Delegá al subagente `implementador`: corrige ESE hallazgo. Recibís diff +
   verificador + comando.
2. Delegá al subagente `auditor-adversarial`: que intente romperlo leyendo el
   código real. Si VETO → vuelve a `implementador` con el bypass. BoundedLoop: 3
   ciclos implementador↔auditor. Al 3.º sin PASA → registrá FAIL y detené el hito.
3. Con PASA del auditor, delegá al `verificador`: corre verificador + regresión
   completa, local y contra el deploy. Todo verde o es FAIL.
4. LEARN (obligatorio, no opcional): antes de cerrar el hallazgo, extraé a
   LEARNINGS.md la lección GENERALIZABLE, no el relato. Y el paso profesional:
   si la lección es recurrente (ej. "criterio atado a una herramienta que cambió",
   "efecto de módulo que exige secreto en build"), convertila en un guard o check
   reutilizable para que NO pueda regresar en silencio. La lección que no se
   vuelve mecanismo se repite.
5. Cierre: sobrescribí STATE.md, cerrá en LEDGER.md (append-only, secretos por
   huella), actualizá CLAUDE.md §2. Una línea en el chat. Siguiente hallazgo.

REGLAS DEL CONCILIO
- El implementador nunca cierra su propio trabajo. El auditor nunca implementa.
  La aprobación exige las tres voces: implementa, no-rompe, verifica-con-comando.
- El auditor que aprueba desde una descripción, en vez del código real, es el modo
  de falla que este concilio existe para evitar. Explícito en su definición.

FUERA DE ALCANCE / FRENOS
- Nada de pago/LPR/reserva/multisitio (ADR-001). No habilitar operación real:
  sigue bloqueada por {{BASE_LICITUD}} y {{PLAZO_RETENCION_PATENTE}}. Solo fixtures.
- M-4 toca el flujo offline (leer activos del servidor en vez de IndexedDB): que
  el implementador lo declare y el auditor confirme que no rompe AC-OP-1.

EFICIENCIA
- Output real = repo + LEDGER.md + STATE.md + LEARNINGS.md. Chat: una línea por
  hallazgo cerrado. Sin recaps, sin tablas, sin narrar cada delegación.

Empezá por el GATE TERMINAL (A-2) ahora.
