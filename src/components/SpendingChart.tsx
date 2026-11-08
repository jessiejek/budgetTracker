import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { money } from "../lib/money";
export default function SpendingChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <div
      className="chart-wrap"
      role="img"
      aria-label="Expense breakdown by category; values listed below"
    >
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={78}
            stroke="none"
          >
            {data.map((c) => (
              <Cell key={c.name} fill={c.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => money(Number(v))}
            itemStyle={{ color: "var(--expense-amount)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
