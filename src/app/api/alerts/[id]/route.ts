import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/alerts/[id]  标记已处理
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const body = await req.json();
    const { resolvedBy, resolveNote } = body;
    const alert = await prisma.alert.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedBy: resolvedBy ? String(resolvedBy) : null,
        resolveNote: resolveNote ? String(resolveNote) : null,
        resolvedAt: new Date(),
      },
    });
    return NextResponse.json(alert);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "更新告警失败" }, { status: 500 });
  }
}
