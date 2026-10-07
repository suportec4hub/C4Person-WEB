export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  category: "economia" | "tecnologia";
}

// Multiple RSS sources per category — tried in order until one succeeds
const SOURCES = {
  economia: [
    // Google News keyword search (search-based URLs are stable)
    "https://news.google.com/rss/search?q=economia+bolsa+mercado+financeiro+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-BR",
    // G1 Economia (Globo — very reliable, always online)
    "https://g1.globo.com/rss/g1/economia/",
    // Fallback keyword variant
    "https://news.google.com/rss/search?q=mercado+financeiro+acoes+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-BR",
  ],
  tecnologia: [
    "https://news.google.com/rss/search?q=tecnologia+inteligencia+artificial+startups+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-BR",
    // G1 Tech
    "https://g1.globo.com/rss/g1/tecnologia/",
    "https://news.google.com/rss/search?q=tecnologia+inovacao+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-BR",
  ],
};

const FETCH_HEADERS = {
  // Identify as a feed reader so news sites don't redirect to HTML
  "User-Agent": "Feedfetcher-Google; (+http://www.google.com/feedfetcher.html; 1 subscribers; feed-id=1)",
  "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

/** Extract text inside a tag, handling both CDATA and raw text, decode basic entities */
function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, "i");
  const m = block.match(re);
  const raw = (m?.[1] ?? m?.[2] ?? "").trim();
  return raw
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ""); // strip any inline HTML
}

function extractAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  return block.match(re)?.[1] ?? "";
}

function parseItems(xml: string, category: "economia" | "tecnologia"): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    let title = extractTag(block, "title");
    // Google News format: "Headline - Source Name" — strip the source suffix
    const dashIdx = title.lastIndexOf(" - ");
    const sourceSuffix = dashIdx > 30 ? title.slice(dashIdx + 3) : "";
    if (dashIdx > 30) title = title.slice(0, dashIdx);

    // Link: try <link>...</link>, then <link href="..."/>
    let url = extractTag(block, "link");
    if (!url) url = extractAttr(block, "link", "href");
    // In some RSS formats link is right after </title> without being inside tags
    if (!url) {
      const linkRe = /<link\s*\/?>[\s]*([^\s<]+)/i;
      url = block.match(linkRe)?.[1] ?? "";
    }

    const pubDate = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "dc:date");
    const source  = extractTag(block, "source") || extractAttr(block, "source", "url") || sourceSuffix;

    let iso = "";
    try { iso = pubDate ? new Date(pubDate).toISOString() : ""; } catch { iso = ""; }

    if (title && url) {
      items.push({ title: title.trim(), url: url.trim(), source: source.trim(), publishedAt: iso, category });
    }
    if (items.length >= 15) break;
  }
  return items;
}

async function fetchFeed(url: string, category: "economia" | "tecnologia"): Promise<NewsItem[]> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  // Verify it's actually XML/RSS, not an HTML error page
  if (!text.includes("<item>") && !text.includes("<entry>")) {
    throw new Error("Not RSS");
  }
  const parsed = parseItems(text, category);
  if (parsed.length === 0) throw new Error("No items parsed");
  return parsed;
}

async function fetchBestFeed(category: "economia" | "tecnologia"): Promise<NewsItem[]> {
  const urls = SOURCES[category];
  let lastErr = "";
  for (const url of urls) {
    try {
      const items = await fetchFeed(url, category);
      return items;
    } catch (e: any) {
      lastErr = e?.message ?? "fetch failed";
    }
  }
  throw new Error(`All feeds failed for ${category}: ${lastErr}`);
}

// Module-level cache survives hot-reloads in dev, shared across requests in prod
let cache: { items: NewsItem[]; ts: number } = { items: [], ts: 0 };
const CACHE_TTL = 45 * 60 * 1000; // 45 minutes

export async function GET() {
  if (cache.items.length > 0 && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ items: cache.items, cached: true });
  }

  const [ecoResult, techResult] = await Promise.allSettled([
    fetchBestFeed("economia"),
    fetchBestFeed("tecnologia"),
  ]);

  const eco  = ecoResult.status  === "fulfilled" ? ecoResult.value  : [];
  const tech = techResult.status === "fulfilled" ? techResult.value : [];

  // Interleave categories so both appear throughout the carousel
  const interleaved: NewsItem[] = [];
  const maxLen = Math.max(eco.length, tech.length);
  for (let i = 0; i < maxLen; i++) {
    if (eco[i])  interleaved.push(eco[i]);
    if (tech[i]) interleaved.push(tech[i]);
  }

  if (interleaved.length > 0) {
    cache = { items: interleaved, ts: Date.now() };
  }

  const errors: string[] = [];
  if (ecoResult.status  === "rejected") errors.push(`eco: ${ecoResult.reason}`);
  if (techResult.status === "rejected") errors.push(`tech: ${techResult.reason}`);

  return NextResponse.json({
    items: interleaved,
    cached: false,
    fetchedAt: new Date().toISOString(),
    ...(errors.length ? { errors } : {}),
  });
}
