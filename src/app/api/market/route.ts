export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

// BRAPI free plan: 1 asset per request, 15.000 req/month, 30-min data refresh
// No FIIs, Tesouro Direto, options or futures on free tier
// Optional: set BRAPI_TOKEN in .env.local / Vercel env to track usage on your account
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "ticker obrigatório" }, { status: 400 });
  }

  const token = process.env.BRAPI_TOKEN;
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";

  try {
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?interval=1d&fundamental=false&dividends=false${tokenParam}`;
    const res = await fetch(url, { next: { revalidate: 1800 } }); // 30-min cache matches free plan refresh rate
    if (!res.ok) throw new Error(`brapi.dev ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro ao buscar cotação" }, { status: 502 });
  }
}
