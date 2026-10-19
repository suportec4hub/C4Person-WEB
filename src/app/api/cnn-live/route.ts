export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const CHANNEL_HANDLE = "cnnbrmoney";
const LIVE_URL = `https://www.youtube.com/@${CHANNEL_HANDLE}/live`;

// Server-side cache — 2 min TTL so the link is always fresh
let cache: { videoId: string | null; ts: number } = { videoId: null, ts: 0 };
const CACHE_TTL_MS = 2 * 60 * 1000;

const YT_ID_RE = /[?&]v=([a-zA-Z0-9_-]{11})/;
const YT_EMBED_RE = /\/embed\/([a-zA-Z0-9_-]{11})/;
const YT_SHORT_RE = /youtu\.be\/([a-zA-Z0-9_-]{11})/;

function extractId(url: string): string | null {
  return (YT_ID_RE.exec(url) ?? YT_EMBED_RE.exec(url) ?? YT_SHORT_RE.exec(url))?.[1] ?? null;
}

async function fetchLiveVideoId(): Promise<string | null> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  };

  // Strategy 1: check the final redirect URL — when live, YouTube redirects
  // @channel/live → /watch?v=VIDEO_ID, so res.url gives us the ID directly.
  try {
    const res = await fetch(LIVE_URL, { headers, signal: AbortSignal.timeout(8000) });
    if (res.ok && res.url !== LIVE_URL) {
      const id = extractId(res.url);
      if (id) return id;
    }

    // Strategy 2: parse HTML for og:url / canonical / ytInitialData
    if (res.ok) {
      const html = await res.text();

      // og:url — most reliable when present
      const ogMatch = html.match(/property="og:url"\s+content="([^"]+)"/);
      if (ogMatch) { const id = extractId(ogMatch[1]); if (id) return id; }

      // <link rel="canonical">
      const canonMatch = html.match(/rel="canonical"\s+href="([^"]+)"/);
      if (canonMatch) { const id = extractId(canonMatch[1]); if (id) return id; }

      // ytInitialData videoId near "isLive":true — pick the live one if possible
      const liveIdMatch = html.match(/"isLive"\s*:\s*true[^}]{0,200}"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
      if (liveIdMatch) return liveIdMatch[1];

      // Fallback: first videoId in ytInitialData
      const initMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
      if (initMatch) return initMatch[1];
    }
  } catch {
    // network error — fall through
  }

  // Strategy 3: YouTube RSS feed (latest upload may be the active live)
  try {
    const rssRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?user=${CHANNEL_HANDLE}`,
      { headers, signal: AbortSignal.timeout(6000) }
    );
    if (rssRes.ok) {
      const xml = await rssRes.text();
      const match = xml.match(/<yt:videoId>([a-zA-Z0-9_-]{11})<\/yt:videoId>/);
      if (match) return match[1];
    }
  } catch {
    // ignore
  }

  return null;
}

export async function GET() {
  const now = Date.now();
  if (cache.videoId && now - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json({ videoId: cache.videoId, cached: true });
  }

  const videoId = await fetchLiveVideoId();
  cache = { videoId, ts: now };

  return NextResponse.json({
    videoId,
    cached: false,
    channelUrl: LIVE_URL,
  });
}
