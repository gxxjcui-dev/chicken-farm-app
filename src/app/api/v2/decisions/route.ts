import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// BigInt → Number（V2 表主键为 BigInt，JSON 序列化前必须转换）
const toJSON = <T,>(data: T): T => JSON.parse(JSON.stringify(data, (_, v) => (typeof v === "bigint" ? Number(v) : v)));

// POST /api/v2/decisions  厂长决策记录
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, decisionTime, recordDate, actualOperation, operationReason, consultOther, envAfterChange, chickenPerformance, decisionMaker } = body;
    if (!batchId || !decisionMaker) {
      return NextResponse.json({ error: "批次和决策人为必填项" }, { status: 400 });
    }
    // 服务端计算日龄
    const batch = await prisma.batch.findUnique({ where: { id: Number(batchId) } });
    if (!batch) return NextResponse.json({ error: "批次不存在" }, { status: 404 });
    const base = recordDate ? new Date(recordDate) : new Date();
    const start = new Date(batch.startDate);
    const dayAge = Math.round((new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 86400000) + 1;
    const rec = await prisma.managerDecisionLog.create({
      data: {
        batchId: Number(batchId),
        decisionTime: decisionTime ? new Date(decisionTime) : new Date(),
        recordDate: recordDate ? new Date(recordDate) : new Date(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`),
        dayAge,
        actualOperation: actualOperation ? String(actualOperation) : null,
        operationReason: operationReason ? String(operationReason) : null,
        consultOther: consultOther ? String(consultOther) : null,
        envAfterChange: envAfterChange ? String(envAfterChange) : null,
        chickenPerformance: chickenPerformance ? String(chickenPerformance) : null,
        decisionMaker: String(decisionMaker),
      },
    });
    return NextResponse.json({ record: toJSON(rec) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存决策记录失败" }, { status: 500 });
  }
}

// GET /api/v2/decisions?batchId=&date=
export async function GET(req: NextRequest) {
  try {
    const batchId = Number(req.nextUrl.searchParams.get("batchId"));
    if (!batchId) return NextResponse.json({ error: "batchId 必填" }, { status: 400 });
    const date = req.nextUrl.searchParams.get("date");
    const where: Record<string, unknown> = { batchId, deletedAt: null };
    if (date) {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59.999`);
      where.decisionTime = { gte: start, lte: end };
    }
    const list = await prisma.managerDecisionLog.findMany({ where, orderBy: { decisionTime: "desc" }, take: 100 });
    return NextResponse.json(toJSON(list));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}
