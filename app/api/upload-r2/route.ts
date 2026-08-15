import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    const publicBaseUrl = process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

    if (!bucketName) {
      return NextResponse.json({ error: 'R2_BUCKET_NAME is missing' }, { status: 500 });
    }

    if (!publicBaseUrl) {
      return NextResponse.json({ error: 'R2 public URL is missing. Set R2_PUBLIC_URL or R2_PUBLIC_DOMAIN.' }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `intake_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;

    await R2.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: file.type || 'image/jpeg',
        ContentDisposition: 'inline',
      })
    );

    const publicUrl = publicBaseUrl.endsWith('/') ? `${publicBaseUrl}${fileName}` : `${publicBaseUrl}/${fileName}`;

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (error: any) {
    console.error('R2 Upload API Error:', error);
    return NextResponse.json({ error: error.message || 'R2 Upload Failed' }, { status: 500 });
  }
}