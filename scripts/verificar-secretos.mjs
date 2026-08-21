/**
 * AC-SECRET-1 · el árbol versionado no lleva secretos ni rutas de la máquina.
 *
 * Viene de la guía traducida en `docs/guia-2026-08-20-traduccion.md` §5: es el
 * único criterio suyo que agrega una propiedad que esta suite no verificaba. Y
 * pesa acá por dos hechos, no por prudencia genérica: **el repositorio es
 * público** y **trata dato personal**.
 *
 * Escanea lo que `git ls-files` versiona — no el directorio—, porque lo que
 * importa es lo que se publica, no lo que existe en disco. `.env` está ignorado
 * y por eso no aparece; si algún día dejara de estarlo, este criterio lo vería.
 *
 * Las excepciones se DECLARAN con su motivo, igual que los verificadores
 * huérfanos de `verificar-ac.mjs`. No hay lista blanca por comodidad.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Cada patrón exige una FORMA de secreto, no su nombre.
 *
 * Es deliberado que `sk-` suelto o `gh_` suelto no basten: si el criterio saltara
 * con la mención del patrón, sería imposible documentarlo —este archivo y la
 * traducción hablan de ellos— y la salida se llenaría de ruido hasta que alguien
 * la apagara. Un criterio que grita siempre se acaba ignorando, que es la otra
 * forma de no tener criterio.
 */
const PATRONES = [
  {
    nombre: "ruta absoluta POSIX de una máquina",
    re: /\/(?:Users|home)\/[A-Za-z0-9._-]+\//g,
  },
  {
    nombre: "ruta absoluta de Windows con perfil de usuario",
    re: /[A-Za-z]:\\+Users\\+[A-Za-z0-9._-]+\\+/g,
  },
  { nombre: "token de GitHub", re: /\bgh[opsu]_[A-Za-z0-9]{20,}\b/g },
  { nombre: "clave de API estilo OpenAI", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { nombre: "llave privada", re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g },
  { nombre: "credencial de AWS", re: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    nombre: "cadena de conexión con contraseña",
    re: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s:@/]+@/g,
  },
];

/**
 * Un hallazgo que **se ve como fixture** no es un secreto.
 *
 * No es una lista blanca por comodidad: es `CLAUDE.md` §3 usado como
 * discriminante. Ese archivo ya obliga a que los datos de prueba se vean como
 * datos de prueba; acá esa obligación se cobra. Una credencial real no vive en
 * un host `.invalid`, no se llama `CLAVE_DE_PRUEBA`, y no es una interpolación.
 *
 * El efecto buscado es que el criterio **siga siendo creíble**: si saltara sobre
 * las pruebas de `redactarSecretos` —que por su función tienen que contener
 * cadenas de conexión— alguien lo apagaría en una semana, y un criterio apagado
 * es peor que ninguno.
 */
const MARCAS_DE_FIXTURE =
  /\$\{|\.(?:invalid|example|test|localdomain)\b|\blocalhost\b|\b127\.0\.0\.1\b|FIXTURE|EJEMPLO|DE[_-]PRUEBA|NO[_-]REAL|XXXX|<[a-z-]+>/i;

/**
 * Excepciones declaradas. Cada una lleva su motivo, y el motivo tiene que
 * sobrevivir a que alguien lo lea en voz alta.
 */
const EXCEPCIONES = [
  {
    archivo: "scripts/verificar-secretos.mjs",
    motivo:
      "es este archivo: contiene los patrones porque su trabajo es contenerlos",
  },
];

const esperados = new Set(EXCEPCIONES.map((e) => e.archivo));

function versionados() {
  const salida = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return salida.split("\0").filter(Boolean);
}

const BINARIO = /\.(png|jpe?g|gif|webp|avif|ico|pdf|woff2?|ttf|eot|zip|gz)$/i;

const hallazgos = [];
let revisados = 0;

for (const archivo of versionados()) {
  if (BINARIO.test(archivo)) continue;
  if (esperados.has(archivo.replace(/\\/g, "/"))) continue;

  let texto;
  try {
    texto = readFileSync(archivo, "utf8");
  } catch {
    continue; // ilegible o borrado del árbol de trabajo: no es este criterio
  }
  revisados++;

  const lineas = texto.split(/\r?\n/);
  for (const patron of PATRONES) {
    for (let i = 0; i < lineas.length; i++) {
      patron.re.lastIndex = 0;
      const m = patron.re.exec(lineas[i]);
      if (!m) continue;
      // La marca se busca en la línea entera, no solo en lo que casó: el nombre
      // de la constante que la sostiene —`CLAVE_FIXTURE`— es parte de la señal.
      if (MARCAS_DE_FIXTURE.test(lineas[i])) continue;
      // Se reporta el patrón y la ubicación, NUNCA el valor: publicar el
      // hallazgo completo en un log sería filtrarlo otra vez.
      hallazgos.push({
        archivo,
        linea: i + 1,
        patron: patron.nombre,
        muestra: `${m[0].slice(0, 12)}…(${m[0].length} car.)`,
      });
    }
  }
}

console.log(`AC-SECRET-1 · ${revisados} archivos versionados revisados`);
for (const e of EXCEPCIONES) {
  console.log(`  excepción declarada · ${e.archivo} · ${e.motivo}`);
}
console.log("");

for (const h of hallazgos) {
  console.log(`FAIL · ${h.archivo}:${h.linea} · ${h.patron} · ${h.muestra}`);
}

const ok = hallazgos.length === 0;
console.log(
  ok
    ? `PASS · ningún patrón de secreto ni ruta de máquina en el árbol versionado`
    : `\n${hallazgos.length} hallazgo(s)`,
);
console.log(`AC-SECRET-1: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
