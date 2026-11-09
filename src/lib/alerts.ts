// 告警判定逻辑（依据 docs/01_系统方案设计.md 第 3、4 节）
// 所有函数在对应记录保存后由服务端调用，判定结果写入 alerts 表
import { prisma } from "./prisma";
import {
  getTempStandard,
  HUMIDITY_ALARM_LOW,
  HUMIDITY_ALARM_HIGH,
  getHumidityTarget,
  HUMIDITY_DEVIATION_INFO_PCT,
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

async function createAlert(
  batchId: number,
  level: "urgent" | "warning" | "info",
  type: string,
  content: string
): Promise<CreatedAlert> {
  await prisma.alert.create({
    data: { batchId, level, type, content },
  });
  return { level, type, content };
}

// 环境记录告警判定：温度超告警线 → urgent；湿度 <40% 或 >75% → warning
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
    if (rec.temperature < std.alarmLow || rec.temperature > std.alarmHigh) {
      alerts.push(
        await createAlert(
          rec.batch.id,
          "urgent",
          "temperature",
          `【${rec.batch.name}】${dateStr} ${periodLabel}时段温度 ${rec.temperature}°C，超出 ${age} 日龄本场告警区间（${std.alarmLow}~${std.alarmHigh}°C，目标 ${std.target}°C；教科书参考 ${std.refLow}~${std.refHigh}°C）`
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
          `【${rec.batch.name}】${dateStr} ${periodLabel}时段湿度 ${rec.humidity}%，超出告警范围（${HUMIDITY_ALARM_LOW}~${HUMIDITY_ALARM_HIGH}%）`
        )
      );
    } else {
      // 周龄目标湿度偏离提示（厂长标准）
      const hTarget = getHumidityTarget(age);
      const hDev = rec.humidity - hTarget;
      if (Math.abs(hDev) > HUMIDITY_DEVIATION_INFO_PCT) {
        const dir = hDev > 0 ? "偏高" : "偏低";
        alerts.push(
          await createAlert(
            rec.batch.id,
            "info",
            "humidity",
            `【${rec.batch.name}】${dateStr} ${periodLabel}时段湿度 ${rec.humidity}%，较 ${age} 日龄本场目标湿度 ${hTarget}% ${dir} ${Math.abs(hDev).toFixed(0)}%`
          )
        );
      }
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

// 死淘记录告警判定：当日累计死淘 ÷ 当前存栏 > 1% → urgent；0.5%~1% → warning
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

  if (ratePct > MORTALITY_URGENT_PCT) {
    alerts.push(
      await createAlert(
        rec.batch.id,
        "urgent",
        "mortality",
        `【${rec.batch.name}】${dateStr} 当日累计死淘 ${dailyDead} 只，日死淘率 ${ratePct.toFixed(2)}%，超过 ${MORTALITY_URGENT_PCT}%（5‰）紧急线（本场正常值 0.5~1‰）`
      )
    );
  } else if (ratePct > MORTALITY_WARNING_PCT) {
    alerts.push(
      await createAlert(
        rec.batch.id,
        "warning",
        "mortality",
        `【${rec.batch.name}】${dateStr} 当日累计死淘 ${dailyDead} 只，日死淘率 ${ratePct.toFixed(2)}%，超过 ${MORTALITY_WARNING_PCT}%（2‰）预警线（本场正常值 0.5~1‰）`
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
