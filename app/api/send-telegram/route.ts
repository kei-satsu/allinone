import { NextResponse } from 'next/server';

const BRANCH_CHANNEL_MAP: Record<string, string | undefined> = {
  MDY: process.env.TELEGRAM_CHANNEL_MDY,
  YGN: process.env.TELEGRAM_CHANNEL_YGN,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl, note, barcode, branch, caption } = body;

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const targetChatId =
      (branch && BRANCH_CHANNEL_MAP[branch]) ||
      process.env.TELEGRAM_DEFAULT_CHANNEL_ID ||
      process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN) {
      return NextResponse.json(
        { ok: false, error: 'Server configuration error: Missing bot token' },
        { status: 500 }
      );
    }

    if (!targetChatId) {
      return NextResponse.json(
        { ok: false, error: `No Telegram channel configured for branch: ${branch || 'default'}` },
        { status: 400 }
      );
    }

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      return NextResponse.json(
        { ok: false, error: 'Image URL is missing or invalid for Telegram upload' },
        { status: 400 }
      );
    }

    const captionText = `
<b>Note:</b> ${escapeHtml(note || caption || '-')}
<b>Barcode:</b> <code>${escapeHtml(barcode || '')}</code>
`.trim();

    const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;

    const res = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        photo: imageUrl,
        caption: captionText,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Telegram API Error Details:', data);
      return NextResponse.json(
        { ok: false, error: data.description || 'Telegram API request failed' },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error('Server Action Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}