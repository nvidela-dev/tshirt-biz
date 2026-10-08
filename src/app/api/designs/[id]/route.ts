import { auth } from '@clerk/nextjs/server';
import { database } from '@/lib/db';
import { z } from 'zod';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Sign in first' }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: 'Invalid design' }, { status: 400 });
  try {
    const rows = await database()`SELECT document FROM designs WHERE id = ${id} AND user_id = ${userId}`;
    if (!rows.length) return Response.json({ error: 'Design not found' }, { status: 404 });
    return Response.json(rows[0].document);
  } catch { return Response.json({ error: 'Could not open design' }, { status: 500 }); }
}
