export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q || q.length < 1) return NextResponse.json({ stocks: [] });

  const token      = process.env.BRAPI_TOKEN;
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";

  try {
    const url = `https://brapi.dev/api/quote/list?search=${encodeURIComponent(q)}&sortBy=name&sortOrder=asc&limit=8${tokenParam}`;
    const res = await fetch(url, { next: { revalidate: 300 } }); // 5-min cache for search results
    if (!res.ok) throw new Error(`brapi.dev ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro na busca", stocks: [] }, { status: 502 });
  }
}
