export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const DEFAULT_TICKERS = ["PETR4", "VALE3", "ITUB4", "BBDC4", "ABEV3"];
const CACHE_TTL = 30 * 60 * 1000;

let moduleCache: { items: DashboardTicker[]; ts: number } | null = null;

export interface DashboardTicker {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
}

export async function GET() {
  if (moduleCache && Date.now() - moduleCache.ts < CACHE_TTL) {
    return NextResponse.json({ items: moduleCache.items, cached: true });
  }

  const token = process.env.BRAPI_TOKEN;
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
  const tickersStr = DEFAULT_TICKERS.join(",");

  try {
    const url = `https://brapi.dev/api/quote/${tickersStr}?range=1d&interval=1d&fundamental=false&dividends=false${tokenParam}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`brapi ${res.status}`);
    const data = await res.json();

    const items: DashboardTicker[] = (data.results ?? []).map((r: any) => ({
      ticker: r.symbol ?? "",
      price: Number(r.regularMarketPrice ?? 0),
      change: Number(r.regularMarketChange ?? 0),
      changePercent: Number(r.regularMarketChangePercent ?? 0),
    }));

    moduleCache = { items, ts: Date.now() };
    return NextResponse.json({ items, cached: false });
  } catch (err: any) {
    return NextResponse.json({ items: [], error: err.message }, { status: 502 });
  }
}
