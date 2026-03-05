import { NextRequest, NextResponse } from 'next/server';

const MC_UI_PASSWORD = process.env.MC_UI_PASSWORD;
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createSessionCookie(password: string): Promise<string> {
  const timestamp = Date.now().toString();
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(timestamp));
  const hmac = bytesToHex(new Uint8Array(signature));
  return `${timestamp}.${hmac}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < aBuf.length; i++) {
    result |= aBuf[i] ^ bBuf[i];
  }
  return result === 0;
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

  if (!timingSafeEqual(password, MC_UI_PASSWORD)) {
    return NextResponse.json(
      { error: 'Invalid password' },
      { status: 401 }
    );
  }

  const sessionValue = await createSessionCookie(MC_UI_PASSWORD);
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
