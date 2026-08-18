/**
 * Roles, permisos y ruteo — una sola definicion.
 *
 * ## Por que existe
 *
 * Antes de esto, "a donde va cada rol" estaba escrito **cuatro veces**: en el
 * login, en la raiz, en el panel del dueno y ahora en plataforma. Cuatro copias
 * de la misma regla es cuatro oportunidades de que una quede vieja — y la que
 * quede vieja manda a alguien a una pantalla que no le corresponde.
 *
 * ## Lo que este modulo NO es
 *
 * **No es la autorizacion.** La autorizacion la hace `rutaAutenticada` en el
 * servidor, ruta por ruta, y el aislamiento lo hace la clausula por
 * `estacionamiento_id` de cada consulta. Esta tabla existe para **rutear y
 * mostrar**, y ocultar un boton no es negar un permiso: un rol que llegue a una
 * pantalla ajena se redirige en el servidor, no se le esconde el enlace.
 *
 * Se declara aparte, y en un solo lugar, para que la matriz de permisos del
 * contrato de API (`docs/CONTRATO-api.md`) se pueda contrastar contra algo.
 */

import type { Rol } from "./sesion-token.ts";

/** Donde trabaja cada rol. Es su pantalla, no un menu de opciones. */
export const DESTINO_POR_ROL: Record<Rol, string> = {
  operador: "/",
  "dueño": "/dueno",
  plataforma: "/plataforma",
};

/**
 * Que puede hacer cada rol, en lenguaje de producto.
 *
 * Es **descriptivo**: refleja lo que las rutas hacen cumplir, no lo sustituye.
 * Si esta tabla y una ruta discrepan, la ruta manda y la tabla esta mal.
 */
export const PERMISOS: Record<Rol, readonly string[]> = {
  operador: [
    "registrar el ingreso de un vehiculo (offline incluido)",
    "ver las sesiones activas de SU estacionamiento",
    "cerrar una salida y ver el monto a cobrar en efectivo",
  ],
  "dueño": ["ver ocupacion, ingresos observados y descuadre de SU estacionamiento"],
  plataforma: [
    "dar de alta un cliente nuevo: estacionamiento, tarifa, dueno y operador",
    // Va escrito como permiso negado a proposito: es AC-ISO-2, y el rol con mas
    // privilegio del sistema tiene que llevar su limite a la vista.
    "NO accede a ninguna patente por ninguna ruta",
  ],
};

/** A donde mandar a alguien con este rol. Falla hacia el login, no hacia adentro. */
export const destinoDe = (rol: Rol | undefined): string =>
  rol ? DESTINO_POR_ROL[rol] : "/login";
