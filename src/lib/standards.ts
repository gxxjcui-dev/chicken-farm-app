// 肉鸡养殖标准数据
// v2.0 校准：以本场厂长实战标准为主（knowledge/厂长养殖经验_结构化.md），附教科书通用参考值对照
// 校准日期：2026-11-05
// 核心更新：温度标准按厂长实际执行值校准，新增热应激指数分级

// ============================================
// 温度标准（按日龄，°C）
// 本场执行值：厂长实战经验（v2.0）
// 告警线 = 目标值 ±2°C（预警）/ ±3°C（紧急）
// 教科书参考值仅用于日报对照展示，不参与告警判定
// ============================================
export interface TempStandard {
  minAge: number;
  maxAge: number; // 999 表示 36+
  target: number; // 本场目标温度（厂长标准）
  alarmLow: number; // 预警下限（-2°C）
  alarmHigh: number; // 预警上限（+2°C）
  urgentLow: number; // 紧急下限（-3°C）
  urgentHigh: number; // 紧急上限（+3°C）
  refLow: number; // 教科书参考下限
  refHigh: number; // 教科书参考上限
}

export const TEMP_STANDARDS: TempStandard[] = [
  { minAge: 1, maxAge: 7, target: 33, alarmLow: 31, alarmHigh: 35, urgentLow: 30, urgentHigh: 36, refLow: 33, refHigh: 35 },
  { minAge: 8, maxAge: 14, target: 30, alarmLow: 28, alarmHigh: 32, urgentLow: 27, urgentHigh: 33, refLow: 27, refHigh: 30 },
  { minAge: 15, maxAge: 21, target: 27, alarmLow: 25, alarmHigh: 29, urgentLow: 24, urgentHigh: 30, refLow: 24, refHigh: 27 },
  { minAge: 22, maxAge: 28, target: 25, alarmLow: 23, alarmHigh: 27, urgentLow: 22, urgentHigh: 28, refLow: 21, refHigh: 24 },
  { minAge: 29, maxAge: 35, target: 23, alarmLow: 21, alarmHigh: 25, urgentLow: 20, urgentHigh: 26, refLow: 18, refHigh: 22 },
  { minAge: 36, maxAge: 999, target: 23, alarmLow: 21, alarmHigh: 25, urgentLow: 20, urgentHigh: 26, refLow: 18, refHigh: 22 },
];

export function getTempStandard(ageDays: number): TempStandard {
  const s = TEMP_STANDARDS.find((t) => ageDays >= t.minAge && ageDays <= t.maxAge);
  return s ?? TEMP_STANDARDS[TEMP_STANDARDS.length - 1];
}

// ============================================
// 湿度标准
// 硬告警线（生理极限）：<40% 或 >75%
// 周龄目标湿度（厂长标准 v2.0）：偏离目标 ±10% 提示
// ============================================
export const HUMIDITY_ALARM_LOW = 40;
export const HUMIDITY_ALARM_HIGH = 75;

// 周龄目标湿度（%）：[起始日龄, 结束日龄, 目标湿度]
// v2.0 校准：根据厂长实战经验调整
export const WEEKLY_HUMIDITY_TARGETS: [number, number, number][] = [
  [1, 7, 67.5],   // 育雏期 65-70%
  [8, 14, 62.5],  // 60-65%
  [15, 21, 57.5], // 55-60%
  [22, 28, 52.5], // 50-55%
  [29, 35, 52.5], // 50-55%
  [36, 999, 52.5],// 50-55%
];

export const HUMIDITY_DEVIATION_INFO_PCT = 10; // 偏离目标 ±10% → info 提示

export function getHumidityTarget(ageDays: number): number {
  const t = WEEKLY_HUMIDITY_TARGETS.find(([lo, hi]) => ageDays >= lo && ageDays <= hi);
  return t ? t[2] : 55;
}

// ============================================
// 热应激指数（厂长实战经验公式，v2.0）
// 指数 = 温度×2 + 湿度 + 32
// 分级：<150 舒适 / 150-160 适宜 / 160-165 预警 / 165-170 紧急 / >170 危险
// ============================================
export const HEAT_STRESS_COMFORTABLE = 150; // <150 → 舒适
export const HEAT_STRESS_SUITABLE = 160;    // 150-160 → 适宜
export const HEAT_STRESS_WARNING = 165;     // ≥165 → warning（开始影响采食和生产性能）
export const HEAT_STRESS_URGENT = 170;      // ≥170 → urgent（开始死亡）

export function calcHeatStressIndex(temperatureC: number, humidityPct: number): number {
  return temperatureC * 2 + humidityPct + 32;
}

// 获取热应激状态
export function getHeatStressLevel(index: number): 'comfortable' | 'suitable' | 'warning' | 'urgent' | 'danger' {
  if (index < HEAT_STRESS_COMFORTABLE) return 'comfortable';
  if (index < HEAT_STRESS_SUITABLE) return 'suitable';
  if (index < HEAT_STRESS_WARNING) return 'warning';
  if (index < HEAT_STRESS_URGENT) return 'urgent';
  return 'danger';
}

// ============================================
// 死淘率阈值（%，厂长标准 v2.0）
// 预警 2‰（0.2%）；紧急 5‰（0.5%）
// 注：比通用教科书标准（0.5%/1%）更严格
// ============================================
export const MORTALITY_URGENT_PCT = 0.5; // > 0.5%（5‰）→ urgent
export const MORTALITY_WARNING_PCT = 0.2; // 0.2% ~ 0.5%（2‰~5‰）→ warning

// ============================================
// 采食量骤降阈值（%，厂长标准 v2.0）
// 下降 20% → warning（预警）
// 下降 30% → urgent（紧急）
// ============================================
export const FEED_DROP_WARNING_PCT = 20;
export const FEED_DROP_URGENT_PCT = 30;

// ============================================
// 标准体重参考（厂长实测标准，白羽肉鸡）
// [日龄, 标准体重 g]
// v2.0 校准：根据本场实际生产水平调整
// ============================================
export const WEIGHT_STANDARDS: [number, number][] = [
  [7, 190],    // 1周末 180-200g
  [14, 475],   // 2周末 450-500g
  [21, 900],   // 3周末 850-950g
  [28, 1475],  // 4周末 1400-1550g
  [35, 2100],  // 5周末 2000-2200g
  [42, 2600],  // 6周末 2500-2700g
  [44, 2800],  // 最佳出栏 2700-2900g
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
  // 超过 44 日龄：按最后一段斜率外推
  const [a0, w0] = pts[pts.length - 2];
  const [a1, w1] = pts[pts.length - 1];
  return w1 + ((w1 - w0) * (ageDays - a1)) / (a1 - a0);
}

// ============================================
// 厂长实战经验说明（v2.0）
// ============================================
/*
温度管理要点：
- 育雏期（1-7天）保温最关键，低于30°C会打堆
- 每3天降1°C，不能降太快
- 温度超标 2°C → 开 1-2 台风机
- 温度超标 3°C → 开 3-4 台风机
- 温度超标 4°C → 全部风机开启 + 水帘降温

死淘率处理流程：
- 2-5‰（预警）：增加巡检次数，观察鸡群状态
- >5‰（紧急）：立即隔离病死鸡，联系兽医确诊

热应激处理：
- 160-165（预警）：加强通风，准备降温
- 165-170（紧急）：立即降温，开启所有风机
- >170（危险）：紧急降温，水帘全开，密切监控

采食量异常：
- 下降 10%：注意观察
- 下降 20%：预警，检查原因
- 下降 30%：紧急，可能是疾病
*/
