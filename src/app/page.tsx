import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { calcAgeDays, todayStart, addDays, formatDate, startOfDay } from "@/lib/dateUtils";
import { getTempStandard } from "@/lib/standards";
import { TempChart, MortalityChart, TempChartPoint, MortChartPoint } from "@/components/DashboardCharts";

export const dynamic = "force-dynamic";

const PERIODS = [
  { key: "morning", label: "早" },
  { key: "noon", label: "中" },
  { key: "evening", label: "晚" },
];

const LEVEL_STYLE: Record<string, { label: string; cls: string }> = {
  urgent: { label: "🔴 紧急", cls: "bg-red-100 text-red-700 border-red-300" },
  warning: { label: "🟡 预警", cls: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  info: { label: "🔵 提示", cls: "bg-blue-100 text-blue-700 border-blue-300" },
};

export default async function DashboardPage() {
  const today = todayStart();
  const tomorrow = addDays(today, 1);
  const sevenDaysAgo = addDays(today, -6);

  const activeBatches = await prisma.batch.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      houseNo: true,
      breed: true,
      startDate: true,
      initialCount: true,
      currentCount: true,
      status: true,
      createdAt: true,
    },
  });

  // 今日各时段录入完成状态（按批次）
  const todayEnv = await prisma.envRecord.findMany({
    where: { recordDate: { gte: today, lt: tomorrow } },
    select: { batchId: true, period: true },
  });
  const envDoneMap = new Map<number, Set<string>>();
  for (const r of todayEnv) {
    if (r.batchId == null || r.period == null) continue;
    if (!envDoneMap.has(r.batchId)) envDoneMap.set(r.batchId, new Set());
    envDoneMap.get(r.batchId)!.add(r.period);
  }

  // 近 7 天温度（以第一个在养批次为参照画标准区间）
  const refBatch = activeBatches[0];
  const tempChartData: TempChartPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    const dayStr = formatDate(day);
    let avgTemp: number | null = null;
    let alarmLow = 0;
    let alarmHigh = 0;
    if (refBatch) {
      const age = calcAgeDays(refBatch.startDate, day);
      const std = getTempStandard(age);
      alarmLow = std.alarmLow;
      alarmHigh = std.alarmHigh;
      const agg = await prisma.envRecord.aggregate({
        _avg: { temperature: true },
        where: {
          batchId: refBatch.id,
          recordDate: { gte: startOfDay(day), lt: addDays(startOfDay(day), 1) },
        },
      });
      avgTemp = agg._avg.temperature != null ? Math.round(agg._avg.temperature * 10) / 10 : null;
    }
    tempChartData.push({ date: dayStr, avgTemp, alarmLow, alarmHigh });
  }

  // 近 7 天死淘趋势（所有在养批次合计）
  const mortChartData: MortChartPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    const agg = await prisma.mortalityRecord.aggregate({
      _sum: { count: true },
      where: {
        recordDate: { gte: startOfDay(day), lt: addDays(startOfDay(day), 1) },
        batchId: { in: activeBatches.map((b) => b.id) },
      },
    });
    mortChartData.push({ date: formatDate(day), dead: agg._sum.count ?? 0 });
  }

  // 未处理告警
  const openAlerts = await prisma.alert.findMany({
    where: { status: "open" },
    select: {
      id: true,
      batchId: true,
      type: true,
      level: true,
      content: true,
      status: true,
      alertTime: true,
      resolvedAt: true,
      batch: { select: { name: true } },
    },
    orderBy: { alertTime: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-5">
      {/* 在养批次卡片 */}
      <section>
        <h2 className="mb-2 text-base font-bold text-gray-800">🐣 当前在养批次</h2>
        {activeBatches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            暂无在养批次，
            <Link href="/batches" className="text-green-700 underline">
              去新建批次
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeBatches.map((b) => {
              const age = calcAgeDays(b.startDate);
              const done = envDoneMap.get(b.id) ?? new Set<string>();
              const dead = b.initialCount - (b.currentCount ?? b.initialCount);
              return (
                <div key={b.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{b.name}</span>
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">在养</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded bg-gray-50 py-2">
                      <div className="text-lg font-bold text-green-700">{age}</div>
                      <div className="text-xs text-gray-500">日龄(天)</div>
                    </div>
                    <div className="rounded bg-gray-50 py-2">
                      <div className="text-lg font-bold text-gray-800">{b.currentCount ?? b.initialCount}</div>
                      <div className="text-xs text-gray-500">当前存栏</div>
                    </div>
                    <div className="rounded bg-gray-50 py-2">
                      <div className="text-lg font-bold text-orange-600">{dead}</div>
                      <div className="text-xs text-gray-500">累计死淘</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {b.houseNo ? `${b.houseNo} · ` : ""}
                    {b.breed ?? "品种未填"} · 进雏 {formatDate(b.startDate)}（{b.initialCount} 只）
                  </div>
                  {/* 今日录入完成状态 */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-gray-500">今日录入：</span>
                    {PERIODS.map((p) => {
                      const ok = done.has(p.key);
                      return (
                        <span
                          key={p.key}
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            ok ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {p.label} {ok ? "✓" : "○"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 温度曲线 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-gray-800">
          🌡️ 近 7 天温度曲线{refBatch ? `（参照批次：${refBatch.name}，标准区间按日龄变化）` : ""}
        </h2>
        {refBatch ? (
          <TempChart data={tempChartData} />
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">暂无在养批次</p>
        )}
      </section>

      {/* 死淘趋势 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-gray-800">📉 近 7 天死淘趋势</h2>
        <MortalityChart data={mortChartData} />
      </section>

      {/* 未处理告警 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">🔔 未处理告警（{openAlerts.length}）</h2>
          <Link href="/alerts" className="text-xs text-green-700 underline">
            全部告警 →
          </Link>
        </div>
        {openAlerts.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">暂无未处理告警，一切正常 👍</p>
        ) : (
          <ul className="space-y-2">
            {openAlerts.map((a) => {
              const lv = LEVEL_STYLE[a.level] ?? LEVEL_STYLE.info;
              return (
                <li key={a.id} className={`rounded-lg border px-3 py-2 text-sm ${lv.cls}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{lv.label}</span>
                    <span className="text-xs opacity-70">
                      {a.alertTime ? new Date(a.alertTime).toLocaleString("zh-CN", { hour12: false }) : ""}
                    </span>
                  </div>
                  <p className="mt-1">{a.content}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
