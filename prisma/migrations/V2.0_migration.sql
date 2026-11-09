-- V2.0 数据库迁移脚本
-- 执行前请备份现有数据
-- 执行方式：在 Supabase SQL Editor 中执行

-- ============================================
-- 第一部分：修改 daily_records 表（新增字段）
-- ============================================

-- 新增温湿度偏差说明字段
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS deviationtype VARCHAR(20);
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS deviationnote TEXT;

-- 新增天气字段（如果不存在）
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS weathertemphigh DECIMAL(4,1);
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS weathertemplow DECIMAL(4,1);
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS weathercondition VARCHAR(50);
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS weatherwind VARCHAR(50);

-- ============================================
-- 第二部分：创建 ventilation_records 表（通风记录）
-- ============================================

CREATE TABLE IF NOT EXISTS ventilation_records (
  id SERIAL PRIMARY KEY,
  dailyrecordid INTEGER NOT NULL REFERENCES daily_records(id) ON DELETE CASCADE,
  fancount INTEGER,
  fanlevel VARCHAR(10),
  windowcount INTEGER,
  windowsize DECIMAL(5,2),
  negativepressure DECIMAL(5,2),
  ventilationnote TEXT,
  createdat TIMESTAMP DEFAULT NOW(),
  updatedat TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ventilation_records_dailyrecordid ON ventilation_records(dailyrecordid);

-- ============================================
-- 第三部分：创建 mortality_details 表（死淘明细）
-- ============================================

CREATE TABLE IF NOT EXISTS mortality_details (
  id SERIAL PRIMARY KEY,
  dailyrecordid INTEGER NOT NULL REFERENCES daily_records(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  count INTEGER NOT NULL,
  note TEXT,
  createdat TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_mortality_details_dailyrecordid ON mortality_details(dailyrecordid);
CREATE INDEX IF NOT EXISTS idx_mortality_details_category ON mortality_details(category);

-- ============================================
-- 第四部分：创建 medication_records 表（用药记录）
-- ============================================

CREATE TABLE IF NOT EXISTS medication_records (
  id SERIAL PRIMARY KEY,
  dailyrecordid INTEGER NOT NULL REFERENCES daily_records(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL,
  medicinename VARCHAR(100),
  reason TEXT,
  createdat TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_medication_records_dailyrecordid ON medication_records(dailyrecordid);
CREATE INDEX IF NOT EXISTS idx_medication_records_category ON medication_records(category);

-- ============================================
-- 第五部分：创建更新时间触发器（自动更新 updatedat）
-- ============================================

-- 为 ventilation_records 表创建更新时间触发器
CREATE OR REPLACE FUNCTION update_ventilation_records_updatedat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updatedat = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ventilation_records_updatedat
BEFORE UPDATE ON ventilation_records
FOR EACH ROW
EXECUTE FUNCTION update_ventilation_records_updatedat();

-- ============================================
-- 第六部分：验证迁移
-- ============================================

-- 验证新表是否创建成功
SELECT 'ventilation_records' AS table_name, COUNT(*) AS row_count FROM ventilation_records
UNION ALL
SELECT 'mortality_details' AS table_name, COUNT(*) AS row_count FROM mortality_details
UNION ALL
SELECT 'medication_records' AS table_name, COUNT(*) AS row_count FROM medication_records;

-- 验证新字段是否添加成功
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_records' 
AND column_name IN ('deviationtype', 'deviationnote', 'weathertemphigh', 'weathertemplow', 'weathercondition', 'weatherwind');

-- ============================================
-- 迁移完成
-- ============================================
