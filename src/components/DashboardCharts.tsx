"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
} from "recharts";

export interface TempChartPoint {
  date: string;
  avgTemp: number | null;
  alarmLow: number;
  alarmHigh: number;
}

export interface MortChartPoint {
  date: string;
  dead: number;
}

export function TempChart({ data }: { data: TempChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={12} tickFormatter={(v: string) => v.slice(5)} />
        <YAxis fontSize={12} domain={["auto", "auto"]} unit="°" />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="avgTemp"
          name="平均温度(°C)"
          stroke="#16a34a"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="alarmHigh"
          name="告警上限"
          stroke="#dc2626"
          strokeDasharray="6 4"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="alarmLow"
          name="告警下限"
          stroke="#2563eb"
          strokeDasharray="6 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MortalityChart({ data }: { data: MortChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={12} tickFormatter={(v: string) => v.slice(5)} />
        <YAxis fontSize={12} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="dead" name="死淘数量(只)" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
