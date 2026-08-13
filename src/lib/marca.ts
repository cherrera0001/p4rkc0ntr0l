/**
 * Los pocos valores de marca que el CSS no puede entregar.
 *
 * AC-UI-1 exige que todo color salga de una variable declarada **una sola vez**.
 * `--canvas` vive en `globals.css` y eso alcanza para todo lo que se pinta en el
 * documento. No alcanza para dos lugares que se resuelven fuera del CSS:
 *
 *   - `themeColor` del viewport — lo lee el sistema operativo para pintar la
 *     barra de estado de la app instalada.
 *   - `background_color` / `theme_color` del manifiesto — los usa la pantalla de
 *     arranque, que se muestra ANTES de que exista una hoja de estilos.
 *
 * Si estos tres divergen de `--canvas`, la app instalada parpadea en otro color
 * al abrir y deja una costura visible contra la barra del sistema. Por eso el
 * valor se declara acá una vez y se importa, en lugar de repetirse.
 *
 * **Si cambia `--canvas` en `globals.css`, cambia acá.** Es la única duplicación
 * que el sistema de diseño no puede eliminar, y queda anotada como tal.
 */

/** Espejo de `--canvas` en `src/app/globals.css`. */
export const COLOR_CANVAS = "#fafaf9";
