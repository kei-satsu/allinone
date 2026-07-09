// app/api/telegram/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageUrl, note, barcode, branch } = await request.json();
    
    const botToken = "8772008410:AAEUuvLjm4f_w3FyJP4jqJtkAg7ORU5y7TU"; 
    const chatId = "-1004445513323";

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