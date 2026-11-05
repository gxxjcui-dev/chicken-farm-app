import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecordDate } from "@/lib/dateUtils";
import { checkMortalityRecord } from "@/lib/alerts";

// POST /api/records/mortality  死淘记录（录入后自动扣减批次存栏数）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, recordDate, count, reason, symptoms, treatment } = body;
    if (!batchId || !count || Number(count) <= 0) {
      return NextResponse.json({ error: "批次和数量为必填项（数量需大于 0）" }, { status: 400 });
    }
    const batch = await prisma.batch.findUnique({ where: { id: Number(batchId) } });
    if (!batch) {
      return NextResponse.json({ error: "批次不存在" }, { status: 404 });
    }
    const rec = await prisma.mortalityRecord.create({
      data: {
        batchId: batch.id,
        recordDate: parseRecordDate(recordDate),
        count: Number(count),
        reason: reason ? String(reason) : null,
        symptoms: symptoms ? String(symptoms) : null,
        treatment: treatment ? String(treatment) : null,
      },
    });
    // 自动扣减存栏数
    await prisma.batch.update({
      where: { id: batch.id },
      data: { currentCount: Math.max(0, (batch.currentCount ?? batch.initialCount) - Number(count)) },
    });
    // 告警判定（在扣减后执行，分母内部已按扣减前存栏还原）
    const alerts = await checkMortalityRecord(rec.id);
    return NextResponse.json({ record: rec, alerts }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存死淘记录失败" }, { status: 500 });
  }
}
