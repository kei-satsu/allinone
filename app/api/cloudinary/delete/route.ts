import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary ကို .env.local ထဲက Keys တွေနဲ့ ချိတ်ဆက်ခြင်း
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    // Frontend ကနေ ပေးပို့လိုက်တဲ့ publicId ကို လက်ခံမယ်
    const { publicId } = await request.json();

    if (!publicId) {
      return NextResponse.json({ error: 'Public ID လိုအပ်ပါသည်' }, { status: 400 });
    }

    // Cloudinary Storage ပေါ်က ပုံကို အပြီးတိုင် ဖျက်ချလိုက်ခြင်း
    const result = await cloudinary.uploader.destroy(publicId);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}