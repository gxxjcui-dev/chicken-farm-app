import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecordDate } from "@/lib/dateUtils";
import { checkFeedRecord } from "@/lib/alerts";

// POST /api/records/feed  饲喂记录
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, recordDate, feedKg, waterL, feedType, note } = body;
    if (!batchId) {
      return NextResponse.json({ error: "批次为必填项" }, { status: 400 });
    }
    const rec = await prisma.feedRecord.create({
      data: {
        batchId: Number(batchId),
        recordDate: parseRecordDate(recordDate),
        feedKg: feedKg !== undefined && feedKg !== "" ? Number(feedKg) : null,
        waterL: waterL !== undefined && waterL !== "" ? Number(waterL) : null,
        feedType: feedType ? String(feedType) : null,
        note: note ? String(note) : null,
      },
    });
    const alerts = await checkFeedRecord(rec.id);
    return NextResponse.json({ record: rec, alerts }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存饲喂记录失败" }, { status: 500 });
  }
}
