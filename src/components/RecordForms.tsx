"use client";

import { useEffect, useState, FormEvent } from "react";

interface Batch {
  id: number;
  name: string;
  houseNo: string | null;
}

interface AlertInfo {
  level: string;
  type: string;
  content: string;
}

const TABS = [
  { key: "env", label: "🌡️ 环境" },
  { key: "feed", label: "🍚 饲喂" },
  { key: "mortality", label: "💀 死淘" },
  { key: "weight", label: "⚖️ 体重" },
  { key: "health", label: "💉 免疫用药" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const LEVEL_LABEL: Record<string, string> = {
  urgent: "🔴 紧急",
  warning: "🟡 预警",
  info: "🔵 提示",
};

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RecordForms() {
  const [tab, setTab] = useState<TabKey>("env");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string>("");
  const [recordDate, setRecordDate] = useState(todayStr());
  const [msg, setMsg] = useState<{ ok: boolean; text: string; alerts?: AlertInfo[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 各表单状态
  const [env, setEnv] = useState({ period: "morning", temperature: "", humidity: "", ammonia: "", recorder: "", note: "" });
  const [feed, setFeed] = useState({ feedKg: "", waterL: "", feedType: "育雏料", note: "" });
  const [mortality, setMortality] = useState({ count: "", reason: "疾病", symptoms: "", treatment: "" });
  const [weight, setWeight] = useState({ sampleCount: "", avgWeightG: "", uniformity: "好", note: "" });
  const [health, setHealth] = useState({ type: "vaccine", productName: "", dosage: "", method: "饮水", operator: "", note: "" });

  useEffect(() => {
    fetch("/api/batches?status=active")
      .then((r) => r.json())
      .then((list: Batch[]) => {
        setBatches(list);
        if (list.length > 0) setBatchId(String(list[0].id));
      });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!batchId) {
      setMsg({ ok: false, text: "请先选择批次（无批次请先到「批次管理」新建）" });
      return;
    }
    setSubmitting(true);
    setMsg(null);

    let url = "";
    let payload: Record<string, unknown> = { batchId: Number(batchId), recordDate };
    if (tab === "env") {
      url = "/api/records/env";
      payload = { ...payload, ...env };
    } else if (tab === "feed") {
      url = "/api/records/feed";
      payload = { ...payload, ...feed };
    } else if (tab === "mortality") {
      url = "/api/records/mortality";
      payload = { ...payload, ...mortality };
    } else if (tab === "weight") {
      url = "/api/records/weight";
      payload = { ...payload, ...weight };
    } else {
      url = "/api/records/health";
      payload = { ...payload, ...health };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      const alerts: AlertInfo[] = data.alerts ?? [];
      setMsg({ ok: true, text: "保存成功", alerts });
      // 清空数量类字段，方便连续录入
      if (tab === "env") setEnv((p) => ({ ...p, temperature: "", humidity: "", ammonia: "", note: "" }));
      if (tab === "feed") setFeed((p) => ({ ...p, feedKg: "", waterL: "", note: "" }));
      if (tab === "mortality") setMortality((p) => ({ ...p, count: "", symptoms: "", treatment: "" }));
      if (tab === "weight") setWeight((p) => ({ ...p, sampleCount: "", avgWeightG: "", note: "" }));
      if (tab === "health") setHealth((p) => ({ ...p, productName: "", dosage: "", note: "" }));
    } else {
      setMsg({ ok: false, text: data.error ?? "保存失败" });
    }
  }

  return (
    <div className="space-y-4">
      {/* 批次与日期（所有表单共用） */}
      <section className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className={labelCls}>养殖批次 *</label>
          <select className={inputCls} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {batches.length === 0 && <option value="">暂无在养批次</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}{b.houseNo ? `（${b.houseNo}）` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>记录日期 *</label>
          <input type="date" className={inputCls} value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
        </div>
      </section>

      {/* Tab 切换 */}
      <div className="grid grid-cols-5 gap-1 rounded-lg bg-gray-200 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setMsg(null); }}
            className={`rounded-md py-2 text-xs font-semibold sm:text-sm ${
              tab === t.key ? "bg-white text-green-700 shadow" : "text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {tab === "env" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>时段 *</label>
              <select className={inputCls} value={env.period} onChange={(e) => setEnv({ ...env, period: e.target.value })}>
                <option value="morning">早</option>
                <option value="noon">中</option>
                <option value="evening">晚</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>温度（°C）*</label>
              <input required type="number" step="0.1" className={inputCls} placeholder="如 28.5" value={env.temperature} onChange={(e) => setEnv({ ...env, temperature: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>湿度（%）*</label>
              <input required type="number" step="0.1" className={inputCls} placeholder="如 60" value={env.humidity} onChange={(e) => setEnv({ ...env, humidity: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>氨气（ppm，选填）</label>
              <input type="number" step="0.01" className={inputCls} value={env.ammonia} onChange={(e) => setEnv({ ...env, ammonia: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>记录人</label>
              <input className={inputCls} value={env.recorder} onChange={(e) => setEnv({ ...env, recorder: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>备注</label>
              <input className={inputCls} value={env.note} onChange={(e) => setEnv({ ...env, note: e.target.value })} />
            </div>
          </div>
        )}

        {tab === "feed" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>采食量（kg）*</label>
              <input required type="number" step="0.1" className={inputCls} value={feed.feedKg} onChange={(e) => setFeed({ ...feed, feedKg: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>饮水量（L）*</label>
              <input required type="number" step="0.1" className={inputCls} value={feed.waterL} onChange={(e) => setFeed({ ...feed, waterL: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>饲料阶段</label>
              <select className={inputCls} value={feed.feedType} onChange={(e) => setFeed({ ...feed, feedType: e.target.value })}>
                <option value="育雏料">育雏料</option>
                <option value="中期料">中期料</option>
                <option value="后期料">后期料</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>备注</label>
              <input className={inputCls} value={feed.note} onChange={(e) => setFeed({ ...feed, note: e.target.value })} />
            </div>
          </div>
        )}

        {tab === "mortality" && (
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>死淘数量（只）*</label>
                <input required type="number" min={1} className={inputCls} value={mortality.count} onChange={(e) => setMortality({ ...mortality, count: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>原因</label>
                <select className={inputCls} value={mortality.reason} onChange={(e) => setMortality({ ...mortality, reason: e.target.value })}>
                  <option value="疾病">疾病</option>
                  <option value="压死">压死</option>
                  <option value="弱雏">弱雏</option>
                  <option value="不明">不明</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>症状描述（AI 辅助诊断依据）</label>
              <textarea rows={2} className={inputCls} placeholder="如：精神萎靡、拉白稀粪、呼吸困难…" value={mortality.symptoms} onChange={(e) => setMortality({ ...mortality, symptoms: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>已采取措施</label>
              <input className={inputCls} value={mortality.treatment} onChange={(e) => setMortality({ ...mortality, treatment: e.target.value })} />
            </div>
          </div>
        )}

        {tab === "weight" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>抽样数量（只）*</label>
              <input required type="number" min={1} className={inputCls} value={weight.sampleCount} onChange={(e) => setWeight({ ...weight, sampleCount: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>平均体重（g）*</label>
              <input required type="number" step="0.1" className={inputCls} value={weight.avgWeightG} onChange={(e) => setWeight({ ...weight, avgWeightG: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>均匀度</label>
              <select className={inputCls} value={weight.uniformity} onChange={(e) => setWeight({ ...weight, uniformity: e.target.value })}>
                <option value="好">好</option>
                <option value="中">中</option>
                <option value="差">差</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>备注</label>
              <input className={inputCls} value={weight.note} onChange={(e) => setWeight({ ...weight, note: e.target.value })} />
            </div>
          </div>
        )}

        {tab === "health" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>类型 *</label>
              <select className={inputCls} value={health.type} onChange={(e) => setHealth({ ...health, type: e.target.value })}>
                <option value="vaccine">免疫</option>
                <option value="medicine">用药</option>
                <option value="disinfection">消毒</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>药品/疫苗名称 *</label>
              <input required className={inputCls} placeholder="如 新城疫疫苗" value={health.productName} onChange={(e) => setHealth({ ...health, productName: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>剂量</label>
              <input className={inputCls} placeholder="如 2倍量、0.5ml/只" value={health.dosage} onChange={(e) => setHealth({ ...health, dosage: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>方式</label>
              <select className={inputCls} value={health.method} onChange={(e) => setHealth({ ...health, method: e.target.value })}>
                <option value="饮水">饮水</option>
                <option value="滴鼻">滴鼻</option>
                <option value="点眼">点眼</option>
                <option value="喷雾">喷雾</option>
                <option value="拌料">拌料</option>
                <option value="注射">注射</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>操作人</label>
              <input className={inputCls} value={health.operator} onChange={(e) => setHealth({ ...health, operator: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>备注</label>
              <input className={inputCls} value={health.note} onChange={(e) => setHealth({ ...health, note: e.target.value })} />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || batches.length === 0}
          className="mt-4 w-full rounded-lg bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? "保存中…" : "保存记录"}
        </button>

        {msg && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            <p>{msg.text}</p>
            {msg.alerts && msg.alerts.length > 0 && (
              <ul className="mt-2 space-y-1">
                {msg.alerts.map((a, i) => (
                  <li key={i} className="rounded bg-white/70 px-2 py-1 text-xs">
                    {LEVEL_LABEL[a.level] ?? a.level} {a.content}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
