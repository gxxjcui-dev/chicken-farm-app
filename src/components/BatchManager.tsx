"use client";

import { useEffect, useState, FormEvent } from "react";

interface Batch {
  id: number;
  name: string;
  houseNo: string | null;
  breed: string | null;
  startDate: string;
  initialCount: number;
  currentCount: number | null;
  status: string;
  note: string | null;
}

function calcAge(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t.getTime() - s.getTime()) / 86400000) + 1;
}

function fmtDate(s: string): string {
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BatchManager() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Batch | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    houseNo: "",
    breed: "",
    startDate: new Date().toISOString().slice(0, 10),
    initialCount: "",
    note: "",
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/batches");
    setBatches(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    const res = await fetch("/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, initialCount: Number(form.initialCount) }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setMsg({ ok: true, text: `批次「${data.name}」创建成功` });
      setForm({ name: "", houseNo: "", breed: "", startDate: new Date().toISOString().slice(0, 10), initialCount: "", note: "" });
      load();
    } else {
      setMsg({ ok: false, text: data.error ?? "创建失败" });
    }
  }

  async function finishBatch(b: Batch) {
    if (!confirm(`确认批次「${b.name}」出栏？出栏后状态改为已出栏。`)) return;
    const res = await fetch(`/api/batches/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finish" }),
    });
    if (res.ok) {
      setMsg({ ok: true, text: `批次「${b.name}」已出栏` });
      load();
    } else {
      setMsg({ ok: false, text: "操作失败" });
    }
  }

  async function deleteBatch() {
    if (!deleting || confirmName !== deleting.name) return;
    setDeleteSubmitting(true);
    const res = await fetch(`/api/batches/${deleting.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeleteSubmitting(false);
    if (res.ok) {
      setMsg({ ok: true, text: `批次「${data.name}」已永久删除（含 ${data.deletedRecords} 条关联记录）` });
      setDeleting(null);
      setConfirmName("");
      load();
    } else {
      setMsg({ ok: false, text: data.error ?? "删除失败" });
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-gray-600";

  return (
    <div className="space-y-5">
      {/* 新建批次表单 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-gray-700">➕ 新建批次</h3>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>批次名称 *</label>
            <input required className={inputCls} placeholder='如 "2026-01批"' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>棚号</label>
            <input className={inputCls} placeholder='如 "1号棚"' value={form.houseNo} onChange={(e) => setForm({ ...form, houseNo: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>品种</label>
            <input className={inputCls} placeholder="如 AA+、ROSS 308" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>进雏日期 *</label>
            <input required type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>进雏数量（只）*</label>
            <input required type="number" min={1} className={inputCls} value={form.initialCount} onChange={(e) => setForm({ ...form, initialCount: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>备注</label>
            <input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {submitting ? "提交中…" : "创建批次"}
            </button>
          </div>
        </form>
        {msg && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg.text}
          </p>
        )}
      </section>

      {/* 批次列表 */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-700">📋 批次列表（{batches.length}）</h3>
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-400">加载中…</p>
        ) : batches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white py-8 text-center text-sm text-gray-400">暂无批次，请先新建</p>
        ) : (
          batches.map((b) => (
            <div key={b.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{b.name}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    b.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {b.status === "active" ? "在养" : "已出栏"}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {b.houseNo ? `${b.houseNo} · ` : ""}
                {b.breed ?? "品种未填"} · 进雏 {fmtDate(b.startDate)} · {b.initialCount} 只
                {b.status === "active" && (
                  <>
                    {" "}· <span className="font-semibold text-green-700">{calcAge(b.startDate)} 日龄</span> · 存栏{" "}
                    {b.currentCount ?? b.initialCount} 只
                  </>
                )}
              </div>
              {b.note && <p className="mt-1 text-xs text-gray-400">备注：{b.note}</p>}
              <div className="mt-3 flex gap-2">
                {b.status === "active" && (
                  <button
                    onClick={() => finishBatch(b)}
                    className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                  >
                    🏁 出栏
                  </button>
                )}
                <button
                  onClick={() => { setDeleting(b); setConfirmName(""); }}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  🗑 删除
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* 删除批次二次确认弹窗：需输入完整批次名 */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h4 className="text-sm font-bold text-red-700">⚠️ 永久删除批次</h4>
            <p className="mt-2 text-sm text-gray-700">
              即将删除批次「<span className="font-semibold">{deleting.name}</span>」及其<strong>全部关联数据</strong>（环境/饲喂/死淘/体重/免疫记录、告警等），删除后<span className="font-semibold text-red-600">不可恢复</span>。
            </p>
            <p className="mt-3 text-xs text-gray-500">请输入完整批次名称「{deleting.name}」确认：</p>
            <input
              autoFocus
              className="mt-1 w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={deleting.name}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setDeleting(null); setConfirmName(""); }}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={deleteBatch}
                disabled={confirmName !== deleting.name || deleteSubmitting}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {deleteSubmitting ? "删除中…" : "永久删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
