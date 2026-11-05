import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecordDate } from "@/lib/dateUtils";
import { checkWeightRecord } from "@/lib/alerts";

// POST /api/records/weight  体重抽检
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, recordDate, sampleCount, avgWeightG, uniformity, note } = body;
    if (!batchId) {
      return NextResponse.json({ error: "批次为必填项" }, { status: 400 });
    }
    const rec = await prisma.weightRecord.create({
      data: {
        batchId: Number(batchId),
        recordDate: parseRecordDate(recordDate),
        sampleCount: sampleCount !== undefined && sampleCount !== "" ? Number(sampleCount) : null,
        avgWeightG: avgWeightG !== undefined && avgWeightG !== "" ? Number(avgWeightG) : null,
        uniformity: uniformity ? String(uniformity) : null,
        note: note ? String(note) : null,
      },
    });
    const alerts = await checkWeightRecord(rec.id);
    return NextResponse.json({ record: rec, alerts }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存体重抽检记录失败" }, { status: 500 });
  }
}
