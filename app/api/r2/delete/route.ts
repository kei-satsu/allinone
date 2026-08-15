import { NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

function getObjectKeyFromUrl(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    const pathname = url.pathname.replace(/^\/+/, '');
    const fileKey = pathname.split('/').filter(Boolean).pop();

    if (!fileKey) {
      return null;
    }

    return fileKey;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'No imageUrl provided' }, { status: 400 });
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json({ error: 'R2_BUCKET_NAME is missing' }, { status: 500 });
    }

    const fileKey = getObjectKeyFromUrl(imageUrl);
    if (!fileKey) {
      return NextResponse.json({ error: 'Invalid R2 object URL. Could not resolve file key.' }, { status: 400 });
    }

    await R2.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      })
    );

    return NextResponse.json({ ok: true, message: 'Deleted from R2 successfully', key: fileKey });
  } catch (error: any) {
    console.error('R2 Delete API Error:', error);
    return NextResponse.json({ error: error.message || 'R2 Delete Failed' }, { status: 500 });
  }
}