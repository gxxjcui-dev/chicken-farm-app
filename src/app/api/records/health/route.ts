import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecordDate } from "@/lib/dateUtils";

// POST /api/records/health  免疫用药记录
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, recordDate, type, productName, dosage, method, operator, note } = body;
    if (!batchId || !type) {
      return NextResponse.json({ error: "批次和类型为必填项" }, { status: 400 });
    }
    if (!["vaccine", "medicine", "disinfection"].includes(type)) {
      return NextResponse.json({ error: "类型必须为 vaccine/medicine/disinfection" }, { status: 400 });
    }
    const rec = await prisma.healthRecord.create({
      data: {
        batchId: Number(batchId),
        recordDate: parseRecordDate(recordDate),
        type: String(type),
        productName: productName ? String(productName) : null,
        dosage: dosage ? String(dosage) : null,
        method: method ? String(method) : null,
        operator: operator ? String(operator) : null,
        note: note ? String(note) : null,
      },
    });
    return NextResponse.json({ record: rec, alerts: [] }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存免疫用药记录失败" }, { status: 500 });
  }
}
