import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/batches/[id]  出栏（status → finished）或更新备注
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.action === "finish") {
      data.status = "finished";
    } else {
      if (body.status) data.status = String(body.status);
      if (body.note !== undefined) data.note = body.note ? String(body.note) : null;
    }
    const batch = await prisma.batch.update({ where: { id }, data });
    return NextResponse.json(batch);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "更新批次失败" }, { status: 500 });
  }
}

// DELETE /api/batches/[id]  永久删除批次及其全部关联记录（事务，先删子表再删批次）
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "批次 ID 无效" }, { status: 400 });
    }
    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) {
      return NextResponse.json({ error: "批次不存在" }, { status: 404 });
    }
    const summary = await prisma.$transaction(async (tx) => {
      // V2 表（FK onDelete: Restrict，必须先删子表）
      const environmentReadings = await tx.environmentReading.deleteMany({ where: { batchId: id } });
      const healthMedicationEvents = await tx.healthMedicationEvent.deleteMany({ where: { batchId: id } });
      const dailyRecords = await tx.dailyRecord.deleteMany({ where: { batchId: id } });
      const equipmentOperationLogs = await tx.equipmentOperationLog.deleteMany({ where: { batchId: id } });
      const managerDecisionLogs = await tx.managerDecisionLog.deleteMany({ where: { batchId: id } });
      const knowledgeConflictLogs = await tx.knowledgeConflictLog.deleteMany({ where: { batchId: id } });
      // V1 表（FK NoAction，同样先删子表）
      const envRecords = await tx.envRecord.deleteMany({ where: { batchId: id } });
      const feedRecords = await tx.feedRecord.deleteMany({ where: { batchId: id } });
      const mortalityRecords = await tx.mortalityRecord.deleteMany({ where: { batchId: id } });
      const weightRecords = await tx.weightRecord.deleteMany({ where: { batchId: id } });
      const healthRecords = await tx.healthRecord.deleteMany({ where: { batchId: id } });
      const alerts = await tx.alert.deleteMany({ where: { batchId: id } });
      // batch_meta（暂无 FK 约束，batchId 为 BigInt，有则清）
      const batchMeta = await tx.batchMeta.deleteMany({ where: { batchId: BigInt(id) } });
      // 最后删除批次本身
      await tx.batch.delete({ where: { id } });
      return {
        envRecords: envRecords.count,
        feedRecords: feedRecords.count,
        mortalityRecords: mortalityRecords.count,
        weightRecords: weightRecords.count,
        healthRecords: healthRecords.count,
        alerts: alerts.count,
        environmentReadings: environmentReadings.count,
        healthMedicationEvents: healthMedicationEvents.count,
        dailyRecords: dailyRecords.count,
        equipmentOperationLogs: equipmentOperationLogs.count,
        managerDecisionLogs: managerDecisionLogs.count,
        knowledgeConflictLogs: knowledgeConflictLogs.count,
        batchMeta: batchMeta.count,
      };
    });
    const deletedRecords = Object.values(summary).reduce((a, b) => a + b, 0);
    return NextResponse.json({ ok: true, name: batch.name, deletedRecords, detail: summary });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "删除批次失败" }, { status: 500 });
  }
}
