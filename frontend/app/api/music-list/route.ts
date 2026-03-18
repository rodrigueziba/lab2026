import { readdir } from 'fs/promises';
import { join } from 'path';
export async function GET() {
  const files = (await readdir(join(process.cwd(), 'public')))
    .filter(f => f.endsWith('.mp3'));
  return Response.json({ files });
}