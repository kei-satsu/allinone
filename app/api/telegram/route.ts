// app/api/telegram/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageUrl, note, barcode, branch } = await request.json();
    
    // 💡 .env.local ထဲက Variables များကို လှမ်းခေါ်သုံးခြင်း
    const botToken = process.env.TELEGRAM_BOT_TOKEN; 
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Env ကောင်းကောင်း အလုပ်လုပ်မလုပ် စစ်ဆေးခြင်း
    if (!botToken || !chatId) {
      console.error("Telegram Environment Variables are missing!");
      return NextResponse.json({ ok: false, description: "Server configuration missing" }, { status: 500 });
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: imageUrl,
        caption: `မှတ်ချက်: ${note || '-'}\nBarcode: ${barcode || '-'}\n\n#${branch}`
      })
    });

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Telegram Server Error:", error);
    return NextResponse.json({ ok: false, description: error.message }, { status: 500 });
  }
}