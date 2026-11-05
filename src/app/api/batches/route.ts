import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecordDate } from "@/lib/dateUtils";

// GET /api/batches?status=active
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const batches = await prisma.batch.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(batches);
}

// POST /api/batches  新建批次
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, houseNo, breed, startDate, initialCount, note } = body;
    if (!name || !startDate || !initialCount) {
      return NextResponse.json({ error: "批次名称、进雏日期、进雏数量为必填项" }, { status: 400 });
    }
    const batch = await prisma.batch.create({
      data: {
        name: String(name),
        houseNo: houseNo ? String(houseNo) : null,
        breed: breed ? String(breed) : null,
        startDate: parseRecordDate(String(startDate)),
        initialCount: Number(initialCount),
        currentCount: Number(initialCount),
        note: note ? String(note) : null,
      },
    });
    return NextResponse.json(batch, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "创建批次失败" }, { status: 500 });
  }
}
