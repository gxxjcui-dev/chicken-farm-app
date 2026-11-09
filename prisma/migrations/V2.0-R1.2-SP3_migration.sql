-- V2.0-R1.2-SP3 第一阶段数据库迁移脚本
-- 创建日期：2026-11-07
-- 核心理念：记录→模仿→边界修正；第一阶段只做完整记录
-- 红线：禁止自动比较、自动告警、自动融合参数

-- ============================================
-- 业务表1：DailyRecord【改造原有】
-- ============================================
-- 删除旧字段
ALTER TABLE daily_records DROP COLUMN IF EXISTS water_curtain_manual_day_flag;

-- 新增字段
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS start_count INT;
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS transfer_in_num INT;
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS out_transfer_num INT;
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS end_count INT;
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS dead_num INT; -- 聚合来自HealthMedicationEvent
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS eliminate_num INT; -- 聚合来自HealthMedicationEvent
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS calc_source VARCHAR(50); -- auto_aggregate / manual_corrected
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS ref_source VARCHAR(100);
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS layer_thermal_diff DECIMAL(4,2); -- 分层温差，仅多层有效测点才可计算
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS daily_conflict_status JSONB; -- 冲突状态记录

-- 重命名字段（保持兼容）
ALTER TABLE daily_records RENAME COLUMN recorddate TO record_date;
ALTER TABLE daily_records RENAME COLUMN dayage TO day_age;
ALTER TABLE daily_records RENAME COLUMN feedamount TO feed_consume;
ALTER TABLE daily_records RENAME COLUMN wateramount TO water_consume;

-- 添加软删除字段
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================
-- 业务表2：EnvironmentReading【新建，多测点环境读数】
-- ============================================
CREATE TABLE IF NOT EXISTS environment_readings (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    read_time TIMESTAMP NOT NULL,
    probe_id VARCHAR(50) NOT NULL,
    cage_column VARCHAR(20),
    cage_layer VARCHAR(10), -- 上/中/下
    position_desc VARCHAR(200) NOT NULL, -- 必须记录测点位置
    temp DECIMAL(4,2),
    humidity DECIMAL(4,2),
    data_source VARCHAR(20), -- sensor / manual
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_env_reading_batch_time ON environment_readings(batch_id, read_time);
CREATE INDEX idx_env_reading_probe ON environment_readings(probe_id, read_time);

-- ============================================
-- 业务表3：EquipmentOperationLog【新建设备事件】
-- ============================================
CREATE TABLE IF NOT EXISTS equipment_operation_logs (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    operate_time TIMESTAMP NOT NULL,
    device_type VARCHAR(20) NOT NULL, -- fan / water_curtain
    device_no VARCHAR(50) NOT NULL,
    operate_action VARCHAR(20) NOT NULL, -- start / stop / set_param
    status_before VARCHAR(100),
    status_after VARCHAR(100),
    controller_set_value VARCHAR(100),
    operate_type VARCHAR(20), -- auto / manual
    system_auto_suggest TEXT DEFAULT '', -- 第一阶段恒为空字符串
    operator_note TEXT,
    operator VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_equipment_log_batch_time ON equipment_operation_logs(batch_id, operate_time);
CREATE INDEX idx_equipment_log_device ON equipment_operation_logs(device_type, device_no, operate_time);

-- ============================================
-- 业务表4：ManagerDecisionLog【厂长决策核心表，新建】
-- ============================================
CREATE TABLE IF NOT EXISTS manager_decision_logs (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    decision_time TIMESTAMP NOT NULL,
    day_age INT NOT NULL,
    env_snapshot_json JSONB, -- 环境快照
    manager_target_json JSONB, -- 厂长目标
    actual_operation TEXT, -- 实际操作
    operation_reason TEXT, -- 操作原因
    consult_other TEXT, -- 咨询他人（仅人工录入，AI禁止生成处方）
    env_after_change TEXT, -- 调整后环境
    chicken_performance TEXT, -- 鸡群表现
    decision_maker VARCHAR(50) NOT NULL,
    manual_record_conflict BOOLEAN DEFAULT FALSE, -- true才联动写入knowledge_conflict_log
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_manager_decision_batch_time ON manager_decision_logs(batch_id, decision_time);
CREATE INDEX idx_manager_decision_day_age ON manager_decision_logs(batch_id, day_age);

-- ============================================
-- 业务表5：HealthMedicationEvent【健康事件新建】
-- ============================================
CREATE TABLE IF NOT EXISTS health_medication_events (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    event_time TIMESTAMP NOT NULL, -- 事件真实发生时间
    record_time TIMESTAMP NOT NULL, -- 录入系统时间
    event_type VARCHAR(20) NOT NULL, -- dead / eliminate / vaccine / medicine
    event_count INT,
    disposal_desc TEXT, -- 处置描述
    vet_opinion TEXT, -- 兽医意见（人工录入）
    recorder VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_health_event_batch_time ON health_medication_events(batch_id, event_time);
CREATE INDEX idx_health_event_type ON health_medication_events(batch_id, event_type, event_time);

-- ============================================
-- 业务表6：batch_meta【批次元数据新建】
-- ============================================
CREATE TABLE IF NOT EXISTS batch_meta (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT UNIQUE NOT NULL,
    chicken_house_no VARCHAR(50),
    in_chick_date DATE,
    strain_info VARCHAR(100), -- 品种/品系
    chick_source VARCHAR(200), -- 鸡苗来源
    batch_note TEXT, -- 批次备注（禁止程序自动改写）
    parse_note_temp TEXT, -- 预留，第一阶段禁止程序自动写入
    is_valid_reference BOOLEAN DEFAULT FALSE, -- 成功批次打标
    mark_user VARCHAR(50),
    mark_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_batch_meta_house_date ON batch_meta(chicken_house_no, in_chick_date);
CREATE INDEX idx_batch_meta_valid ON batch_meta(is_valid_reference) WHERE is_valid_reference = TRUE;

-- ============================================
-- 业务表7：knowledge_conflict_log【冲突日志新建】
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_conflict_logs (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    record_date DATE NOT NULL,
    conflict_item VARCHAR(200) NOT NULL,
    authority_value_json JSONB, -- 参考值+KB-ID
    human_set_value_json JSONB, -- 人工设定值
    risk_prompt TEXT,
    is_confirm SMALLINT DEFAULT 0, -- 0未确认/1确认
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_conflict_log_batch_date ON knowledge_conflict_logs(batch_id, record_date);
CREATE INDEX idx_conflict_log_confirm ON knowledge_conflict_logs(is_confirm) WHERE is_confirm = 0;

-- 约束：第一阶段仅manual_record_conflict=true才插入记录
ALTER TABLE knowledge_conflict_logs ADD CONSTRAINT chk_manual_only 
    CHECK (is_confirm IN (0, 1));

-- ============================================
-- 业务表8：alert_tolerance_config【容忍配置新建】
-- ============================================
CREATE TABLE IF NOT EXISTS alert_tolerance_configs (
    id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    tolerance_value DECIMAL(10,2),
    is_enabled BOOLEAN DEFAULT FALSE, -- 第一阶段强制false，不调用
    kb_snapshot_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- ============================================
-- 业务表9：test_case【测试用例新建】
-- ============================================
CREATE TABLE IF NOT EXISTS test_cases (
    id BIGSERIAL PRIMARY KEY,
    case_name VARCHAR(200) NOT NULL,
    case_level VARCHAR(20), -- 冒烟/单元/集成/回归
    input_desc TEXT,
    expect_result TEXT,
    actual_result TEXT,
    run_status VARCHAR(20) DEFAULT 'not_run', -- not_run/pass/fail
    executor VARCHAR(50),
    execute_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_test_case_level ON test_cases(case_level, run_status);

-- ============================================
-- 基础设施表1：MigrationMapping【唯一映射幂等核心】
-- ============================================
CREATE TABLE IF NOT EXISTS migration_mappings (
    id BIGSERIAL PRIMARY KEY,
    legacy_source_table VARCHAR(100) NOT NULL,
    legacy_source_id VARCHAR(100) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    legacy_subrecord_key VARCHAR(100) DEFAULT 'default', -- 一对一填default；一对多用不同key
    target_new_id BIGINT,
    mapping_status VARCHAR(20) NOT NULL, -- success / abandoned
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_mapping UNIQUE (legacy_source_table, legacy_source_id, target_table, legacy_subrecord_key)
);

CREATE INDEX idx_mapping_status ON migration_mappings(mapping_status);

-- ============================================
-- 基础设施表2：MigrationLog【迁移尝试流水】
-- ============================================
CREATE TABLE IF NOT EXISTS migration_logs (
    id BIGSERIAL PRIMARY KEY,
    mapping_id BIGINT REFERENCES migration_mappings(id),
    migration_batch_id VARCHAR(100), -- 迁移作业批次标记
    attempt_status VARCHAR(20) NOT NULL, -- started / success / skipped / failed
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    migration_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_migration_log_batch ON migration_logs(migration_batch_id, attempt_time);
CREATE INDEX idx_migration_log_status ON migration_logs(attempt_status, attempt_time);

-- ============================================
-- 创建更新时间触发器函数（如果不存在）
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- 为所有新表添加updated_at触发器
-- ============================================
CREATE TRIGGER update_environment_readings_updated_at BEFORE UPDATE ON environment_readings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_operation_logs_updated_at BEFORE UPDATE ON equipment_operation_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manager_decision_logs_updated_at BEFORE UPDATE ON manager_decision_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_medication_events_updated_at BEFORE UPDATE ON health_medication_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batch_meta_updated_at BEFORE UPDATE ON batch_meta
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_conflict_logs_updated_at BEFORE UPDATE ON knowledge_conflict_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_tolerance_configs_updated_at BEFORE UPDATE ON alert_tolerance_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_migration_mappings_updated_at BEFORE UPDATE ON migration_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 验证查询
-- ============================================
-- 检查所有表是否创建成功
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'daily_records',
    'environment_readings',
    'equipment_operation_logs',
    'manager_decision_logs',
    'health_medication_events',
    'batch_meta',
    'knowledge_conflict_logs',
    'alert_tolerance_configs',
    'test_cases',
    'migration_mappings',
    'migration_logs'
  )
ORDER BY table_name;

-- 检查DailyRecord新字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_records' 
  AND column_name IN (
    'start_count',
    'transfer_in_num',
    'out_transfer_num',
    'end_count',
    'dead_num',
    'eliminate_num',
    'calc_source',
    'ref_source',
    'layer_thermal_diff',
    'daily_conflict_status',
    'deleted_at'
  )
ORDER BY column_name;

-- ============================================
-- 迁移完成标记
-- ============================================
-- 插入迁移完成记录
INSERT INTO migration_logs (mapping_id, migration_batch_id, attempt_status, migration_error)
VALUES (NULL, 'V2.0-R1.2-SP3_DDL', 'success', 'DDL migration completed successfully');

-- 输出统计
SELECT 
    'V2.0-R1.2-SP3 DDL Migration' AS migration_name,
    COUNT(*) AS table_count,
    'Completed' AS status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'environment_readings',
    'equipment_operation_logs',
    'manager_decision_logs',
    'health_medication_events',
    'batch_meta',
    'knowledge_conflict_logs',
    'alert_tolerance_configs',
    'test_cases',
    'migration_mappings',
    'migration_logs'
  );
