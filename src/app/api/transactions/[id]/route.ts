import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.collection("transactions").doc(id).delete();
  return NextResponse.json({ success: true });
}
