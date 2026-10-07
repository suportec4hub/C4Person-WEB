export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://status.pluggy.ai/api/status", {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`status.pluggy.ai responded ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro ao buscar status" }, { status: 502 });
  }
}
