import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// BigInt → Number（V2 表主键为 BigInt，JSON 序列化前必须转换）
const toJSON = <T,>(data: T): T => JSON.parse(JSON.stringify(data, (_, v) => (typeof v === "bigint" ? Number(v) : v)));

// POST /api/v2/equipment-logs  设备操作记录
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, operateTime, deviceType, deviceNo, operateAction, statusBefore, statusAfter, controllerSetValue, operateType, operatorNote, operator } = body;
    if (!batchId || !deviceType || !deviceNo || !operateAction) {
      return NextResponse.json({ error: "批次、设备类型、设备编号和动作为必填项" }, { status: 400 });
    }
    if (!["fan", "water_curtain"].includes(deviceType)) {
      return NextResponse.json({ error: "设备类型必须为 fan（风机）/ water_curtain（湿帘）" }, { status: 400 });
    }
    if (!["start", "stop", "set_param"].includes(operateAction)) {
      return NextResponse.json({ error: "动作必须为 start/stop/set_param" }, { status: 400 });
    }
    const rec = await prisma.equipmentOperationLog.create({
      data: {
        batchId: Number(batchId),
        operateTime: operateTime ? new Date(operateTime) : new Date(),
        deviceType: String(deviceType),
        deviceNo: String(deviceNo),
        operateAction: String(operateAction),
        statusBefore: statusBefore ? String(statusBefore) : null,
        statusAfter: statusAfter ? String(statusAfter) : null,
        controllerSetValue: controllerSetValue ? String(controllerSetValue) : null,
        operateType: operateType ? String(operateType) : "manual",
        operatorNote: operatorNote ? String(operatorNote) : null,
        operator: operator ? String(operator) : null,
      },
    });
    return NextResponse.json({ record: toJSON(rec) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存设备操作记录失败" }, { status: 500 });
  }
}

// GET /api/v2/equipment-logs?batchId=&date=
export async function GET(req: NextRequest) {
  try {
    const batchId = Number(req.nextUrl.searchParams.get("batchId"));
    if (!batchId) return NextResponse.json({ error: "batchId 必填" }, { status: 400 });
    const date = req.nextUrl.searchParams.get("date");
    const where: Record<string, unknown> = { batchId, deletedAt: null };
    if (date) {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59.999`);
      where.operateTime = { gte: start, lte: end };
    }
    const list = await prisma.equipmentOperationLog.findMany({ where, orderBy: { operateTime: "desc" }, take: 100 });
    return NextResponse.json(toJSON(list));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}
