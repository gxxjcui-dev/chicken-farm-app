import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/batches/[id]  出栏（status → finished）或更新备注
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.action === "finish") {
      data.status = "finished";
    } else {
      if (body.status) data.status = String(body.status);
      if (body.note !== undefined) data.note = body.note ? String(body.note) : null;
    }
    const batch = await prisma.batch.update({ where: { id }, data });
    return NextResponse.json(batch);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "更新批次失败" }, { status: 500 });
  }
}
