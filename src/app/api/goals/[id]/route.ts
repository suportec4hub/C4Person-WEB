import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = db.batch();
  // delete all milestones with goal_id = id
  const msSnap = await db.collection("milestones").where("goal_id", "==", id).get();
  msSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection("goals").doc(id));
  await batch.commit();
  return NextResponse.json({ success: true });
}
