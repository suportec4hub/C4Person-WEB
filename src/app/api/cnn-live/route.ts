export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

// CNN Money Brasil YouTube channel handle
const CHANNEL_HANDLE = "cnnbrmoney";

// Server-side cache so we don't hammer YouTube on every client render
let cache: { videoId: string | null; ts: number } = { videoId: null, ts: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchLiveVideoId(): Promise<string | null> {
  // Strategy 1: fetch the channel's /live page and extract videoId from the canonical og:url
  try {
    const res = await fetch(`https://www.youtube.com/@${CHANNEL_HANDLE}/live`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      // 8-second timeout via AbortSignal
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      // og:url contains the canonical watch URL when live: https://www.youtube.com/watch?v=VIDEO_ID
      const ogMatch = html.match(/"og:url"[^>]*content="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
      if (ogMatch) return ogMatch[1];
      // Also try the canonical link
      const canonMatch = html.match(/canonical.*?watch\?v=([a-zA-Z0-9_-]{11})/);
      if (canonMatch) return canonMatch[1];
      // videoId in ytInitialData
      const initMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
      if (initMatch) return initMatch[1];
    }
  } catch {
    // fetch failed or timed out — fall through to strategy 2
  }

  // Strategy 2: YouTube RSS feed — grab the latest video (may be the active live)
  try {
    // First try to resolve the channel ID via @handle page
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?user=${CHANNEL_HANDLE}`;
    const rssRes = await fetch(feedUrl, { signal: AbortSignal.timeout(6000) });
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
    channelUrl: `https://www.youtube.com/@${CHANNEL_HANDLE}/live`,
  });
}
