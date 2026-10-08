import { auth } from '@clerk/nextjs/server';
import { database } from '@/lib/db';
import { designSchema } from '@/lib/design';
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Sign in to access your designs' }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: 'Connect Neon to enable saved designs' }, { status: 503 });
  try {
    const rows = await database()`SELECT id, name, updated_at FROM designs WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 100`;
    return Response.json(rows);
  } catch { return Response.json({ error: 'Could not load designs' }, { status: 500 }); }
}
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Sign in to save your design' }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: 'Connect Neon to enable saved designs' }, { status: 503 });
  try {
    const parsed = designSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.layers.some(l => !l.source.startsWith(`artwork/${userId}/`))) return Response.json({ error: 'Invalid design or artwork ownership' }, { status: 400 });
    const id = crypto.randomUUID();
    await database()`INSERT INTO designs (id, user_id, name, document) VALUES (${id}, ${userId}, ${parsed.data.name}, ${JSON.stringify(parsed.data)}::jsonb)`;
    return Response.json({ id }, { status: 201 });
  } catch { return Response.json({ error: 'Could not save design' }, { status: 500 }); }
}
