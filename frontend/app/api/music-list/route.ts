import { readdir } from 'fs/promises';
import { join } from 'path';
// Z107: la lista se arma en el build y se sirve como archivo estático (sin función en Vercel). Antes, el readdir de
// /public en tiempo de ejecución hacía que el trazado de archivos metiera los mp3 y mediapipe en la función (265 MB > 250).
// No depende de la petición, así que la respuesta es la misma. En desarrollo (npm run dev / Docker) se sigue leyendo en
// cada pedido; en producción, una canción nueva aparece en el próximo build.
export const dynamic = 'force-static';
export const revalidate = false;
export async function GET() {
  const files = (await readdir(join(process.cwd(), 'public')))
    .filter(f => f.endsWith('.mp3'));
  return Response.json({ files });
}