import { NextResponse } from 'next/server';

const developmentOrigins = new Set([
  'http://localhost:8081',
  'http://127.0.0.1:8081',
]);

function allowedOrigins() {
  const origins = new Set(
    (process.env.INTAKE_ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  if (process.env.NODE_ENV !== 'production') {
    for (const origin of developmentOrigins) origins.add(origin);
  }

  return origins;
}

function isAllowedOrigin(request: Request, origin: string) {
  return origin === new URL(request.url).origin || allowedOrigins().has(origin);
}

export function isAllowedIntakeRequest(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || isAllowedOrigin(request, origin);
}

export function withIntakeCors(request: Request, response: Response) {
  const origin = request.headers.get('origin');
  if (!origin || !isAllowedOrigin(request, origin)) return response;

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.headers.set('Access-Control-Max-Age', '86400');
  response.headers.append('Vary', 'Origin');
  return response;
}

export function intakeCorsOptions(request: Request) {
  if (!isAllowedIntakeRequest(request)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }
  return withIntakeCors(request, new Response(null, { status: 204 }));
}

export function intakeCorsJson(
  request: Request,
  body: unknown,
  init?: ResponseInit,
) {
  return withIntakeCors(request, NextResponse.json(body, init));
}
