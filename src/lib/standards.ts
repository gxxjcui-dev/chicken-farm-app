// 肉鸡养殖标准数据
// v2.0 校准：以本场厂长实战标准为主（knowledge/厂长养殖经验.md），附教科书通用参考值对照
// 校准日期：2026-11-04

// ============================================
// 温度标准（按日龄，°C）
// 本场执行值：厂长周龄目标温度（体感温度管理体系）
// 告警线 = 目标值 ±2°C
// 教科书参考值仅用于日报对照展示，不参与告警判定
// ============================================
export interface TempStandard {
  minAge: number;
  maxAge: number; // 999 表示 36+
  target: number; // 本场目标温度（厂长标准）
  alarmLow: number; // 告警下限
  alarmHigh: number; // 告警上限
  refLow: number; // 教科书参考下限
  refHigh: number; // 教科书参考上限
}

export const TEMP_STANDARDS: TempStandard[] = [
  { minAge: 1, maxAge: 7, target: 29.5, alarmLow: 27.5, alarmHigh: 31.5, refLow: 33, refHigh: 35 },
  { minAge: 8, maxAge: 14, target: 28.3, alarmLow: 26.3, alarmHigh: 30.3, refLow: 27, refHigh: 30 },
  { minAge: 15, maxAge: 21, target: 27.5, alarmLow: 25.5, alarmHigh: 29.5, refLow: 24, refHigh: 27 },
  { minAge: 22, maxAge: 28, target: 25.4, alarmLow: 23.4, alarmHigh: 27.4, refLow: 21, refHigh: 24 },
  { minAge: 29, maxAge: 35, target: 22.5, alarmLow: 20.5, alarmHigh: 24.5, refLow: 18, refHigh: 22 },
  { minAge: 36, maxAge: 999, target: 19, alarmLow: 17, alarmHigh: 21, refLow: 18, refHigh: 22 },
];

export function getTempStandard(ageDays: number): TempStandard {
  const s = TEMP_STANDARDS.find((t) => ageDays >= t.minAge && ageDays <= t.maxAge);
  return s ?? TEMP_STANDARDS[TEMP_STANDARDS.length - 1];
}

// ============================================
// 湿度标准
// 硬告警线（生理极限）：<40% 或 >75%
// 周龄目标湿度（厂长标准）：偏离目标 ±10% 提示
// ============================================
export const HUMIDITY_ALARM_LOW = 40;
export const HUMIDITY_ALARM_HIGH = 75;

// 周龄目标湿度（%）：[起始日龄, 结束日龄, 目标湿度]
export const WEEKLY_HUMIDITY_TARGETS: [number, number, number][] = [
  [1, 7, 65],
  [8, 14, 65],
  [15, 21, 60],
  [22, 28, 55],
  [29, 35, 50],
  [36, 999, 50],
];

export const HUMIDITY_DEVIATION_INFO_PCT = 10; // 偏离目标 ±10% → info 提示

export function getHumidityTarget(ageDays: number): number {
  const t = WEEKLY_HUMIDITY_TARGETS.find(([lo, hi]) => ageDays >= lo && ageDays <= hi);
  return t ? t[2] : 55;
}

// ============================================
// 热应激指数（厂长标准，新增）
// 指数 = 温度×2 + 湿度 + 32
// 150 正常 / 155 底线 / 160 减采食 / 165 开始死亡 / 170 大量死亡
// ============================================
export const HEAT_STRESS_WARNING = 160; // ≥160 → warning（开始影响采食和生产性能）
export const HEAT_STRESS_URGENT = 165; // ≥165 → urgent（开始死亡）

export function calcHeatStressIndex(temperatureC: number, humidityPct: number): number {
  return temperatureC * 2 + humidityPct + 32;
}

// ============================================
// 死淘率阈值（%，厂长标准：正常日死淘 0.5~1‰）
// 预警 2‰（0.2%）；紧急 5‰（0.5%）
// 注：比通用教科书标准（0.5%/1%）更严格
// ============================================
export const MORTALITY_URGENT_PCT = 0.5; // > 0.5%（5‰）→ urgent
export const MORTALITY_WARNING_PCT = 0.2; // 0.2% ~ 0.5%（2‰~5‰）→ warning

// ============================================
// 采食量骤降阈值（%）
// ============================================
export const FEED_DROP_WARNING_PCT = 20;

// ============================================
// 标准体重参考（厂长实测标准，白羽肉鸡）
// [日龄, 标准体重 g]
// 本场标准高于教科书参考（6周 3150g vs 教科书 2900-3100g）
// ============================================
export const WEIGHT_STANDARDS: [number, number][] = [
  [7, 220],
  [14, 550],
  [21, 1050],
  [28, 1700],
  [35, 2400],
  [42, 3150],
];

// 体重偏离阈值（%）
export const WEIGHT_DEVIATION_INFO_PCT = 10;

// 按日龄线性插值得到标准体重（g）
export function getStandardWeight(ageDays: number): number | null {
  if (ageDays < WEIGHT_STANDARDS[0][0]) return null;
  const pts = WEIGHT_STANDARDS;
  for (let i = 0; i < pts.length; i++) {
    if (ageDays === pts[i][0]) return pts[i][1];
    if (ageDays < pts[i][0]) {
      const [a0, w0] = i === 0 ? [1, 40] : pts[i - 1]; // 1日龄雏鸡约40g
      const [a1, w1] = pts[i];
      return w0 + ((w1 - w0) * (ageDays - a0)) / (a1 - a0);
    }
  }
  // 超过 42 日龄：按最后一段斜率外推
  const [a0, w0] = pts[pts.length - 2];
  const [a1, w1] = pts[pts.length - 1];
  return w1 + ((w1 - w0) * (ageDays - a1)) / (a1 - a0);
}
