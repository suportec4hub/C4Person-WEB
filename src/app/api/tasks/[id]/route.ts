import { NextRequest, NextResponse } from "next/server";
import { db, formatDoc } from "@/lib/firebase";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await db.collection("tasks").doc(id).update(body);
  const doc = await db.collection("tasks").doc(id).get();
  return NextResponse.json(formatDoc(doc));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.collection("tasks").doc(id).delete();
  return NextResponse.json({ success: true });
}
