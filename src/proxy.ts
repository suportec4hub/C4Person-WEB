import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Rate limiting (in-memory sliding window) ──────────────────────────────
const store = new Map<string, number[]>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  store.set(key, timestamps);
  return true;
}

let lastClean = Date.now();
function maybeClean() {
  if (Date.now() - lastClean < 60_000) return;
  lastClean = Date.now();
  for (const [key, timestamps] of store.entries()) {
    const fresh = timestamps.filter((t) => Date.now() - t < 300_000);
    if (fresh.length === 0) store.delete(key);
    else store.set(key, fresh);
  }
}

// ── Proxy (auth guard + rate limiting) ───────────────────────────────────
export async function proxy(request: NextRequest) {
  maybeClean();

  const { pathname } = request.nextUrl;

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    const rules: [string, number, number][] = [
      ['/api/checkout',      5,   60_000],
      ['/api/process-audio', 10,  60_000],
      ['/api/chat',          20,  60_000],
      ['/api/',              120, 60_000],
    ];

    for (const [prefix, limit, windowMs] of rules) {
      if (pathname.startsWith(prefix)) {
        if (!rateLimit(`${prefix}:${ip}`, limit, windowMs)) {
          return NextResponse.json(
            { error: 'Muitas requisições. Tente novamente em instantes.' },
            { status: 429, headers: { 'Retry-After': '60' } }
          );
        }
        break;
      }
    }

    return NextResponse.next();
  }

  // Auth guard for app routes
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && (pathname.startsWith('/C4Person') || pathname.startsWith('/admin'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/C4Person'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/C4Person/:path*', '/admin/:path*', '/login', '/api/:path*'],
}
