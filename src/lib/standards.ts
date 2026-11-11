// 肉鸡养殖标准数据
// v3.0 校准：以本场厂长实战标准为准（2026-11-11 厂长答题卡 40 题逐项确认）
// 校准记录：docs/厂长答题结果_参数对照_2026-11-11.md
// v3.0 核心变化：
//   1. 温度高温上限按季节浮动（冬+3/夏+6/春+5.5/秋早晚分档）+ 湿度联动（湿度低10%→上限+1°C）
//   2. 低温：低于目标即预警（厂长："目标既报警"）
//   3. 死淘率收紧：1‰预警 / 1.5‰紧急
//   4. 湿度硬线 40-70%，取消偏离目标提示
//   5. 热应激按厂长口径修正：160预警 / 165紧急
//   6. 新增采食量标准（控料模式）

// ============================================
// 温度标准（按日龄，°C）
// 本场执行值：厂长实战经验（v3.0）
// 告警线不再固定 ±2/±3，改为 getTempLimits() 按季节+湿度动态计算
// 教科书参考值仅用于日报对照展示，不参与告警判定
// ============================================
export interface TempStandard {
  minAge: number;
  maxAge: number; // 999 表示 36+
  target: number; // 本场目标温度（厂长标准）
  refLow: number; // 教科书参考下限
  refHigh: number; // 教科书参考上限
}

export const TEMP_STANDARDS: TempStandard[] = [
  { minAge: 1, maxAge: 7, target: 33.5, refLow: 33, refHigh: 35 },   // 33-34浮动，雏大温度低（第10题）
  { minAge: 8, maxAge: 14, target: 30, refLow: 27, refHigh: 30 },
  { minAge: 15, maxAge: 21, target: 27, refLow: 24, refHigh: 27 },
  { minAge: 22, maxAge: 28, target: 25, refLow: 21, refHigh: 24 },
  { minAge: 29, maxAge: 35, target: 23, refLow: 18, refHigh: 22 },   // 厂长四季确认 23°C
  { minAge: 36, maxAge: 999, target: 23, refLow: 18, refHigh: 22 },
];

export function getTempStandard(ageDays: number): TempStandard {
  const s = TEMP_STANDARDS.find((t) => ageDays >= t.minAge && ageDays <= t.maxAge);
  return s ?? TEMP_STANDARDS[TEMP_STANDARDS.length - 1];
}

// ============================================
// 季节温度上限（v3.0，厂长答题卡第 1/12/13/16/18 题）
// 高温紧急线 = 目标 + 季节系数（厂长的"必须马上处理"线）
//   冬（12-2月）+3 / 夏（6-8月）+6 / 春（3-5月）+5.5（看鸡群大小5-6）
//   秋（9-11月）：9-10月早秋按夏+6，11月晚秋按冬+3
// 高温预警线 = 紧急线 - 1°C（提前量）
// 湿度联动（第3题，全年通用）：湿度低于当前日龄目标10% → 高温线+1°C
// 低温（第2题"目标既报警"）：低于目标即预警；低于目标2°C紧急（安全底线保留）
// ============================================
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export function getSeasonHighBonus(month: number): number {
  const season = getSeason(month);
  if (season === 'summer') return 6;
  if (season === 'winter') return 3;
  if (season === 'spring') return 5.5;
  return month === 11 ? 3 : 6; // 秋季：晚秋(11月)按冬，早秋(9-10月)按夏
}

export interface TempLimits {
  warnLow: number;
  warnHigh: number;
  urgentLow: number;
  urgentHigh: number;
}

export function getTempLimits(ageDays: number, month: number, humidityPct?: number): TempLimits {
  const std = getTempStandard(ageDays);
  const bonus = getSeasonHighBonus(month);
  const humidityBonus =
    humidityPct !== undefined && humidityPct <= getHumidityTarget(ageDays) - 10 ? 1 : 0;
  const urgentHigh = std.target + bonus + humidityBonus;
  return {
    warnLow: std.target,       // 低于目标即预警
    warnHigh: urgentHigh - 1,  // 紧急线前 1°C 预警
    urgentLow: std.target - 2, // 低于目标 2°C 紧急（安全底线）
    urgentHigh,
  };
}

// ============================================
// 湿度标准（v3.0，第 4/5 题）
// 硬告警线：40-70%（厂长："40-70之间跟着温度浮动没事"）
// 分日龄目标：育雏60-70 / 中期55-65 / 后期50-60（用于湿度联动判定，不发偏离告警）
// ============================================
export const HUMIDITY_ALARM_LOW = 40;
export const HUMIDITY_ALARM_HIGH = 70;

// 分日龄目标湿度（%）：[起始日龄, 结束日龄, 目标湿度]
export const WEEKLY_HUMIDITY_TARGETS: [number, number, number][] = [
  [1, 7, 65],    // 育雏期 60-70%
  [8, 21, 60],   // 中期 55-65%
  [22, 999, 55], // 后期 50-60%
];

export function getHumidityTarget(ageDays: number): number {
  const t = WEEKLY_HUMIDITY_TARGETS.find(([lo, hi]) => ageDays >= lo && ageDays <= hi);
  return t ? t[2] : 55;
}

// ============================================
// 热应激指数（厂长实战经验公式，v3.0 按厂长口径修正）
// 指数 = 温度×2 + 湿度 + 32
// 分级（第9题确认）：<150 舒适 / 150-160 适宜 / 160-165 预警 / 165-170 紧急 / ≥170 危险
// ============================================
export const HEAT_STRESS_COMFORTABLE = 150; // <150 → 舒适
export const HEAT_STRESS_SUITABLE = 160;    // 150-160 → 适宜
export const HEAT_STRESS_WARNING = 160;     // ≥160 → warning（开始影响采食和生产性能）
export const HEAT_STRESS_URGENT = 165;      // ≥165 → urgent（开始死亡）
export const HEAT_STRESS_DANGER = 170;      // ≥170 → danger

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
// 死淘率阈值（%，厂长标准 v3.0，第 6/7 题）
// 预警 1‰（0.1%）；紧急 1.5‰（0.15%）
// 厂长口径：超出 1‰ 就报警（不再单独做"超前3日均值50%"波动判定）
// ============================================
export const MORTALITY_URGENT_PCT = 0.15; // > 0.15%（1.5‰）→ urgent
export const MORTALITY_WARNING_PCT = 0.1; // 0.1% ~ 0.15%（1‰~1.5‰）→ warning

// ============================================
// 采食量标准（v3.0 新增，第 28 题）
// 标准料量 = 日龄×5 g/只/天（10天1两、30天3两）
// 控料量 = 标准-15g（10天0.7两、30天2.7两），为控制料比
// 封顶 170g（3.4两）；鸡状态特别好可到 175g；状态一般 160-170g 浮动
// ============================================
export function getFeedTarget(ageDays: number): number {
  return Math.min(ageDays * 5 - 15, 170);
}
export const FEED_CAP_NORMAL = 170;   // 封顶 3.4两
export const FEED_CAP_GOOD = 175;     // 状态特别好 3.5两

// 采食量骤降阈值（%，厂长标准，保持不变）
// 下降 20% → warning（预警）
// 下降 30% → urgent（紧急）
export const FEED_DROP_WARNING_PCT = 20;
export const FEED_DROP_URGENT_PCT = 30;

// ============================================
// 标准体重参考（厂长实测标准，白羽肉鸡）
// [日龄, 标准体重 g]
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
// 厂长实战经验说明（v3.0，2026-11-11 答题卡确认）
// ============================================
/*
温度管理：
- 育雏期（1-7天）33-34°C浮动，雏大温度低、雏小温度高
- 29日龄后目标 23°C，四季不变；高温上限按季节浮动（冬+3/夏+6/春+5.5/秋早晚分档）
- 湿度每低10%，温度上限可+1°C（全年通用）
- 低于目标温度即预警

风机节奏（第19题，季节化）：
- 夏季：超目标 0.5°C 即开一台（靠风速降温）
- 冬季：超目标 1.5°C 开一台
- 春秋：两者之间浮动

最小通风（第21题，季节化）：
- 夏季：落风在笼内形成风速
- 冬季：冷风混合棚内暖空气，周期循环带走笼内多余热量

水帘（第22/23题）：
- 启用温差 3-6°C 浮动，初次启动温差最高，随日龄和鸡群大小逐步降低
- 外界湿度 >80% 禁用水帘

负压（第24题）：16-20 Pa

分笼与净槽（第27/37题）：
- 首次分笼 7-9 日龄（看鸡大小：鸡小8-9天、鸡大7天）一分二；18日龄二分三
- 净槽 = 首次分笼次日开始（判断标志：鸡钻不出栏架）

换料（第25/26题）：
- 前→中期：12日龄开始混合，3-4天过渡
- 中→后期：26日龄左右，3-4天过渡

免疫（第34题）：
- 8日龄左右做一次油苗（或季节性鸡痘）
- 21日龄：鸡完全健康才做，有任何问题则不做
- 现行流程几乎只做第一周疫苗

呼吸道处置（第35题）：
- 先观察2天：排查通风问题 / 疫苗反应 / 雏源自带
- 确诊早期症状也让大群发展起来再用药
- 夏季前后可通过通风调整

死淘分类（第31题）：疾病/弱雏/外伤/啄癖/猝死/热应激/其他（7类）

叫兽医红线（第32题）：死淘超线 / 群体精神差 / 用药2天无效，任一满足即联系

出栏（第30/40题）：
- 一般44日龄；毛鸡越贵越养大鸡（多喂），行情差则严格控料比
- 进雏规模 26400 上下浮动：天热少上，天冷多上

冬季进雏预热（第39题）：提前 12 小时

采食量异常：
- 下降 10%：注意观察
- 下降 20%：预警，检查原因
- 下降 30%：紧急，可能是疾病
*/
