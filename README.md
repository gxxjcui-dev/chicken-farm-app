# 鸡棚数据管理应用（chicken-farm-app）

肉鸡养殖日常数据记录与监控系统——「鸡棚AI监管」的数据中枢。

## 快速启动

```bash
cd chicken-farm-app
npm install        # 首次运行
npx prisma db push # 首次初始化数据库（已初始化可跳过）
npm run dev        # 启动开发服务
```

浏览器访问 http://localhost:3000

## 页面功能

| 页面 | 路径 | 功能 |
|---|---|---|
| 仪表盘 | / | 在养批次卡片、当日录入状态、近7天温度曲线（含日龄标准区间）、死淘趋势、未处理告警 |
| 批次管理 | /batches | 新建批次（名称/棚号/品种/进雏日期/数量）、出栏结算 |
| 每日录入 | /records | 5 类表单：环境（早中晚温湿度/氨气）、饲喂、死淘、体重抽检、免疫用药 |
| 告警列表 | /alerts | 按级别筛选（紧急/预警/提示）、标记已处理 |

## 告警规则

录入数据时服务端自动判定（`src/lib/alerts.ts` + `standards.ts`）：

- **温度**：按批次日龄对照标准区间，超出告警线 → 🔴 紧急
- **湿度**：<40% 或 >75% → 🟡 预警
- **日死淘率**：>1% → 🔴 紧急；0.5%~1% → 🟡 预警
- **采食量**：较前日骤降 >20% → 🟡 预警
- **体重**：偏离标准 >10% → 🔵 提示

## 数据库

- **本地开发**：SQLite（`prisma/dev.db`），开箱即用
- **云端部署**：切换 PostgreSQL——修改 `prisma/schema.prisma` 的 `datasource` provider 为 `postgresql`，并更新 `.env` 的 `DATABASE_URL`

表结构详见 `../docs/02_数据库设计.md`。

## API 一览

- `GET/POST /api/batches`、`PATCH /api/batches/[id]`（出栏）
- `POST /api/records/env | feed | mortality | weight | health`
- `GET /api/alerts`、`PATCH /api/alerts/[id]`（处理告警）

## 配套：AI 监管助手

本应用数据由扣子 Agent「鸡棚AI监管助手」每日定时巡检，自动生成日报并推送异常告警。
