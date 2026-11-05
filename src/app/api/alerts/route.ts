import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/alerts?level=urgent&status=open
export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get("level");
  const status = req.nextUrl.searchParams.get("status");
  const alerts = await prisma.alert.findMany({
    where: {
      ...(level ? { level } : {}),
      ...(status ? { status } : {}),
    },
    include: { batch: { select: { name: true, houseNo: true } } },
    orderBy: { alertTime: "desc" },
  });
  return NextResponse.json(alerts);
}
