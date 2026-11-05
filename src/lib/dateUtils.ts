// 日期工具：统一以本地时区的 "YYYY-MM-DD" 语义处理 record_date
// record_date 在数据库中存为该日期的本地零点（new Date(y, m-1, d)）

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function todayStart(): Date {
  return startOfDay(new Date());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// 解析 "YYYY-MM-DD" 为本地零点；非法输入返回今天的零点
export function parseRecordDate(s: string | undefined | null): Date {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return todayStart();
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 日龄 = 当前日期 - 进雏日期 + 1
export function calcAgeDays(startDate: Date, onDate?: Date): number {
  const base = startOfDay(onDate ?? new Date());
  const start = startOfDay(new Date(startDate));
  return Math.round((base.getTime() - start.getTime()) / 86400000) + 1;
}
