/**
 * Pantalla de respaldo sin conexión.
 *
 * El service worker la precachea en `install`, así que existe aunque nunca se
 * haya visitado. Es la última red de seguridad: el registro del operador debe
 * seguir funcionando sin señal (spec.md §3).
 */
export default function SinConexion() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">Sin conexión</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        La app sigue abierta. Lo que registres se guarda en el dispositivo y se
        sincroniza cuando vuelva la señal.
      </p>
    </main>
  );
}
