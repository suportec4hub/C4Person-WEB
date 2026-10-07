export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const BASE = "https://status.pluggy.ai/api";

export async function GET() {
  try {
    // Fetch summary (compact roll-up) + full snapshot in parallel
    const [summaryRes, snapshotRes] = await Promise.all([
      fetch(`${BASE}/summary`, { next: { revalidate: 30 } }),
      fetch(`${BASE}/status`,  { next: { revalidate: 30 } }),
    ]);

    const summary  = summaryRes.ok  ? await summaryRes.json()  : null;
    const snapshot = snapshotRes.ok ? await snapshotRes.json() : null;

    if (!summary && !snapshot) {
      throw new Error("Pluggy status API unavailable");
    }

    return NextResponse.json({ summary, snapshot });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro ao buscar status" }, { status: 502 });
  }
}
