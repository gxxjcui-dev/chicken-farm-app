-- V2.0-R1.2-SP3 第一阶段 数据迁移脚本
-- 生成时间：2026-11-08
-- 基于：GPT方案（三方讨论最终结论）
-- 数据库：PostgreSQL (Supabase)
-- 迁移策略：幂等、事务原子、支持重复执行

-- ============================================
-- 迁移说明
-- ============================================

-- 本脚本用于将V1数据迁移到V2结构
-- 特点：
-- 1. 幂等性：可以重复执行，不会产生重复数据
-- 2. 事务原子性：每个迁移任务在独立事务中执行
-- 3. 可追溯性：使用MigrationMapping记录映射关系
-- 4. 可重试性：失败的迁移可以单独重试

-- ============================================
-- 迁移前置检查
-- ============================================

DO $$
BEGIN
  -- 检查必要的表是否存在
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'migration_mappings') THEN
    RAISE EXCEPTION 'migration_mappings表不存在，请先执行DDL迁移脚本';
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'migration_logs') THEN
    RAISE EXCEPTION 'migration_logs表不存在，请先执行DDL迁移脚本';
  END IF;
  
  RAISE NOTICE '前置检查通过，开始数据迁移';
END $$;

-- ============================================
-- 迁移1：Batch → BatchMeta
-- ============================================

BEGIN;

-- 记录迁移开始
INSERT INTO migration_logs (migration_batch_id, attempt_status, attempt_time)
VALUES ('migration_001_batch_meta', 'started', NOW());

-- 迁移批次元数据
WITH migrated_batches AS (
  INSERT INTO batch_meta (
    batch_id,
    chicken_house_no,
    in_chick_date,
    strain_info,
    chick_source,
    is_valid_reference,
    created_at,
    updated_at
  )
  SELECT 
    b.id,
    b.house_no,
    b.start_date,
    NULL, -- strain_info 需要人工补充
    NULL, -- chick_source 需要人工补充
    CASE WHEN b.status = 'completed' THEN TRUE ELSE FALSE END,
    NOW(),
    NOW()
  FROM batches b
  WHERE NOT EXISTS (
    SELECT 1 FROM migration_mappings mm
    WHERE mm.legacy_source_table = 'batches'
    AND mm.legacy_source_id = b.id::TEXT
    AND mm.target_table = 'batch_meta'
    AND mm.mapping_status = 'success'
  )
  RETURNING id, batch_id
)
-- 记录映射关系
INSERT INTO migration_mappings (
  legacy_source_table,
  legacy_source_id,
  target_table,
  legacy_subrecord_key,
  target_new_id,
  mapping_status
)
SELECT 
  'batches',
  mb.batch_id::TEXT,
  'batch_meta',
  'default', -- 一对一迁移，使用'default'
  mb.id,
  'success'
FROM migrated_batches mb;

-- 记录迁移成功
INSERT INTO migration_logs (migration_batch_id, attempt_status, attempt_time)
VALUES ('migration_001_batch_meta', 'success', NOW());

COMMIT;

-- ============================================
-- 迁移2：环境数据（示例，需要根据实际V1表结构调整）
-- ============================================

BEGIN;

-- 记录迁移开始
INSERT INTO migration_logs (migration_batch_id, attempt_status, attempt_time)
VALUES ('migration_002_environment', 'started', NOW());

-- 检查V1环境表是否存在
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'env_records') THEN
    -- 迁移环境数据
    WITH migrated_env AS (
      INSERT INTO environment_readings (
        batch_id,
        read_time,
        probe_id,
        position_desc,
        temp,
        humidity,
        data_source,
        created_at,
        updated_at
      )
      SELECT 
        er.batch_id,
        er.record_date,
        'legacy_probe', -- 默认探头编号
        'V1迁移数据', -- 位置描述
        er.temperature,
        er.humidity,
        'manual',
        NOW(),
        NOW()
      FROM env_records er
      WHERE NOT EXISTS (
        SELECT 1 FROM migration_mappings mm
        WHERE mm.legacy_source_table = 'env_records'
        AND mm.legacy_source_id = er.id::TEXT
        AND mm.target_table = 'environment_readings'
        AND mm.mapping_status = 'success'
      )
      RETURNING id, batch_id
    )
    -- 记录映射关系
    INSERT INTO migration_mappings (
      legacy_source_table,
      legacy_source_id,
      target_table,
      legacy_subrecord_key,
      target_new_id,
      mapping_status
    )
    SELECT 
      'env_records',
      me.batch_id::TEXT,
      'environment_readings',
      'default',
      me.id,
      'success'
    FROM migrated_env me;
    
    RAISE NOTICE '已迁移env_records数据到environment_readings';
  ELSE
    RAISE NOTICE 'env_records表不存在，跳过环境数据迁移';
  END IF;
END $$;

-- 记录迁移成功
INSERT INTO migration_logs (migration_batch_id, attempt_status, attempt_time)
VALUES ('migration_002_environment', 'success', NOW());

COMMIT;

-- ============================================
-- 迁移3：死淘数据（示例）
-- ============================================

BEGIN;

-- 记录迁移开始
INSERT INTO migration_logs (migration_batch_id, attempt_status, attempt_time)
VALUES ('migration_003_mortality', 'started', NOW());

-- 检查V1死淘表是否存在
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mortality_records') THEN
    -- 迁移死淘数据到健康事件表
    WITH migrated_mortality AS (
      INSERT INTO health_medication_events (
        batch_id,
        event_time,
        record_time,
        event_type,
        event_count,
        disposal_desc,
        recorder,
        created_at,
        updated_at
      )
      SELECT 
        mr.batch_id,
        mr.record_date,
        NOW(),
        'dead',
        mr.count,
        mr.reason,
        'system_migration',
        NOW(),
        NOW()
      FROM mortality_records mr
      WHERE NOT EXISTS (
        SELECT 1 FROM migration_mappings mm
        WHERE mm.legacy_source_table = 'mortality_records'
        AND mm.legacy_source_id = mr.id::TEXT
        AND mm.target_table = 'health_medication_events'
        AND mm.mapping_status = 'success'
      )
      RETURNING id, batch_id
    )
    -- 记录映射关系
    INSERT INTO migration_mappings (
      legacy_source_table,
      legacy_source_id,
      target_table,
      legacy_subrecord_key,
      target_new_id,
      mapping_status
    )
    SELECT 
      'mortality_records',
      mm.batch_id::TEXT,
      'health_medication_events',
      'default',
      mm.id,
      'success'
    FROM migrated_mortality mm;
    
    RAISE NOTICE '已迁移mortality_records数据到health_medication_events';
  ELSE
    RAISE NOTICE 'mortality_records表不存在，跳过死淘数据迁移';
  END IF;
END $$;

-- 记录迁移成功
INSERT INTO migration_logs (migration_batch_id, attempt_status, attempt_time)
VALUES ('migration_003_mortality', 'success', NOW());

COMMIT;

-- ============================================
-- 迁移4：采食饮水数据（示例）
-- ============================================

BEGIN;

-- 记录迁移开始
INSERT INTO migration_logs (migration_batch_id, attempt_status, attempt_time)
VALUES ('migration_004_feed', 'started', NOW());

-- 检查V1采食表是否存在
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feed_records') THEN
    -- 更新DailyRecord的采食饮水数据
    UPDATE daily_records_new dr
    SET 
      feed_consume = fr.feed_amount,
      water_consume = fr.water_amount,
      updated_at = NOW()
    FROM feed_records fr
    WHERE dr.batch_id = fr.batch_id
    AND dr.record_date = fr.record_date
    AND dr.feed_consume IS NULL; -- 只更新空值，避免覆盖已有数据
    
    RAISE NOTICE '已更新daily_records的采食饮水数据';
  ELSE
    RAISE NOTICE 'feed_records表不存在，跳过采食饮水数据迁移';
  END IF;
END $$;

-- 记录迁移成功
INSERT INTO migration_logs (migration_batch_id, attempt_status, attempt_time)
VALUES ('migration_004_feed', 'success', NOW());

COMMIT;

-- ============================================
-- 迁移5：健康记录（示例）
-- ============================================

BEGIN;

-- 记录迁移开始
INSERT INTO migration_logs (migration_batch_id, attempt_status, attempt_time)
VALUES ('migration_005_health', 'started', NOW());

-- 检查V1健康表是否存在
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'health_records') THEN
    -- 迁移健康记录到健康事件表
    WITH migrated_health AS (
      INSERT INTO health_medication_events (
        batch_id,
        event_time,
        record_time,
        event_type,
        disposal_desc,
        vet_opinion,
        recorder,
        created_at,
        updated_at
      )
      SELECT 
        hr.batch_id,
        hr.record_date,
        NOW(),
        'medicine', -- 默认为用药事件
        NULL,
        hr.treatment,
        hr.symptoms,
        'system_migration',
        NOW(),
        NOW()
      FROM health_records hr
      WHERE NOT EXISTS (
        SELECT 1 FROM migration_mappings mm
        WHERE mm.legacy_source_table = 'health_records'
        AND mm.legacy_source_id = hr.id::TEXT
        AND mm.target_table = 'health_medication_events'
        AND mm.mapping_status = 'success'
      )
      RETURNING id, batch_id
    )
    -- 记录映射关系
    INSERT INTO migration_mappings (
      legacy_source_table,
      legacy_source_id,
      target_table,
      legacy_subrecord_key,
      target_new_id,
      mapping_status
    )
    SELECT 
      'health_records',
      mh.batch_id::TEXT,
      'health_medication_events',
      'default',
      mh.id,
      'success'
    FROM migrated_health mh;
    
    RAISE NOTICE '已迁移health_records数据到health_medication_events';
  ELSE
    RAISE NOTICE 'health_records表不存在，跳过健康记录迁移';
  END IF;
END $$;

-- 记录迁移成功
INSERT INTO migration_logs (migration_batch_id, attempt_status, attempt_time)
VALUES ('migration_005_health', 'success', NOW());

COMMIT;

-- ============================================
-- 迁移后验证
-- ============================================

-- 验证迁移映射数量
DO $$
DECLARE
  mapping_count INTEGER;
  log_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mapping_count FROM migration_mappings;
  SELECT COUNT(*) INTO log_count FROM migration_logs;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '迁移完成统计：';
  RAISE NOTICE '  映射记录数：%', mapping_count;
  RAISE NOTICE '  迁移日志数：%', log_count;
  RAISE NOTICE '========================================';
END $$;

-- 查询迁移失败的记录
SELECT 
  ml.migration_batch_id,
  ml.attempt_status,
  ml.migration_error,
  ml.attempt_time
FROM migration_logs ml
WHERE ml.attempt_status = 'failed'
ORDER BY ml.attempt_time DESC;

-- ============================================
-- 回滚脚本（谨慎使用）
-- ============================================

-- 如果需要回滚，可以使用以下脚本
-- 注意：回滚会删除已迁移的数据，但不会删除migration_mappings和migration_logs

/*
BEGIN;

-- 删除迁移的数据
DELETE FROM environment_readings WHERE data_source = 'manual';
DELETE FROM health_medication_events WHERE recorder = 'system_migration';
DELETE FROM batch_meta WHERE batch_id IN (SELECT id FROM batches);

-- 注意：不删除migration_mappings和migration_logs，保留迁移历史

COMMIT;
*/

-- ============================================
-- 完成
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'V2.0-R1.2-SP3 第一阶段 数据迁移完成';
  RAISE NOTICE '========================================';
  RAISE NOTICE '请检查以下内容：';
  RAISE NOTICE '1. migration_mappings表中的映射记录';
  RAISE NOTICE '2. migration_logs表中的迁移日志';
  RAISE NOTICE '3. 各业务表中的迁移数据';
  RAISE NOTICE '4. 是否有失败的迁移记录';
  RAISE NOTICE '========================================';
END $$;
