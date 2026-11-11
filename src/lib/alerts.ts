// 告警判定逻辑（依据厂长实战标准 v3.0，2026-11-11 答题卡校准）
// 所有函数在对应记录保存后由服务端调用，判定结果写入 alerts 表
import { prisma } from "./prisma";
import {
  getTempStandard,
  getTempLimits,
  HUMIDITY_ALARM_LOW,
  HUMIDITY_ALARM_HIGH,
  calcHeatStressIndex,
  HEAT_STRESS_WARNING,
  HEAT_STRESS_URGENT,
  MORTALITY_URGENT_PCT,
  MORTALITY_WARNING_PCT,
  FEED_DROP_WARNING_PCT,
  getStandardWeight,
  WEIGHT_DEVIATION_INFO_PCT,
} from "./standards";
import { calcAgeDays, startOfDay, addDays, formatDate } from "./dateUtils";

export interface CreatedAlert {
  level: string;
  type: string;
  content: string;
}

const PERIOD_LABEL: Record<string, string> = {
  morning: "早",
  noon: "中",
  evening: "晚",
};

// 紧急告警即时推送到厂长微信（Server酱 Turbo）。
// SendKey 只放环境变量 SERVERCHAN_SENDKEY（Vercel 项目环境变量 / 本地 .env），不写入仓库。
async function pushUrgentToWechat(content: string): Promise<void> {
  const sendkey = process.env.SERVERCHAN_SENDKEY;
  if (!sendkey) return;
  try {
    const res = await fetch(`https://sctapi.ftqq.com/${sendkey}.send`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        title: "🚨 鸡棚紧急告警",
        desp: `${content}\n\n请立即到棚查看处理。`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[serverchan] push failed, status:", res.status);
    }
  } catch (err) {
    // 推送失败不影响录入主流程
    console.error("[serverchan] push error:", err);
  }
}

async function createAlert(
  batchId: number,
  level: "urgent" | "warning" | "info",
  type: string,
  content: string
): Promise<CreatedAlert> {
  await prisma.alert.create({
    data: { batchId, level, type, content },
  });
  if (level === "urgent") {
    await pushUrgentToWechat(content);
  }
  return { level, type, content };
}

// 环境记录告警判定（v3.0）：
// 温度：低于目标即 warning，低于目标2°C urgent；高温按季节动态上限（getTempLimits）
// 湿度：硬线 <40% 或 >70% → warning（偏离目标提示已按厂长口径取消）
export async function checkEnvRecord(envRecordId: number): Promise<CreatedAlert[]> {
  const rec = await prisma.envRecord.findUnique({
    where: { id: envRecordId },
    include: { batch: true },
  });
  if (!rec || !rec.batch) return [];
  const alerts: CreatedAlert[] = [];
  const age = calcAgeDays(rec.batch.startDate, rec.recordDate);
  const periodLabel = (rec.period ? PERIOD_LABEL[rec.period] : undefined) ?? rec.period ?? "未知";
  const dateStr = formatDate(rec.recordDate);

  if (rec.temperature != null) {
    const std = getTempStandard(age);
    const month = rec.recordDate.getMonth() + 1;
    // 湿度联动：同记录有湿度时参与高温上限计算（湿度低10% → 上限+1°C）
    const limits = getTempLimits(age, month, rec.humidity ?? undefined);
    if (rec.temperature >= limits.urgentHigh) {
      alerts.push(
        await createAlert(
          rec.batch.id,
          "urgent",
          "temperature",
          `【${rec.batch.name}】${dateStr} ${periodLabel}时段温度 ${rec.temperature}°C，超过 ${age} 日龄季节上限 ${limits.urgentHigh}°C（目标 ${std.target}°C，厂长标准：必须立即处理）`
        )
      );
    } else if (rec.temperature <= limits.urgentLow) {
      alerts.push(
        await createAlert(
          rec.batch.id,
          "urgent",
          "temperature",
          `【${rec.batch.name}】${dateStr} ${periodLabel}时段温度 ${rec.temperature}°C，低于目标 ${std.target}°C 超过 2°C，有打堆风险，立即检查加温`
        )
      );
    } else if (rec.temperature > limits.warnHigh) {
      alerts.push(
        await createAlert(
          rec.batch.id,
          "warning",
          "temperature",
          `【${rec.batch.name}】${dateStr} ${periodLabel}时段温度 ${rec.temperature}°C，接近季节上限 ${limits.urgentHigh}°C（目标 ${std.target}°C），注意通风`
        )
      );
    } else if (rec.temperature < limits.warnLow) {
      alerts.push(
        await createAlert(
          rec.batch.id,
          "warning",
          "temperature",
          `【${rec.batch.name}】${dateStr} ${periodLabel}时段温度 ${rec.temperature}°C，低于目标 ${std.target}°C（厂长标准：低于目标即报警）`
        )
      );
    }
  }

  if (rec.humidity != null) {
    if (rec.humidity < HUMIDITY_ALARM_LOW || rec.humidity > HUMIDITY_ALARM_HIGH) {
      alerts.push(
        await createAlert(
          rec.batch.id,
          "warning",
          "humidity",
          `【${rec.batch.name}】${dateStr} ${periodLabel}时段湿度 ${rec.humidity}%，超出本场范围（${HUMIDITY_ALARM_LOW}~${HUMIDITY_ALARM_HIGH}%）`
        )
      );
    }
  }

  // 热应激指数判定（厂长标准：温度×2+湿度+32；160预警 / 165紧急）
  if (rec.temperature != null && rec.humidity != null) {
    const hsi = calcHeatStressIndex(rec.temperature, rec.humidity);
    if (hsi >= HEAT_STRESS_URGENT) {
      alerts.push(
        await createAlert(
          rec.batch.id,
          "urgent",
          "heat_stress",
          `【${rec.batch.name}】${dateStr} ${periodLabel}时段热应激指数 ${hsi.toFixed(0)}（温度${rec.temperature}°C+湿度${rec.humidity}%），≥${HEAT_STRESS_URGENT} 紧急线，可能导致死亡，立即加强通风降温`
        )
      );
    } else if (hsi >= HEAT_STRESS_WARNING) {
      alerts.push(
        await createAlert(
          rec.batch.id,
          "warning",
          "heat_stress",
          `【${rec.batch.name}】${dateStr} ${periodLabel}时段热应激指数 ${hsi.toFixed(0)}（温度${rec.temperature}°C+湿度${rec.humidity}%），≥${HEAT_STRESS_WARNING} 预警线，鸡群开始减采食、生产性能下降`
        )
      );
    }
  }
  return alerts;
}

// 死淘记录告警判定（v3.0，厂长答题卡第6/7题）：
// 当日累计死淘 ÷ 存栏 > 1.5‰ → urgent；1‰~1.5‰ → warning
export async function checkMortalityRecord(mortalityRecordId: number): Promise<CreatedAlert[]> {
  const rec = await prisma.mortalityRecord.findUnique({
    where: { id: mortalityRecordId },
    include: { batch: true },
  });
  if (!rec || !rec.batch) return [];
  const alerts: CreatedAlert[] = [];
  const dateStr = formatDate(rec.recordDate);

  // 当日累计死淘（含本条）
  const dayStart = startOfDay(rec.recordDate);
  const agg = await prisma.mortalityRecord.aggregate({
    _sum: { count: true },
    where: {
      batchId: rec.batch.id,
      recordDate: { gte: dayStart, lt: addDays(dayStart, 1) },
    },
  });
  const dailyDead = agg._sum.count ?? 0;
  // 分母使用扣减前的存栏（扣减后 + 本次数量）
  const baseCount = (rec.batch.currentCount ?? rec.batch.initialCount) + rec.count;
  const ratePct = baseCount > 0 ? (dailyDead / baseCount) * 100 : 0;
  const ratePm = ratePct * 10; // 千分比

  if (ratePct > MORTALITY_URGENT_PCT) {
    alerts.push(
      await createAlert(
        rec.batch.id,
        "urgent",
        "mortality",
        `【${rec.batch.name}】${dateStr} 当日累计死淘 ${dailyDead} 只，日死淘率 ${ratePm.toFixed(2)}‰，超过 ${(MORTALITY_URGENT_PCT * 10).toFixed(1)}‰ 紧急线（本场正常值 0.5~1‰），立即排查并考虑联系兽医`
      )
    );
  } else if (ratePct > MORTALITY_WARNING_PCT) {
    alerts.push(
      await createAlert(
        rec.batch.id,
        "warning",
        "mortality",
        `【${rec.batch.name}】${dateStr} 当日累计死淘 ${dailyDead} 只，日死淘率 ${ratePm.toFixed(2)}‰，超过 ${(MORTALITY_WARNING_PCT * 10).toFixed(1)}‰ 预警线（本场正常值 0.5~1‰）`
      )
    );
  }
  return alerts;
}

// 饲喂记录告警判定：采食量较前一日骤降 > 20% → warning
export async function checkFeedRecord(feedRecordId: number): Promise<CreatedAlert[]> {
  const rec = await prisma.feedRecord.findUnique({
    where: { id: feedRecordId },
    include: { batch: true },
  });
  if (!rec || !rec.batch || rec.feedKg == null) return [];
  const alerts: CreatedAlert[] = [];
  const dayStart = startOfDay(rec.recordDate);
  const prevStart = addDays(dayStart, -1);
  const dateStr = formatDate(rec.recordDate);

  // 前一日采食量（取前一日全部记录之和）
  const prevAgg = await prisma.feedRecord.aggregate({
    _sum: { feedKg: true },
    where: {
      batchId: rec.batch.id,
      recordDate: { gte: prevStart, lt: dayStart },
    },
  });
  const prevFeed = prevAgg._sum.feedKg;
  if (prevFeed != null && prevFeed > 0) {
    // 当日累计采食
    const curAgg = await prisma.feedRecord.aggregate({
      _sum: { feedKg: true },
      where: {
        batchId: rec.batch.id,
        recordDate: { gte: dayStart, lt: addDays(dayStart, 1) },
      },
    });
    const curFeed = curAgg._sum.feedKg ?? rec.feedKg;
    const dropPct = ((prevFeed - curFeed) / prevFeed) * 100;
    if (dropPct > FEED_DROP_WARNING_PCT) {
      alerts.push(
        await createAlert(
          rec.batch.id,
          "warning",
          "feed",
          `【${rec.batch.name}】${dateStr} 采食量 ${curFeed}kg，较前一日 ${prevFeed}kg 骤降 ${dropPct.toFixed(1)}%，超过 20% 预警线`
        )
      );
    }
  }
  return alerts;
}

// 体重抽检告警判定：偏离标准体重 > 10% → info
export async function checkWeightRecord(weightRecordId: number): Promise<CreatedAlert[]> {
  const rec = await prisma.weightRecord.findUnique({
    where: { id: weightRecordId },
    include: { batch: true },
  });
  if (!rec || !rec.batch || rec.avgWeightG == null) return [];
  const alerts: CreatedAlert[] = [];
  const age = calcAgeDays(rec.batch.startDate, rec.recordDate);
  const std = getStandardWeight(age);
  const dateStr = formatDate(rec.recordDate);
  if (std != null && std > 0) {
    const devPct = ((rec.avgWeightG - std) / std) * 100;
    if (Math.abs(devPct) > WEIGHT_DEVIATION_INFO_PCT) {
      const dir = devPct > 0 ? "高于" : "低于";
      alerts.push(
        await createAlert(
          rec.batch.id,
          "info",
          "weight",
          `【${rec.batch.name}】${dateStr} ${age} 日龄平均体重 ${rec.avgWeightG}g，${dir}标准（约 ${Math.round(std)}g）${Math.abs(devPct).toFixed(1)}%`
        )
      );
    }
  }
  return alerts;
}
