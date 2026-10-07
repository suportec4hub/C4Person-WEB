export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO
  category: "economia" | "tecnologia";
}

// Google News RSS topic URLs (PT-BR / Brasil)
const FEEDS = [
  {
    category: "economia" as const,
    // Google News "Business" topic for Brazil
    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtcHlLQUFQAQ?hl=pt-BR&gl=BR&ceid=BR:pt-BR",
  },
  {
    category: "tecnologia" as const,
    // Google News "Technology" topic for Brazil
    url: "https://news.google.com/rss/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRGRqTVhZU0FtcHlLQUFQAVgAKAAqAA?hl=pt-BR&gl=BR&ceid=BR:pt-BR",
  },
];

// Simple XML extraction — no dependencies needed
function extractItems(xml: string, category: "economia" | "tecnologia"): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const titleM = block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                   block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const linkM  = block.match(/<link>([\s\S]*?)<\/link>/) ||
                   block.match(/<link\s+href="([^"]+)"/);
    const dateM  = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const srcM   = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);

    const title = titleM?.[1]?.trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"') ?? "";
    const url   = linkM?.[1]?.trim() ?? "";
    const src   = srcM?.[1]?.trim().replace(/<!\[CDATA\[(.*?)\]\]>/, "$1").replace(/&amp;/g, "&") ?? "";
    let   iso   = "";
    try { iso = dateM?.[1] ? new Date(dateM[1]).toISOString() : ""; } catch { iso = ""; }

    if (title && url) items.push({ title, url, source: src, publishedAt: iso, category });
    if (items.length >= 12) break;
  }
  return items;
}

// Module-level cache — survives hot-reloads in dev, shared across requests in prod
let cache: { items: NewsItem[]; ts: number } = { items: [], ts: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  if (cache.items.length > 0 && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ items: cache.items, cached: true });
  }

  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, category }) => {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Feedfetcher-Google; +http://www.google.com/feedfetcher.html)",
          "Accept": "application/rss+xml, application/xml, text/xml",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      return extractItems(xml, category);
    })
  );

  const items: NewsItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }

  // Interleave categories for balanced display
  const eco  = items.filter(i => i.category === "economia");
  const tech = items.filter(i => i.category === "tecnologia");
  const interleaved: NewsItem[] = [];
  const maxLen = Math.max(eco.length, tech.length);
  for (let i = 0; i < maxLen; i++) {
    if (eco[i])  interleaved.push(eco[i]);
    if (tech[i]) interleaved.push(tech[i]);
  }

  if (interleaved.length > 0) {
    cache = { items: interleaved, ts: Date.now() };
  }

  return NextResponse.json({
    items: interleaved,
    cached: false,
    fetchedAt: new Date().toISOString(),
  });
}
