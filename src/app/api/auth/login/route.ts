import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const MC_UI_PASSWORD = process.env.MC_UI_PASSWORD;
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function createSessionCookie(password: string): string {
  const timestamp = Date.now().toString();
  const hmac = createHmac('sha256', password).update(timestamp).digest('hex');
  return `${timestamp}.${hmac}`;
}

export async function POST(request: NextRequest) {
  if (!MC_UI_PASSWORD) {
    return NextResponse.json(
      { error: 'UI password not configured' },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { password } = body;

  if (!password || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'Password required' },
      { status: 400 }
    );
  }

  // Timing-safe comparison
  const passwordBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(MC_UI_PASSWORD);

  const isValid =
    passwordBuffer.length === expectedBuffer.length &&
    timingSafeEqual(passwordBuffer, expectedBuffer);

  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid password' },
      { status: 401 }
    );
  }

  const sessionValue = createSessionCookie(MC_UI_PASSWORD);
  const isProduction = process.env.NODE_ENV === 'production';

  const response = NextResponse.json({ success: true });
  response.cookies.set('mc_session', sessionValue, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
