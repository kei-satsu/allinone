import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Image URL ထဲမှ public_id ကို ခွဲထုတ်ပေးသည့် Helper Function
 */
function getPublicIdFromUrl(url: string): string | null {
  try {
    // 1. /upload/ နောက်က အပိုင်းကို ပိုင်းယူမည်
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;

    // 2. Version string (ဥပမာ - v12345678/) ပါလာပါက ဖြုတ်မည်
    const pathWithoutVersion = parts[1].replace(/^v\d+\//, '');

    // 3. အနောက်ဆုံးက File Extension (.jpg, .png) ကို ဖြုတ်မည်
    const publicId = pathWithoutVersion.substring(0, pathWithoutVersion.lastIndexOf('.'));

    return publicId;
  } catch (error) {
    console.error('Public ID Extract Error:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { imageUrl, publicId } = await request.json();

    // publicId တိုက်ရိုက်ပါရင် သုံးမည်၊ မပါရင် imageUrl ကနေ ခွဲထုတ်မည်
    let targetPublicId = publicId;

    if (!targetPublicId && imageUrl) {
      targetPublicId = getPublicIdFromUrl(imageUrl);
    }

    if (!targetPublicId) {
      return NextResponse.json(
        { error: 'Public ID သို့မဟုတ် မှန်ကန်သော Image URL လိုအပ်ပါသည်' }, 
        { status: 400 }
      );
    }

    // Cloudinary Storage ပေါ်က ပုံကို ဖျက်ခြင်း
    const result = await cloudinary.uploader.destroy(targetPublicId);

    return NextResponse.json({ success: true, publicIdUsed: targetPublicId, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}