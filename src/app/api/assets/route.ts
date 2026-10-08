import { auth } from '@clerk/nextjs/server';
import { get } from '@vercel/blob';
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('Sign in first', { status: 401 });
  const path = new URL(request.url).searchParams.get('path');
  if (!path?.startsWith(`artwork/${userId}/`) || path.includes('..')) return new Response('Not found', { status: 404 });
  try {
    const blob = await get(path, { access: 'private' });
    if (!blob || blob.statusCode !== 200) return new Response('Not found', { status: 404 });
    return new Response(blob.stream, { headers: { 'Content-Type': blob.blob.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response('Could not load artwork', { status: 500 }); }
}
