import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// BigInt → Number（V2 表主键为 BigInt，JSON 序列化前必须转换）
const toJSON = <T,>(data: T): T => JSON.parse(JSON.stringify(data, (_, v) => (typeof v === "bigint" ? Number(v) : v)));

// POST /api/v2/health-events  健康及处置事件
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, eventTime, eventType, eventCount, disposalDesc, vetOpinion, recorder } = body;
    if (!batchId || !eventType) {
      return NextResponse.json({ error: "批次和事件类型为必填项" }, { status: 400 });
    }
    if (!["dead", "eliminate", "vaccine", "medicine"].includes(eventType)) {
      return NextResponse.json({ error: "事件类型必须为 dead/eliminate/vaccine/medicine" }, { status: 400 });
    }
    const rec = await prisma.healthMedicationEvent.create({
      data: {
        batchId: Number(batchId),
        eventTime: eventTime ? new Date(eventTime) : new Date(),
        recordTime: new Date(),
        eventType: String(eventType),
        eventCount: eventCount !== undefined && eventCount !== "" ? Number(eventCount) : null,
        disposalDesc: disposalDesc ? String(disposalDesc) : null,
        vetOpinion: vetOpinion ? String(vetOpinion) : null,
        recorder: recorder ? String(recorder) : null,
      },
    });
    return NextResponse.json({ record: toJSON(rec) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存健康事件失败" }, { status: 500 });
  }
}

// GET /api/v2/health-events?batchId=&date=
export async function GET(req: NextRequest) {
  try {
    const batchId = Number(req.nextUrl.searchParams.get("batchId"));
    if (!batchId) return NextResponse.json({ error: "batchId 必填" }, { status: 400 });
    const date = req.nextUrl.searchParams.get("date");
    const where: Record<string, unknown> = { batchId, deletedAt: null };
    if (date) {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59.999`);
      where.eventTime = { gte: start, lte: end };
    }
    const list = await prisma.healthMedicationEvent.findMany({ where, orderBy: { eventTime: "desc" }, take: 100 });
    return NextResponse.json(toJSON(list));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}
