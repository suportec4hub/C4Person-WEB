export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

// BRAPI free plan: 1 asset per request, 15.000 req/month, 30-min data refresh
// Adding range=5d&interval=1d gets historicalDataPrice in the SAME request — no extra cost
// Optional: set BRAPI_TOKEN in .env.local / Vercel to link usage to your account
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker obrigatório" }, { status: 400 });

  const token      = process.env.BRAPI_TOKEN;
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
  const range      = searchParams.get("range") ?? "5d";
  const interval   = searchParams.get("interval") ?? "1d";

  try {
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&fundamental=false&dividends=false${tokenParam}`;
    const res = await fetch(url, { next: { revalidate: 1800 } }); // 30-min cache
    if (!res.ok) throw new Error(`brapi.dev ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro ao buscar cotação" }, { status: 502 });
  }
}
