import { NextRequest, NextResponse } from 'next/server';

// Log warning at startup if auth is disabled
const MC_API_TOKEN = process.env.MC_API_TOKEN;
if (!MC_API_TOKEN) {
  console.warn('[SECURITY WARNING] MC_API_TOKEN not set - API authentication is DISABLED (local dev mode)');
}

const MC_UI_PASSWORD = process.env.MC_UI_PASSWORD;
if (!MC_UI_PASSWORD) {
  console.warn('[SECURITY WARNING] MC_UI_PASSWORD not set - UI login is DISABLED');
}

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute HMAC-SHA256 using Web Crypto API (Edge Runtime compatible).
 */
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Timing-safe comparison using Web Crypto API.
 */
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

/**
 * Validate the mc_session cookie.
 * Cookie format: `timestamp.hmac_sha256(timestamp, MC_UI_PASSWORD)`
 */
async function isValidSession(cookieValue: string, password: string): Promise<boolean> {
  const dotIndex = cookieValue.indexOf('.');
  if (dotIndex === -1) return false;

  const timestamp = cookieValue.substring(0, dotIndex);
  const signature = cookieValue.substring(dotIndex + 1);

  // Check expiry
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Date.now() - ts > SESSION_MAX_AGE_MS) return false;

  // Verify HMAC signature
  const expectedSignature = await hmacSha256(password, timestamp);
  return timingSafeEqual(signature, expectedSignature);
}

/**
 * Check if a request originates from the same host (browser UI).
 */
function isSameOriginRequest(request: NextRequest): boolean {
  const host = request.headers.get('host');
  if (!host) return false;

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (!origin && !referer) return false;

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) return true;
    } catch {
      // Invalid origin header
    }
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host) return true;
    } catch {
      // Invalid referer header
    }
  }

  return false;
}

// Demo mode — read-only, blocks all mutations
const DEMO_MODE = process.env.DEMO_MODE === 'true';
if (DEMO_MODE) {
  console.log('[DEMO] Running in demo mode — all write operations are blocked');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- UI Auth: protect all non-API routes ---
  if (!pathname.startsWith('/api/')) {
    // If MC_UI_PASSWORD is not set, UI is open (dev mode)
    if (MC_UI_PASSWORD) {
      // Always allow /login page
      if (pathname !== '/login') {
        const sessionCookie = request.cookies.get('mc_session')?.value;
        if (!sessionCookie || !(await isValidSession(sessionCookie, MC_UI_PASSWORD))) {
          const loginUrl = request.nextUrl.clone();
          loginUrl.pathname = '/login';
          return NextResponse.redirect(loginUrl);
        }
      }

      // If user is on /login but already has a valid session, redirect to dashboard
      if (pathname === '/login') {
        const sessionCookie = request.cookies.get('mc_session')?.value;
        if (sessionCookie && (await isValidSession(sessionCookie, MC_UI_PASSWORD))) {
          const dashboardUrl = request.nextUrl.clone();
          dashboardUrl.pathname = '/';
          return NextResponse.redirect(dashboardUrl);
        }
      }
    }

    // Add demo mode header for UI detection
    if (DEMO_MODE) {
      const response = NextResponse.next();
      response.headers.set('X-Demo-Mode', 'true');
      return response;
    }
    return NextResponse.next();
  }

  // --- API Auth: protect /api/* routes ---

  // Always allow auth endpoints
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Demo mode: block all write operations
  if (DEMO_MODE) {
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      return NextResponse.json(
        { error: 'Demo mode — this is a read-only instance. Visit github.com/crshdn/mission-control to run your own!' },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // If MC_API_TOKEN is not set, API auth is disabled (dev mode)
  if (!MC_API_TOKEN) {
    return NextResponse.next();
  }

  // Allow requests with a valid UI session cookie (browser UI calling API)
  if (MC_UI_PASSWORD) {
    const sessionCookie = request.cookies.get('mc_session')?.value;
    if (sessionCookie && (await isValidSession(sessionCookie, MC_UI_PASSWORD))) {
      return NextResponse.next();
    }
  }

  // Allow same-origin browser requests (UI fetching its own API)
  if (isSameOriginRequest(request)) {
    return NextResponse.next();
  }

  // Special case: /api/events/stream (SSE) - allow token as query param
  if (pathname === '/api/events/stream') {
    const queryToken = request.nextUrl.searchParams.get('token');
    if (queryToken && queryToken === MC_API_TOKEN) {
      return NextResponse.next();
    }
  }

  // Check Authorization header for bearer token
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);

  if (token !== MC_API_TOKEN) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico / favicon.svg
     */
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg).*)',
  ],
};
