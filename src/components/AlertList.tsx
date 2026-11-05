"use client";

import { useEffect, useState } from "react";

interface Alert {
  id: number;
  alertTime: string;
  level: string;
  type: string;
  content: string | null;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolveNote: string | null;
  batch: { name: string; houseNo: string | null } | null;
}

const LEVELS = [
  { key: "", label: "全部" },
  { key: "urgent", label: "🔴 紧急" },
  { key: "warning", label: "🟡 预警" },
  { key: "info", label: "🔵 提示" },
];

const LEVEL_BADGE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  info: "bg-blue-100 text-blue-700",
};

const LEVEL_LABEL: Record<string, string> = {
  urgent: "🔴 紧急",
  warning: "🟡 预警",
  info: "🔵 提示",
};

export default function AlertList() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveForm, setResolveForm] = useState({ resolvedBy: "", resolveNote: "" });

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (level) params.set("level", level);
    if (status) params.set("status", status);
    const res = await fetch(`/api/alerts?${params.toString()}`);
    setAlerts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, status]);

  async function submitResolve(id: number) {
    const res = await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resolveForm),
    });
    if (res.ok) {
      setResolvingId(null);
      setResolveForm({ resolvedBy: "", resolveNote: "" });
      load();
    } else {
      alert("操作失败，请重试");
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none";

  return (
    <div className="space-y-3">
      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex gap-1">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLevel(l.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                level === l.key ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {[
            { key: "open", label: "未处理" },
            { key: "resolved", label: "已处理" },
            { key: "", label: "全部状态" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                status === s.key ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">加载中…</p>
      ) : alerts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white py-10 text-center text-sm text-gray-400">
          没有符合条件的告警
        </p>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${LEVEL_BADGE[a.level] ?? "bg-gray-100"}`}>
                  {LEVEL_LABEL[a.level] ?? a.level}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(a.alertTime).toLocaleString("zh-CN", { hour12: false })}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-800">{a.content}</p>
              {a.status === "resolved" ? (
                <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  ✅ 已处理{a.resolvedBy ? `（${a.resolvedBy}）` : ""}
                  {a.resolvedAt && (
                    <> · {new Date(a.resolvedAt).toLocaleString("zh-CN", { hour12: false })}</>
                  )}
                  {a.resolveNote && <p className="mt-1">备注：{a.resolveNote}</p>}
                </div>
              ) : resolvingId === a.id ? (
                <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
                  <input
                    className={inputCls}
                    placeholder="处理人"
                    value={resolveForm.resolvedBy}
                    onChange={(e) => setResolveForm({ ...resolveForm, resolvedBy: e.target.value })}
                  />
                  <textarea
                    rows={2}
                    className={inputCls}
                    placeholder="处理备注（如：已调整风机、已隔离病鸡…）"
                    value={resolveForm.resolveNote}
                    onChange={(e) => setResolveForm({ ...resolveForm, resolveNote: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitResolve(a.id)}
                      className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      确认已处理
                    </button>
                    <button
                      onClick={() => setResolvingId(null)}
                      className="rounded-lg bg-gray-200 px-4 py-1.5 text-xs text-gray-600"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setResolvingId(a.id); setResolveForm({ resolvedBy: "", resolveNote: "" }); }}
                  className="mt-3 rounded-lg border border-green-300 bg-green-50 px-4 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
                >
                  ✔ 标记已处理
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
