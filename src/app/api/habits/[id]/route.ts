import { NextRequest, NextResponse } from "next/server";
import { db, formatDoc } from "@/lib/firebase";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  await db.collection("habits").doc(params.id).update(body);
  const doc = await db.collection("habits").doc(params.id).get();
  return NextResponse.json(formatDoc(doc));
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await db.collection("habits").doc(params.id).delete();
  return NextResponse.json({ success: true });
}
