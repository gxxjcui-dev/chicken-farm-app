// V2.0-R1.2-SP3 第一阶段 TypeScript类型定义
// 生成时间：2026-11-08
// 基于：Prisma Schema（GPT方案）

// ============================================
// 基础类型
// ============================================

/** 软删除基础接口 */
export interface SoftDelete {
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 批次基础接口 */
export interface BatchBase {
  batchId: number;
}

// ============================================
// V2业务表类型
// ============================================

/** 日记录表（改造） */
export interface DailyRecord extends SoftDelete, BatchBase {
  id: number;
  recordDate: Date;
  dayAge: number;
  
  // 存栏数据
  startCount?: number | null;
  transferInNum?: number | null;
  outTransferNum?: number | null;
  endCount?: number | null;
  
  // 死淘数据
  deadNum?: number | null;
  eliminateNum?: number | null;
  
  // 采食饮水
  feedConsume?: number | null;
  waterConsume?: number | null;
  
  // 数据来源标记
  calcSource?: string | null;
  refSource?: string | null;
  
  // 分层温差
  layerThermalDiff?: number | null;
  
  // 冲突状态
  dailyConflictStatus?: any | null;
  
  // 人工备注
  humanNote?: string | null;
}

/** 环境读数表 */
export interface EnvironmentReading extends SoftDelete, BatchBase {
  id: bigint;
  readTime: Date;
  probeId: string;
  cageColumn?: string | null;
  cageLayer?: string | null;
  positionDesc: string;
  temp?: number | null;
  humidity?: number | null;
  dataSource?: string | null;
}

/** 设备操作日志表 */
export interface EquipmentOperationLog extends SoftDelete, BatchBase {
  id: bigint;
  operateTime: Date;
  deviceType: string;
  deviceNo: string;
  operateAction: string;
  statusBefore?: string | null;
  statusAfter?: string | null;
  controllerSetValue?: string | null;
  operateType?: string | null;
  systemAutoSuggest: string;
  operatorNote?: string | null;
  operator?: string | null;
}

/** 厂长决策日志表 */
export interface ManagerDecisionLog extends SoftDelete, BatchBase {
  id: bigint;
  decisionTime: Date;
  recordDate?: Date | null;
  dayAge: number;
  envSnapshotJson?: any | null;
  managerTargetJson?: any | null;
  actualOperation?: string | null;
  operationReason?: string | null;
  consultOther?: string | null;
  envAfterChange?: string | null;
  chickenPerformance?: string | null;
  decisionMaker: string;
  manualRecordConflict: boolean;
}

/** 健康用药事件表 */
export interface HealthMedicationEvent extends SoftDelete, BatchBase {
  id: bigint;
  eventTime: Date;
  recordTime: Date;
  eventType: string;
  eventCount?: number | null;
  disposalDesc?: string | null;
  vetOpinion?: string | null;
  recorder?: string | null;
}

/** 批次元数据表 */
export interface BatchMeta extends SoftDelete {
  id: bigint;
  batchId: bigint;
  chickenHouseNo?: string | null;
  inChickDate?: Date | null;
  strainInfo?: string | null;
  chickSource?: string | null;
  batchNote?: string | null;
  parseNoteTemp?: string | null;
  isValidReference: boolean;
  markUser?: string | null;
  markTime?: Date | null;
}

/** 知识冲突日志表 */
export interface KnowledgeConflictLog extends SoftDelete, BatchBase {
  id: bigint;
  managerDecisionId: bigint;
  recordDate: Date;
  conflictItem: string;
  authorityValueJson?: any | null;
  humanSetValueJson?: any | null;
  riskPrompt?: string | null;
  isConfirm: number;
}

/** 告警容忍配置表 */
export interface AlertToleranceConfig extends SoftDelete {
  id: bigint;
  configKey: string;
  toleranceValue?: number | null;
  isEnabled: boolean;
  kbSnapshotVersion?: string | null;
}

/** 测试用例表 */
export interface TestCase extends SoftDelete {
  id: bigint;
  caseName: string;
  caseLevel?: string | null;
  inputDesc?: string | null;
  expectResult?: string | null;
  actualResult?: string | null;
  runStatus: string;
  executor?: string | null;
  executeTime?: Date | null;
}

// ============================================
// 基础设施表类型
// ============================================

/** 迁移映射表 */
export interface MigrationMapping {
  id: bigint;
  legacySourceTable: string;
  legacySourceId: string;
  targetTable: string;
  legacySubrecordKey: string;
  targetNewId?: bigint | null;
  mappingStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 迁移日志表 */
export interface MigrationLog {
  id: bigint;
  mappingId?: bigint | null;
  migrationBatchId?: string | null;
  attemptStatus: string;
  attemptTime: Date;
  migrationError?: string | null;
  createdAt: Date;
}

// ============================================
// AI日报相关类型
// ============================================

/** AI日报输入 */
export interface DailyReportInput {
  batchId: number;
  recordDate: Date;
  dayAge: number;
  measurements: EnvironmentReading[];
  managerSettings?: ManagerDecisionLog | null;
  references?: Array<{
    kbId: string;
    source: string;
    isBook: boolean;
  }> | null;
  conflictNote?: string | null;
  mortality?: {
    deadNum: number;
    eliminateNum: number;
  } | null;
}

/** AI日报输出 */
export interface DailyReportOutput {
  content: string;
  charCount: number;
  isValid: boolean;
  errors?: string[];
}

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
  isValid: boolean;
  reason?: string;
  layerTemps?: Array<{
    layer: string;
    temp: number;
    positionDesc: string;
  }>;
}

/** 死淘聚合结果 */
export interface MortalityAggregateResult {
  deadNum: number;
  eliminateNum: number;
  eventCount: number;
}

// ============================================
// 查询过滤器类型
// ============================================

/** 批次查询过滤器 */
export interface BatchFilter {
  batchId?: number;
  houseNo?: string;
  status?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
}

/** 日记录查询过滤器 */
export interface DailyRecordFilter {
  batchId?: number;
  recordDateFrom?: Date;
  recordDateTo?: Date;
  dayAgeFrom?: number;
  dayAgeTo?: number;
  hasConflict?: boolean;
}

/** 环境读数查询过滤器 */
export interface EnvironmentReadingFilter {
  batchId?: number;
  readTimeFrom?: Date;
  readTimeTo?: Date;
  probeId?: string;
  cageLayer?: string;
  dataSource?: string;
}

/** 设备操作查询过滤器 */
export interface EquipmentOperationFilter {
  batchId?: number;
  operateTimeFrom?: Date;
  operateTimeTo?: Date;
  deviceType?: string;
  deviceNo?: string;
  operateType?: string;
}

/** 决策日志查询过滤器 */
export interface ManagerDecisionFilter {
  batchId?: number;
  decisionTimeFrom?: Date;
  decisionTimeTo?: Date;
  recordDateFrom?: Date;
  recordDateTo?: Date;
  dayAgeFrom?: number;
  dayAgeTo?: number;
  decisionMaker?: string;
  hasConflict?: boolean;
}

/** 健康事件查询过滤器 */
export interface HealthEventFilter {
  batchId?: number;
  eventTimeFrom?: Date;
  eventTimeTo?: Date;
  eventType?: string;
  recorder?: string;
}

// ============================================
// 分页查询类型
// ============================================

/** 分页参数 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/** 分页结果 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// API响应类型
// ============================================

/** 通用API响应 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** 批量操作响应 */
export interface BatchOperationResponse {
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  errors?: Array<{
    id: string | number;
    error: string;
  }>;
}

// ============================================
// 类型均以具名 export 导出（interface 不能作为值导出，故不提供 default export）
// ============================================
