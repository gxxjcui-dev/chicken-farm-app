-- V2.0-R1.2-SP3 第一阶段 数据库DDL迁移脚本
-- 生成时间：2026-11-08
-- 基于：GPT方案（三方讨论最终结论）
-- 数据库：PostgreSQL (Supabase)
-- 执行顺序：按照依赖关系排序

-- ============================================
-- 前置检查
-- ============================================

-- 检查是否存在旧表（如果存在则备份）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_records') THEN
    RAISE NOTICE '发现现有daily_records表，将进行改造';
  END IF;
END $$;

-- ============================================
-- 第一部分：创建基础设施表
-- ============================================

-- 基础设施表1：MigrationMapping（唯一映射幂等核心）
CREATE TABLE IF NOT EXISTS migration_mappings (
  id BIGSERIAL PRIMARY KEY,
  legacy_source_table VARCHAR(100) NOT NULL,
  legacy_source_id VARCHAR(100) NOT NULL,
  target_table VARCHAR(100) NOT NULL,
  legacy_subrecord_key VARCHAR(100) NOT NULL, -- GPT方案：NOT NULL，业务层明确传入
  target_new_id BIGINT,
  mapping_status VARCHAR(20) NOT NULL, -- success / abandoned
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 四字段联合唯一索引
  CONSTRAINT uk_mapping UNIQUE (legacy_source_table, legacy_source_id, target_table, legacy_subrecord_key)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_migration_mappings_target ON migration_mappings(target_table, target_new_id);
CREATE INDEX IF NOT EXISTS idx_migration_mappings_status ON migration_mappings(mapping_status);

-- 基础设施表2：MigrationLog（迁移尝试流水）
CREATE TABLE IF NOT EXISTS migration_logs (
  id BIGSERIAL PRIMARY KEY,
  mapping_id BIGINT REFERENCES migration_mappings(id) ON DELETE RESTRICT,
  migration_batch_id VARCHAR(100),
  attempt_status VARCHAR(20) NOT NULL, -- started / success / skipped / failed
  attempt_time TIMESTAMP NOT NULL DEFAULT NOW(),
  migration_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_migration_logs_batch_time ON migration_logs(migration_batch_id, attempt_time);
CREATE INDEX IF NOT EXISTS idx_migration_logs_batch_status ON migration_logs(migration_batch_id, attempt_status);
CREATE INDEX IF NOT EXISTS idx_migration_logs_status_time ON migration_logs(attempt_status, attempt_time);

-- ============================================
-- 第二部分：创建业务表
-- ============================================

-- 业务表1：DailyRecord（改造现有表）
-- 注意：如果表已存在，需要先备份数据，然后重建

-- 创建新表结构
CREATE TABLE IF NOT EXISTS daily_records_new (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  record_date DATE NOT NULL,
  day_age INTEGER NOT NULL,
  
  -- 存栏数据
  start_count INTEGER,
  transfer_in_num INTEGER,
  out_transfer_num INTEGER,
  end_count INTEGER,
  
  -- 死淘数据
  dead_num INTEGER,
  eliminate_num INTEGER,
  
  -- 采食饮水
  feed_consume DECIMAL(10, 2),
  water_consume DECIMAL(10, 2),
  
  -- 数据来源标记
  calc_source VARCHAR(50),
  ref_source VARCHAR(100),
  
  -- 分层温差
  layer_thermal_diff DECIMAL(4, 2),
  
  -- 冲突状态
  daily_conflict_status JSONB,
  
  -- 人工备注
  human_note TEXT,
  
  -- 软删除
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 唯一约束
  CONSTRAINT uk_daily_records_batch_date UNIQUE (batch_id, record_date)
);

-- 如果存在旧表，迁移数据
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_records') THEN
    -- 迁移数据（字段映射）
    INSERT INTO daily_records_new (
      id, batch_id, record_date, day_age,
      feed_consume, water_consume,
      created_at, updated_at
    )
    SELECT 
      id, batch_id, record_date, day_age,
      feed_consume, water_consume,
      created_at, updated_at
    FROM daily_records
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE '已迁移daily_records数据到daily_records_new';
  END IF;
END $$;

-- 删除旧表（谨慎操作，确保数据已备份）
-- DROP TABLE IF EXISTS daily_records CASCADE;

-- 重命名新表
-- ALTER TABLE daily_records_new RENAME TO daily_records;

-- 业务表2：EnvironmentReading（多测点环境读数）
CREATE TABLE IF NOT EXISTS environment_readings (
  id BIGSERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  read_time TIMESTAMP NOT NULL,
  probe_id VARCHAR(50) NOT NULL,
  cage_column VARCHAR(50),
  cage_layer VARCHAR(20),
  position_desc VARCHAR(200) NOT NULL,
  temp DECIMAL(4, 2),
  humidity DECIMAL(4, 2),
  data_source VARCHAR(20),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_environment_readings_batch_time ON environment_readings(batch_id, read_time);
CREATE INDEX IF NOT EXISTS idx_environment_readings_batch_layer_time ON environment_readings(batch_id, cage_layer, read_time);
CREATE INDEX IF NOT EXISTS idx_environment_readings_probe_time ON environment_readings(probe_id, read_time);

-- 业务表3：EquipmentOperationLog（设备操作日志）
CREATE TABLE IF NOT EXISTS equipment_operation_logs (
  id BIGSERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  operate_time TIMESTAMP NOT NULL,
  device_type VARCHAR(20) NOT NULL, -- fan / water_curtain
  device_no VARCHAR(50) NOT NULL,
  operate_action VARCHAR(20) NOT NULL, -- start / stop / set_param
  status_before VARCHAR(50),
  status_after VARCHAR(50),
  controller_set_value VARCHAR(100),
  operate_type VARCHAR(20), -- auto / manual
  system_auto_suggest VARCHAR(200) NOT NULL DEFAULT '',
  operator_note TEXT,
  operator VARCHAR(50),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_equipment_operation_logs_batch_time ON equipment_operation_logs(batch_id, operate_time);
CREATE INDEX IF NOT EXISTS idx_equipment_operation_logs_device_time ON equipment_operation_logs(device_type, device_no, operate_time);

-- 业务表4：ManagerDecisionLog（厂长决策核心表）
CREATE TABLE IF NOT EXISTS manager_decision_logs (
  id BIGSERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  decision_time TIMESTAMP NOT NULL,
  record_date DATE, -- 用于按日分组，不做强外键绑定
  day_age INTEGER NOT NULL,
  env_snapshot_json JSONB,
  manager_target_json JSONB,
  actual_operation TEXT,
  operation_reason TEXT,
  consult_other VARCHAR(200),
  env_after_change TEXT,
  chicken_performance TEXT,
  decision_maker VARCHAR(50) NOT NULL,
  manual_record_conflict BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_manager_decision_logs_batch_time ON manager_decision_logs(batch_id, decision_time);
CREATE INDEX IF NOT EXISTS idx_manager_decision_logs_batch_age ON manager_decision_logs(batch_id, day_age);

-- 业务表5：HealthMedicationEvent（健康事件）
CREATE TABLE IF NOT EXISTS health_medication_events (
  id BIGSERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  event_time TIMESTAMP NOT NULL,
  record_time TIMESTAMP NOT NULL,
  event_type VARCHAR(20) NOT NULL, -- dead / eliminate / vaccine / medicine
  event_count INTEGER,
  disposal_desc TEXT,
  vet_opinion TEXT,
  recorder VARCHAR(50),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_health_medication_events_batch_time ON health_medication_events(batch_id, event_time);
CREATE INDEX IF NOT EXISTS idx_health_medication_events_batch_type_time ON health_medication_events(batch_id, event_type, event_time);

-- 业务表6：BatchMeta（批次元数据）
CREATE TABLE IF NOT EXISTS batch_meta (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL UNIQUE,
  chicken_house_no VARCHAR(50),
  in_chick_date DATE,
  strain_info VARCHAR(200),
  chick_source VARCHAR(200),
  batch_note TEXT,
  parse_note_temp TEXT,
  is_valid_reference BOOLEAN NOT NULL DEFAULT FALSE,
  mark_user VARCHAR(50),
  mark_time TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_batch_meta_house_date ON batch_meta(chicken_house_no, in_chick_date);
CREATE INDEX IF NOT EXISTS idx_batch_meta_valid_reference ON batch_meta(is_valid_reference);

-- 业务表7：KnowledgeConflictLog（冲突日志）
CREATE TABLE IF NOT EXISTS knowledge_conflict_logs (
  id BIGSERIAL PRIMARY KEY,
  manager_decision_id BIGINT NOT NULL,
  batch_id INTEGER NOT NULL,
  record_date DATE NOT NULL,
  conflict_item VARCHAR(200) NOT NULL,
  authority_value_json JSONB,
  human_set_value_json JSONB,
  risk_prompt TEXT,
  is_confirm INTEGER NOT NULL DEFAULT 0, -- 0未确认/1确认
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_knowledge_conflict_logs_batch_date ON knowledge_conflict_logs(batch_id, record_date);
CREATE INDEX IF NOT EXISTS idx_knowledge_conflict_logs_manager_decision ON knowledge_conflict_logs(manager_decision_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_conflict_logs_confirm ON knowledge_conflict_logs(is_confirm);

-- 业务表8：AlertToleranceConfig（容忍配置）
CREATE TABLE IF NOT EXISTS alert_tolerance_configs (
  id BIGSERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  tolerance_value DECIMAL(10, 2),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- 第一阶段强制false
  kb_snapshot_version VARCHAR(50),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 业务表9：TestCase（测试用例）
CREATE TABLE IF NOT EXISTS test_cases (
  id BIGSERIAL PRIMARY KEY,
  case_name VARCHAR(200) NOT NULL,
  case_level VARCHAR(20), -- 冒烟/单元/集成/回归
  input_desc TEXT,
  expect_result TEXT,
  actual_result TEXT,
  run_status VARCHAR(20) NOT NULL DEFAULT 'not_run', -- not_run/pass/fail
  executor VARCHAR(50),
  execute_time TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_test_cases_level_status ON test_cases(case_level, run_status);

-- ============================================
-- 第三部分：添加外键约束
-- ============================================

-- DailyRecord外键
ALTER TABLE daily_records_new 
  ADD CONSTRAINT fk_daily_records_batch 
  FOREIGN KEY (batch_id) 
  REFERENCES batches(id) 
  ON DELETE RESTRICT;

-- EnvironmentReading外键
ALTER TABLE environment_readings 
  ADD CONSTRAINT fk_environment_readings_batch 
  FOREIGN KEY (batch_id) 
  REFERENCES batches(id) 
  ON DELETE RESTRICT;

-- EquipmentOperationLog外键
ALTER TABLE equipment_operation_logs 
  ADD CONSTRAINT fk_equipment_operation_logs_batch 
  FOREIGN KEY (batch_id) 
  REFERENCES batches(id) 
  ON DELETE RESTRICT;

-- ManagerDecisionLog外键
ALTER TABLE manager_decision_logs 
  ADD CONSTRAINT fk_manager_decision_logs_batch 
  FOREIGN KEY (batch_id) 
  REFERENCES batches(id) 
  ON DELETE RESTRICT;

-- HealthMedicationEvent外键
ALTER TABLE health_medication_events 
  ADD CONSTRAINT fk_health_medication_events_batch 
  FOREIGN KEY (batch_id) 
  REFERENCES batches(id) 
  ON DELETE RESTRICT;

-- KnowledgeConflictLog外键（关联ManagerDecisionLog）
ALTER TABLE knowledge_conflict_logs 
  ADD CONSTRAINT fk_knowledge_conflict_logs_manager_decision 
  FOREIGN KEY (manager_decision_id) 
  REFERENCES manager_decision_logs(id) 
  ON DELETE RESTRICT;

-- KnowledgeConflictLog外键（关联Batch，用于查询）
ALTER TABLE knowledge_conflict_logs 
  ADD CONSTRAINT fk_knowledge_conflict_logs_batch 
  FOREIGN KEY (batch_id) 
  REFERENCES batches(id) 
  ON DELETE RESTRICT;

-- ============================================
-- 第四部分：创建更新时间触发器
-- ============================================

-- 创建通用更新时间函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有需要的表添加触发器
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'daily_records_new',
      'environment_readings',
      'equipment_operation_logs',
      'manager_decision_logs',
      'health_medication_events',
      'batch_meta',
      'knowledge_conflict_logs',
      'alert_tolerance_configs',
      'test_cases',
      'migration_mappings'
    )
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    ', t.tablename, t.tablename, t.tablename, t.tablename);
  END LOOP;
END $$;

-- ============================================
-- 第五部分：插入初始数据
-- ============================================

-- 插入告警容忍配置（第一阶段全部禁用）
INSERT INTO alert_tolerance_configs (config_key, tolerance_value, is_enabled)
VALUES 
  ('temp_deviation', 3.0, FALSE),
  ('humidity_deviation', 10.0, FALSE),
  ('mortality_rate', 5.0, FALSE)
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- 第六部分：验证
-- ============================================

-- 验证表是否创建成功
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN (
    'daily_records_new',
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
  
  RAISE NOTICE '成功创建 % 张表', table_count;
  
  IF table_count < 11 THEN
    RAISE WARNING '表数量不足，预期11张，实际 % 张', table_count;
  END IF;
END $$;

-- 验证外键约束
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN (
  'daily_records_new',
  'environment_readings',
  'equipment_operation_logs',
  'manager_decision_logs',
  'health_medication_events',
  'knowledge_conflict_logs'
)
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 完成
-- ============================================

-- 输出完成信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'V2.0-R1.2-SP3 第一阶段 DDL迁移完成';
  RAISE NOTICE '========================================';
  RAISE NOTICE '请检查以下内容：';
  RAISE NOTICE '1. 所有表是否创建成功';
  RAISE NOTICE '2. 所有外键约束是否正确';
  RAISE NOTICE '3. 所有索引是否创建成功';
  RAISE NOTICE '4. 数据是否完整迁移';
  RAISE NOTICE '========================================';
END $$;
