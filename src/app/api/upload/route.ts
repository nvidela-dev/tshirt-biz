import { auth } from '@clerk/nextjs/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: 'Connect a private Vercel Blob store to save artwork' }, { status: 503 });
  try {
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({ body, request,
      onBeforeGenerateToken: async (pathname) => {
        const { userId } = await auth();
        if (!userId || !pathname.startsWith(`artwork/${userId}/`) || pathname.includes('..')) throw new Error('Unauthorized artwork');
        return { allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp'], maximumSizeInBytes: 25 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch { return Response.json({ error: 'Artwork upload failed. Check your sign-in and storage configuration.' }, { status: 400 }); }
}
