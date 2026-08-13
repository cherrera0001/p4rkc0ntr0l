# ADR-004 — Multisitio bajo un tenant y cobro de la suscripción

**Estado:** **PROPUESTO — requiere decisión humana. No implementar.**
**Fecha del borrador:** 2026-08-12
**Decisor:** Cristóbal Herrera (pendiente)
**Enmienda:** ADR-001 (alcance por exclusión), en dos filas de su tabla y solo dos.
**Origen:** capa de diseño importada de Claude Design
`964c3090-9776-4aa0-a79f-816b50244a83`, traducida en
`docs/diseno-2026-08-12-traduccion.md`.

> Este archivo existe porque `CLAUDE.md` §1 lo exige: *"Si una tarea parece
> exigir algo de esta tabla: detenerse, decirlo, y pedir el ADR."* Es el pedido,
> redactado en el formato del repo para que decidir cueste poco. **Mientras diga
> PROPUESTO, el gate sigue rechazando todo lo que hay acá.**

---

## Contexto

ADR-001 excluyó cinco cosas de la v1: pago/pasarela, LPR/cámara, reservas,
multisitio y barreras físicas. La exclusión no fue por falta de tiempo: fue el
mecanismo para que el piloto probara H1 y H2 en vez de perseguir paridad de
producto. `spec.md` §1 lo dice sin rodeos — *"el riesgo central es adopción, no
escala"*.

La capa de diseño de 2026-08-12 propone una plataforma comercial completa:
empresas con varios estacionamientos, planes en UF, cobro por pasarela y un
backoffice de C4A. **Ocho de sus catorce pantallas son inconstruibles bajo
ADR-001.** El diseño lo reconoce en su primera tarjeta y pide este ADR.

Lo que cambió desde ADR-001, y que hace que la pregunta sea legítima ahora:

- **M0–M5 están cerrados en código.** La v1 existe, funciona punta a punta y
  pasó un endurecimiento completo.
- **H2 no se puede validar sin cobrar.** `spec.md` §1 define H2 como *"un dueño
  paga una suscripción mensual en UF"*. Con ADR-001 vigente no hay forma de que
  nadie pague dentro del sistema: H2 solo se puede validar por fuera, a mano.
  **Esta es la tensión real que ADR-004 resuelve o no.**
- **Multisitio no tiene ese argumento.** Ninguna hipótesis lo necesita. Un dueño
  con tres estacionamientos puede probar H1 y H2 con uno.

## Decisión propuesta

Enmendar ADR-001 en **dos** filas, dejando las otras tres intactas:

### Se abre

1. **Entidad `tenant`** sobre `estacionamiento` (1..N sitios). El aislamiento es
   por `tenant_id`, no por sitio: un operador ve un sitio, un dueño ve su
   empresa.
2. **Entidad `suscripcion`** — plan, estado, UF/mes por tenant.
3. **Pasarela local (`{{PASARELA_SUSCRIPCION}}`: Webpay o Flow) exclusivamente
   para la suscripción.**
4. **Rol nuevo `plataforma`** — backoffice de C4A, sin acceso a `patente`.

### Sigue excluido — sin cambios

- **El cobro del estacionamiento al conductor sigue siendo en efectivo, fuera
  del sistema.** Esta es la línea que no se mueve. Ningún pago de conductor pasa
  por la app.
- LPR / cámaras / barreras físicas.
- Reserva de cupos.
- Cualquier campo de patente que no exija H1.

## Consecuencias

### Lo que se pierde

- **La superficie de dato personal se multiplica.** Hoy hay un estacionamiento y
  un conjunto de patentes. Con tenants hay N conjuntos que **no se pueden
  mezclar nunca**, y el aislamiento pasa a ser un requisito de cumplimiento, no
  una comodidad. Cada consulta del producto necesita su cláusula de tenant, y
  cada una es un M-1 esperando a ocurrir.
- **INT-7 se agrava.** El mecanismo de retención de patente **sigue sin existir**
  y sigue bloqueado por `{{PLAZO_RETENCION_PATENTE}}` y `{{BASE_LICITUD}}`.
  Multiplicar tenants antes de resolverlo multiplica el incumplimiento.
- **Entra una pasarela de pago al repo.** Con ella: PCI por adherencia, un
  secreto más, un webhook expuesto, un estado de suscripción que puede
  desincronizarse del cobro real, y un proveedor más en la factura (ADR-003 ya
  rompió *"un proveedor, una factura"*; esto lo rompe otra vez).
- **AC-SCOPE-1 y AC-SCOPE-2 dejan de ser el gate que son hoy.** Sus `grep` de
  `webpay|flow` y de entidades prohibidas empiezan a dar positivo por diseño.
  Hay que reescribirlos para que sigan rechazando el pago **del conductor** y
  permitan el de la suscripción — un gate más fino es un gate más frágil.
- **El backoffice `plataforma` cruza el aislamiento por definición.** Es el rol
  con más poder del sistema y el más difícil de acotar.

### Lo que se gana

- **H2 se vuelve medible.** Es el único argumento fuerte, y es fuerte: sin cobro
  dentro del producto, `{{UMBRAL_H2_DUEÑOS}} dueños pagando` es una encuesta, no
  una medición.
- Un dueño con varios sitios ve su operación consolidada — el descuadre por
  sitio es la pantalla que el diseño defiende mejor.
- C4A puede ver el estado del piloto sin pedirle capturas a nadie.

### Riesgo principal

**Construir la plataforma antes de haber validado H1.** El `tecleo mediano` real
todavía no se ha medido: la maqueta muestra `6,2 s`, pero es un número inventado
(ver la traducción, §5.2). Si H1 no se sostiene, la plataforma multi-tenant es
infraestructura cara sobre una hipótesis falsa. `spec.md` §1 fue escrito
precisamente para no hacer eso.

## Alternativas consideradas

1. **No enmendar (statu quo).** El piloto sigue con un sitio y un dueño; H2 se
   valida por fuera (transferencia manual, carta de intención). *Barato,
   honesto, y suficiente para un piloto.* Es la alternativa por defecto.
2. **Enmendar solo el cobro de la suscripción, no el multisitio.** Toma el único
   punto con hipótesis detrás y deja fuera el que no la tiene. **Es la enmienda
   mínima** y la que se recomienda evaluar primero: cuatro de las ocho pantallas
   bloqueadas (`1i`, `1j`, parte de `1f`) se desbloquean sin tocar el
   aislamiento de datos.
3. **Enmendar los dos puntos (lo que el diseño pide).** Máximo alcance, máximo
   riesgo de dato personal, y multisitio sin hipótesis que lo justifique.

## Precondiciones — se cumplan o no se abre M7

Aunque este ADR se acepte, **nada se construye hasta que**:

1. `{{BASE_LICITUD}}` y `{{PLAZO_RETENCION_PATENTE}}` estén resueltos, y
   **INT-7 tenga mecanismo, no solo valores.**
2. El endurecimiento de M5 esté **desplegado**. Hoy producción sirve el código
   anterior (`STATE.md`).
3. H1 tenga una medición real, no la cifra de la maqueta.
4. `{{PRECIO_SUSCRIPCION_UF}}` esté decidido — sin él no hay nada que cobrar.
5. Los placeholders nuevos de la traducción §6 estén resueltos.

## Qué hacer con este archivo

- **Si se acepta:** cambiar el estado, firmar, reescribir AC-SCOPE-1/2 en
  `spec.md` §9, y recién entonces abrir M7.
- **Si se rechaza:** cambiar el estado a *rechazado* y dejarlo. El ledger
  conserva por qué, y la próxima vez que alguien traiga un diseño multi-tenant
  la respuesta ya está escrita.
- **Mientras diga PROPUESTO:** el gate rechaza. `1a`, `1d`, `1h`, `1i`, `1j`,
  `1k`, `1m` no se construyen ni en versión chica ni con el hook preparado.
