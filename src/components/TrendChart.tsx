"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function TrendChart({ data }: { data: { month: string; revenue: number; grossProfit: number; cogs: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2edd6" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
          <Tooltip formatter={(v: number) => new Intl.NumberFormat("id-ID").format(v)} />
          <Legend />
          <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#63903c" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="grossProfit" name="Gross Profit" stroke="#8a5a3c" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cogs" name="HPP" stroke="#a3c47e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
