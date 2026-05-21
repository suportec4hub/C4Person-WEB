import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await db.collection("notes").doc(params.id).delete();
  return NextResponse.json({ success: true });
}
