// V2.0-R1.2-SP3 TypeScript类型定义
// 创建日期：2026-11-07
// 核心理念：记录→模仿→边界修正；四类信息严格隔离

// ============================================
// 基础类型
// ============================================

/** 数据来源类型 */
export type DataSource = 'sensor' | 'manual';

/** 计算来源类型 */
export type CalcSource = 'auto_aggregate' | 'manual_corrected';

/** 设备类型 */
export type DeviceType = 'fan' | 'water_curtain';

/** 操作类型 */
export type OperateType = 'auto' | 'manual';

/** 操作动作 */
export type OperateAction = 'start' | 'stop' | 'set_param';

/** 事件类型 */
export type EventType = 'dead' | 'eliminate' | 'vaccine' | 'medicine';

/** 笼层 */
export type CageLayer = '上' | '中' | '下';

/** 映射状态 */
export type MappingStatus = 'success' | 'abandoned';

/** 尝试状态 */
export type AttemptStatus = 'started' | 'success' | 'skipped' | 'failed';

/** 测试用例级别 */
export type CaseLevel = '冒烟' | '单元' | '集成' | '回归';

/** 运行状态 */
export type RunStatus = 'not_run' | 'pass' | 'fail';

// ============================================
// 业务表1：DailyRecord【改造】
// ============================================

export interface DailyRecord {
  id: number;
  batchId: number;
  recordDate: Date;
  dayAge: number;
  
  // 存栏数据
  startCount?: number;
  transferInNum?: number;
  outTransferNum?: number;
  endCount?: number;
  
  // 死淘数据（聚合来自HealthMedicationEvent）
  deadNum?: number;
  eliminateNum?: number;
  
  // 采食饮水
  feedConsume?: number; // kg
  waterConsume?: number; // L
  
  // 数据来源标记
  calcSource?: CalcSource;
  refSource?: string;
  
  // 分层温差（仅多层有效测点才可计算）
  layerThermalDiff?: number;
  
  // 冲突状态
  dailyConflictStatus?: DailyConflictStatus;
  
  // 人工备注
  humanNote?: string;
  
  // 软删除
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** 日冲突状态 */
export interface DailyConflictStatus {
  hasConflict: boolean;
  conflictItems?: string[];
  lastConflictDate?: Date;
}

// ============================================
// 业务表2：EnvironmentReading【新建】
// ============================================

export interface EnvironmentReading {
  id: bigint;
  batchId: bigint;
  readTime: Date;
  probeId: string;
  cageColumn?: string;
  cageLayer?: CageLayer;
  positionDesc: string; // 必须记录测点位置
  temp?: number;
  humidity?: number;
  dataSource?: DataSource;
  
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 业务表3：EquipmentOperationLog【新建】
// ============================================

export interface EquipmentOperationLog {
  id: bigint;
  batchId: bigint;
  operateTime: Date;
  deviceType: DeviceType;
  deviceNo: string;
  operateAction: OperateAction;
  statusBefore?: string;
  statusAfter?: string;
  controllerSetValue?: string;
  operateType?: OperateType;
  systemAutoSuggest: string; // 第一阶段恒为空字符串
  operatorNote?: string;
  operator?: string;
  
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 业务表4：ManagerDecisionLog【厂长决策核心表】
// ============================================

export interface ManagerDecisionLog {
  id: bigint;
  batchId: bigint;
  decisionTime: Date;
  dayAge: number;
  envSnapshotJson?: EnvSnapshot;
  managerTargetJson?: ManagerTarget;
  actualOperation?: string;
  operationReason?: string;
  consultOther?: string; // 仅人工录入，AI禁止生成处方
  envAfterChange?: string;
  chickenPerformance?: string;
  decisionMaker: string;
  manualRecordConflict: boolean; // true才联动写入knowledge_conflict_log
  
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** 环境快照 */
export interface EnvSnapshot {
  temp?: number;
  humidity?: number;
  fanCount?: number;
  negativePressure?: number;
  timestamp: Date;
}

/** 厂长目标 */
export interface ManagerTarget {
  targetTemp?: number;
  targetHumidity?: number;
  targetFanCount?: number;
  reason?: string;
}

// ============================================
// 业务表5：HealthMedicationEvent【健康事件】
// ============================================

export interface HealthMedicationEvent {
  id: bigint;
  batchId: bigint;
  eventTime: Date; // 事件真实发生时间
  recordTime: Date; // 录入系统时间
  eventType: EventType;
  eventCount?: number;
  disposalDesc?: string;
  vetOpinion?: string; // 人工录入
  recorder?: string;
  
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 业务表6：BatchMeta【批次元数据】
// ============================================

export interface BatchMeta {
  id: bigint;
  batchId: bigint;
  chickenHouseNo?: string;
  inChickDate?: Date;
  strainInfo?: string; // 品种/品系
  chickSource?: string; // 鸡苗来源
  batchNote?: string; // 禁止程序自动改写
  parseNoteTemp?: string; // 预留，第一阶段禁止程序自动写入
  isValidReference: boolean; // 成功批次打标
  markUser?: string;
  markTime?: Date;
  
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 业务表7：KnowledgeConflictLog【冲突日志】
// ============================================

export interface KnowledgeConflictLog {
  id: bigint;
  batchId: bigint;
  recordDate: Date;
  conflictItem: string;
  authorityValueJson?: AuthorityValue;
  humanSetValueJson?: HumanSetValue;
  riskPrompt?: string;
  isConfirm: number; // 0未确认/1确认
  
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** 权威参考值 */
export interface AuthorityValue {
  value: number | string;
  kbId: string;
  source: string;
  isBook?: boolean; // 是否为书籍来源
}

/** 人工设定值 */
export interface HumanSetValue {
  value: number | string;
  reason?: string;
  timestamp: Date;
}

// ============================================
// 业务表8：AlertToleranceConfig【容忍配置】
// ============================================

export interface AlertToleranceConfig {
  id: bigint;
  configKey: string;
  toleranceValue?: number;
  isEnabled: boolean; // 第一阶段强制false
  kbSnapshotVersion?: string;
  
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 业务表9：TestCase【测试用例】
// ============================================

export interface TestCase {
  id: bigint;
  caseName: string;
  caseLevel?: CaseLevel;
  inputDesc?: string;
  expectResult?: string;
  actualResult?: string;
  runStatus: RunStatus;
  executor?: string;
  executeTime?: Date;
  
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 基础设施表1：MigrationMapping【唯一映射幂等核心】
// ============================================

export interface MigrationMapping {
  id: bigint;
  legacySourceTable: string;
  legacySourceId: string;
  targetTable: string;
  legacySubrecordKey: string; // 一对一填default；一对多用不同key
  targetNewId?: bigint;
  mappingStatus: MappingStatus;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 基础设施表2：MigrationLog【迁移尝试流水】
// ============================================

export interface MigrationLog {
  id: bigint;
  mappingId?: bigint;
  migrationBatchId?: string;
  attemptStatus: AttemptStatus;
  attemptTime: Date;
  migrationError?: string;
  
  createdAt: Date;
}

// ============================================
// AI日报相关类型
// ============================================

/** AI日报输入数据 */
export interface DailyReportInput {
  batchId: number;
  recordDate: Date;
  dayAge: number;
  
  // 实测数据（SQL计算）
  measurements: {
    positionDesc: string;
    temp?: number;
    humidity?: number;
    fanCount?: number;
  }[];
  
  // 厂长设定（人工填写）
  managerSettings?: {
    targetTemp?: number;
    targetHumidity?: number;
    reason?: string;
  };
  
  // 参考数据（只读，来自知识库）
  references?: {
    kbId: string;
    source: string;
    isBook: boolean;
    value: string;
  }[];
  
  // 差异提示（人工记录）
  conflictNote?: string;
  
  // 死淘数据（SQL聚合）
  mortality?: {
    deadNum: number;
    eliminateNum: number;
  };
}

/** AI日报输出 */
export interface DailyReportOutput {
  content: string; // ≤200字（中文字符）
  charCount: number;
  isValid: boolean; // 是否符合硬性校验
  errors?: string[];
}

// ============================================
// API请求/响应类型
// ============================================

/** 创建日记录请求 */
export interface CreateDailyRecordRequest {
  batchId: number;
  recordDate: string; // YYYY-MM-DD
  dayAge: number;
  startCount?: number;
  transferInNum?: number;
  outTransferNum?: number;
  endCount?: number;
  feedConsume?: number;
  waterConsume?: number;
  humanNote?: string;
}

/** 创建环境读数请求 */
export interface CreateEnvironmentReadingRequest {
  batchId: number;
  readTime: string; // ISO 8601
  probeId: string;
  cageColumn?: string;
  cageLayer?: CageLayer;
  positionDesc: string;
  temp?: number;
  humidity?: number;
  dataSource?: DataSource;
}

/** 创建设备操作日志请求 */
export interface CreateEquipmentLogRequest {
  batchId: number;
  operateTime: string; // ISO 8601
  deviceType: DeviceType;
  deviceNo: string;
  operateAction: OperateAction;
  statusBefore?: string;
  statusAfter?: string;
  controllerSetValue?: string;
  operateType?: OperateType;
  operatorNote?: string;
  operator?: string;
}

/** 创建厂长决策日志请求 */
export interface CreateManagerDecisionRequest {
  batchId: number;
  decisionTime: string; // ISO 8601
  dayAge: number;
  envSnapshotJson?: EnvSnapshot;
  managerTargetJson?: ManagerTarget;
  actualOperation?: string;
  operationReason?: string;
  consultOther?: string;
  envAfterChange?: string;
  chickenPerformance?: string;
  decisionMaker: string;
  manualRecordConflict?: boolean;
}

/** 创建健康事件请求 */
export interface CreateHealthEventRequest {
  batchId: number;
  eventTime: string; // ISO 8601
  recordTime: string; // ISO 8601
  eventType: EventType;
  eventCount?: number;
  disposalDesc?: string;
  vetOpinion?: string;
  recorder?: string;
}

/** 创建冲突日志请求（仅人工勾选） */
export interface CreateConflictLogRequest {
  batchId: number;
  recordDate: string; // YYYY-MM-DD
  conflictItem: string;
  authorityValueJson?: AuthorityValue;
  humanSetValueJson?: HumanSetValue;
  riskPrompt?: string;
}

// ============================================
// 工具类型
// ============================================

/** 存栏平衡计算结果 */
export interface StockBalanceResult {
  startCount: number;
  transferIn: number;
  transferOut: number;
  dead: number;
  eliminate: number;
  endCount: number;
  calculated: number;
  isBalanced: boolean;
}

/** 分层温差计算结果 */
export interface LayerThermalDiffResult {
  maxDiff?: number;
  isValid: boolean; // 是否满足计算条件
  reason?: string; // 不满足条件的原因
  layerTemps?: {
    layer: CageLayer;
    temp: number;
    positionDesc: string;
  }[];
}

/** 死淘聚合结果 */
export interface MortalityAggregateResult {
  deadNum: number;
  eliminateNum: number;
  eventCount: number;
  lastEventTime?: Date;
}
