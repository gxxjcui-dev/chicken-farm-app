import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// BigInt → Number（V2 表主键为 BigInt，JSON 序列化前必须转换）
const toJSON = <T,>(data: T): T => JSON.parse(JSON.stringify(data, (_, v) => (typeof v === "bigint" ? Number(v) : v)));

// POST /api/v2/environment-readings  多测点环境读数录入
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, readTime, probeId, cageColumn, cageLayer, positionDesc, temp, humidity, dataSource } = body;
    if (!batchId || !probeId || !positionDesc) {
      return NextResponse.json({ error: "批次、探头编号和测点位置为必填项" }, { status: 400 });
    }
    if (cageLayer && !["上", "中", "下"].includes(cageLayer)) {
      return NextResponse.json({ error: "笼层必须为 上/中/下" }, { status: 400 });
    }
    const rec = await prisma.environmentReading.create({
      data: {
        batchId: Number(batchId),
        readTime: readTime ? new Date(readTime) : new Date(),
        probeId: String(probeId),
        cageColumn: cageColumn ? String(cageColumn) : null,
        cageLayer: cageLayer ? String(cageLayer) : null,
        positionDesc: String(positionDesc),
        temp: temp !== undefined && temp !== "" ? Number(temp) : null,
        humidity: humidity !== undefined && humidity !== "" ? Number(humidity) : null,
        dataSource: dataSource ? String(dataSource) : "manual",
      },
    });
    return NextResponse.json({ record: toJSON(rec) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存环境读数失败" }, { status: 500 });
  }
}

// GET /api/v2/environment-readings?batchId=&date=  按批次查询（date 可选 YYYY-MM-DD）
export async function GET(req: NextRequest) {
  try {
    const batchId = Number(req.nextUrl.searchParams.get("batchId"));
    if (!batchId) return NextResponse.json({ error: "batchId 必填" }, { status: 400 });
    const date = req.nextUrl.searchParams.get("date");
    const where: Record<string, unknown> = { batchId, deletedAt: null };
    if (date) {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59.999`);
      where.readTime = { gte: start, lte: end };
    }
    const list = await prisma.environmentReading.findMany({ where, orderBy: { readTime: "desc" }, take: 100 });
    return NextResponse.json(toJSON(list));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}
