import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecordDate } from "@/lib/dateUtils";
import { checkEnvRecord } from "@/lib/alerts";

// POST /api/records/env  环境记录
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, recordDate, period, outdoorTemp, temperature, humidity, ammonia, recorder, note } = body;
    if (!batchId || !period) {
      return NextResponse.json({ error: "批次和时段为必填项" }, { status: 400 });
    }
    if (!["morning", "noon", "evening"].includes(period)) {
      return NextResponse.json({ error: "时段必须为 morning/noon/evening" }, { status: 400 });
    }
    const rec = await prisma.envRecord.create({
      data: {
        batchId: Number(batchId),
        recordDate: parseRecordDate(recordDate),
        period: String(period),
        outdoorTemp: outdoorTemp !== undefined && outdoorTemp !== "" ? Number(outdoorTemp) : null,
        temperature: temperature !== undefined && temperature !== "" ? Number(temperature) : null,
        humidity: humidity !== undefined && humidity !== "" ? Number(humidity) : null,
        ammonia: ammonia !== undefined && ammonia !== "" ? Number(ammonia) : null,
        recorder: recorder ? String(recorder) : null,
        note: note ? String(note) : null,
      },
    });
    // 告警判定
    const alerts = await checkEnvRecord(rec.id);
    return NextResponse.json({ record: rec, alerts }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存环境记录失败" }, { status: 500 });
  }
}
