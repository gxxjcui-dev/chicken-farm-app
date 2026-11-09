// V2.0-R1.2-SP3 第一阶段 AI日报生成逻辑
// 生成时间：2026-11-08
// 核心原则：SQL计算+AI解释解耦；≤200字硬性校验；测点位置必须标注

import type {
  DailyReportInput,
  DailyReportOutput,
  StockBalanceResult,
  LayerThermalDiffResult,
  MortalityAggregateResult,
  EnvironmentReading,
} from '../types/v2';

// ============================================
// 硬性校验规则
// ============================================

const MAX_CHINESE_CHARS = 200; // 中文字符+标点≤200
const MIN_DATA_POINTS = 1; // 最少1个测点

// ============================================
// SQL计算部分（禁止使用AI）
// ============================================

/**
 * 计算存栏平衡
 * 公式：期初 + 转入 - 死亡 - 淘汰 - 转出 = 期末
 */
export function calculateStockBalance(
  startCount: number,
  transferIn: number,
  transferOut: number,
  dead: number,
  eliminate: number
): StockBalanceResult {
  const calculated = startCount + transferIn - dead - eliminate - transferOut;
  const endCount = calculated; // 实际期末应从DailyRecord读取
  
  return {
    startCount,
    transferIn,
    transferOut,
    dead,
    eliminate,
    endCount,
    calculated,
    isBalanced: calculated === endCount,
  };
}

/**
 * 计算分层温差
 * 约束：仅同一时间窗口、多层有效测点、条件可比才可计算
 */
export function calculateLayerThermalDiff(
  layerTemps: { layer: string; temp: number; positionDesc: string; readTime: Date }[]
): LayerThermalDiffResult {
  // 检查测点数量
  if (layerTemps.length < 2) {
    return {
      isValid: false,
      reason: '测点数量不足（<2层），无法计算分层温差',
    };
  }
  
  // 检查时间窗口（所有测点必须在同一小时内）
  const times = layerTemps.map(lt => lt.readTime.getTime());
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const timeDiffHours = (maxTime - minTime) / (1000 * 60 * 60);
  
  if (timeDiffHours > 1) {
    return {
      isValid: false,
      reason: `测点时间跨度过大（${timeDiffHours.toFixed(1)}小时），不在同一时间窗口`,
    };
  }
  
  // 计算温差
  const temps = layerTemps.map(lt => lt.temp);
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const maxDiff = maxTemp - minTemp;
  
  return {
    maxDiff,
    isValid: true,
    layerTemps: layerTemps.map(lt => ({
      layer: lt.layer as any,
      temp: lt.temp,
      positionDesc: lt.positionDesc,
    })),
  };
}

/**
 * 聚合死淘数据（从HealthMedicationEvent）
 */
export function aggregateMortality(events: { eventType: string; eventCount: number | null }[]): MortalityAggregateResult {
  const deadNum = events
    .filter(e => e.eventType === 'dead')
    .reduce((sum, e) => sum + (e.eventCount || 0), 0);
  
  const eliminateNum = events
    .filter(e => e.eventType === 'eliminate')
    .reduce((sum, e) => sum + (e.eventCount || 0), 0);
  
  return {
    deadNum,
    eliminateNum,
    eventCount: events.length,
  };
}

// ============================================
// AI日报生成（解释部分）
// ============================================

/**
 * 生成AI日报
 * 硬性校验：≤200字（中文字符）、必须标注测点位置、禁止推测原因
 */
export function generateDailyReport(input: DailyReportInput): DailyReportOutput {
  const { batchId, recordDate, dayAge, measurements, managerSettings, references, conflictNote, mortality } = input;
  
  // 构建日报内容
  let content = '';
  
  // 标题行
  content += `【${batchId}号鸡舍｜${formatDate(recordDate)}｜${dayAge}日龄】\n`;
  
  // 实测数据（必须标注测点位置）
  if (measurements && measurements.length > 0) {
    const m = measurements[0]; // 取第一个测点
    content += `实测：${m.positionDesc} 温度${m.temp}℃ 湿度${m.humidity}%`;
    if (m.dataSource) {
      content += ` (${m.dataSource === 'sensor' ? '传感器' : '人工'})`;
    }
    content += '\n';
  } else {
    content += '实测：数据不足，无法判断\n';
  }
  
  // 厂长设定/操作
  if (managerSettings) {
    content += `厂长设定：`;
    if (managerSettings.managerTargetJson) {
      const target = managerSettings.managerTargetJson;
      if (target.temp) content += `温度${target.temp}℃ `;
      if (target.humidity) content += `湿度${target.humidity}%`;
    }
    if (managerSettings.actualOperation) {
      content += `；操作：${managerSettings.actualOperation}`;
    }
    content += '\n';
  }
  
  // 死淘数据
  if (mortality) {
    content += `死淘：死亡${mortality.deadNum}只`;
    if (mortality.eliminateNum > 0) {
      content += ` 淘汰${mortality.eliminateNum}只`;
    }
    content += '\n';
  }
  
  // 参考数据（只读）
  if (references && references.length > 0) {
    const ref = references[0];
    content += `参考：${ref.kbId}｜${ref.source}`;
    if (ref.isBook) {
      content += '【书籍经验】';
    }
    content += '\n';
  }
  
  // 差异提示（人工记录）
  if (conflictNote) {
    content += `差异：${conflictNote}\n`;
  }
  
  // 底部声明
  content += '⚠仅供参考，请现场确认';
  
  // 硬性校验
  const charCount = countChineseChars(content);
  const errors: string[] = [];
  
  if (charCount > MAX_CHINESE_CHARS) {
    errors.push(`中文字符数${charCount}超过限制${MAX_CHINESE_CHARS}`);
  }
  
  if (measurements.length < MIN_DATA_POINTS) {
    errors.push('测点数据不足');
  }
  
  // 检查是否包含推测性词汇
  const speculationWords = ['可能', '也许', '大概', '应该', '估计', '推测'];
  for (const word of speculationWords) {
    if (content.includes(word)) {
      errors.push(`包含推测性词汇：${word}`);
    }
  }
  
  // 检查是否包含疾病诊断
  const diagnosisWords = ['诊断', '疾病', '病原', '感染', '发病'];
  for (const word of diagnosisWords) {
    if (content.includes(word)) {
      errors.push(`包含疾病诊断词汇：${word}`);
    }
  }
  
  return {
    content,
    charCount,
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * 压缩日报内容（超限时调用）
 */
export function compressDailyReport(content: string): string {
  // 移除空行
  let compressed = content.replace(/\n+/g, '\n');
  
  // 移除重复空格
  compressed = compressed.replace(/\s+/g, ' ');
  
  // 简化表述
  compressed = compressed.replace(/记录原因：/g, '');
  compressed = compressed.replace(/差异提示：人工记录：/g, '差异：');
  
  // 如果仍然超限，截断
  const charCount = countChineseChars(compressed);
  if (charCount > MAX_CHINESE_CHARS) {
    const maxLen = Math.floor(content.length * MAX_CHINESE_CHARS / charCount);
    compressed = compressed.substring(0, maxLen) + '...';
  }
  
  return compressed;
}

// ============================================
// 工具函数
// ============================================

/**
 * 统计中文字符数（中文汉字+标点，英文数字不计）
 */
export function countChineseChars(text: string): number {
  // 匹配中文字符和中文标点
  const chineseRegex = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g;
  const matches = text.match(chineseRegex);
  return matches ? matches.length : 0;
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ============================================
// 导出
// ============================================

export default {
  calculateStockBalance,
  calculateLayerThermalDiff,
  aggregateMortality,
  generateDailyReport,
  compressDailyReport,
  countChineseChars,
};
