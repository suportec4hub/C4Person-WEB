import { NextRequest, NextResponse } from "next/server";
import { db, formatDoc } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";

export async function GET() {
  const snap = await db.collection("transactions").orderBy("transaction_date", "desc").get();
  return NextResponse.json(snap.docs.map(formatDoc));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = { ...body, created_at: FieldValue.serverTimestamp() };
  const ref = await db.collection("transactions").add(data);
  const doc = await ref.get();
  return NextResponse.json(formatDoc(doc));
}
