import { NextResponse } from 'next/server';

// 1. Branch အလိုက် Telegram Channel ID Mapping သတ်မှတ်ခြင်း
const BRANCH_CHANNEL_MAP: Record<string, string | undefined> = {
  MDY: process.env.TELEGRAM_CHANNEL_MDY,
  YGN: process.env.TELEGRAM_CHANNEL_YGN,
  // သုံးစွဲနေသော Branch အသစ်များရှိပါက ဒီနေရာတွင် ဆက်လက် ထည့်သွင်းနိုင်ပါသည်
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageUrl, note, barcode, branch } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN ကို Environment Variables ထဲတွင် ရှာမတွေ့ပါ။');
      return NextResponse.json(
        { ok: false, error: 'Server configuration error: Missing bot token' },
        { status: 500 }
      );
    }

    // 2. Branch အပေါ် မူတည်၍ သက်ဆိုင်ရာ Channel ID ကို ယူမည်
    // မတူညီသော Branch ဖြစ်နေပါက DEFAULT CHANNEL ဆီသို့ ပို့မည်
    const targetChatId =
      (branch && BRANCH_CHANNEL_MAP[branch]) ||
      process.env.TELEGRAM_DEFAULT_CHANNEL_ID;

    if (!targetChatId) {
      console.error(`Branch [${branch}] အတွက် သတ်မှတ်ထားသော Channel ID မရှိပါ။`);
      return NextResponse.json(
        { ok: false, error: `No Telegram channel configured for branch: ${branch}` },
        { status: 400 }
      );
    }

    // 3. Telegram Message Format ပြင်ဆင်ခြင်း (HTML Mode)
    const captionText = `
<b>Note:</b> ${escapeHtml(note || '-')}
<b>Barcode:</b> <code>${escapeHtml(barcode || '')}</code>
`.trim();

    // 4. Telegram Bot API သို့ Request ပို့ခြင်း
    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        photo: imageUrl,
        caption: captionText,
        parse_mode: 'HTML',
      }),
    });

    const result = await telegramRes.json();

    if (!telegramRes.ok || !result.ok) {
      console.error('Telegram API Error Response:', result);
      return NextResponse.json(
        { ok: false, error: result.description || 'Failed to send message to Telegram' },
        { status: telegramRes.status || 400 }
      );
    }

    return NextResponse.json({ ok: true, data: result });

  } catch (error: any) {
    console.error('Telegram Route Server Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * HTML Special Characters များကို Escape လုပ်ပေးသည့် Helper Function
 * (Telegram Parse Mode မှာ Error မတက်စေရန် ကာကွယ်ပေးပါသည်)
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}