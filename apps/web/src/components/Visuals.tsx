import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

interface SparklineProps {
  values: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}

export function Sparkline({ values, color = "#0a84ff", height = 52, fill = false }: SparklineProps) {
  const width = 180;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - 5 - ((value - min) / range) * (height - 12);
    return `${x},${y}`;
  });
  const line = points.join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {fill && <polygon points={area} fill={color} opacity="0.08" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points.at(-1)?.split(",")[0]} cy={points.at(-1)?.split(",")[1]} r="3.2" fill="white" stroke={color} strokeWidth="2" />
    </svg>
  );
}

interface ScoreRingProps {
  value: number;
  size?: number;
  tone?: "blue" | "green" | "orange" | "red";
  label?: string;
}

export function ScoreRing({ value, size = 76, tone = "blue", label }: ScoreRingProps) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className={`score-ring tone-${tone}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 68 68" aria-hidden="true">
        <circle className="score-ring-track" cx="34" cy="34" r={radius} />
        <circle className="score-ring-value" cx="34" cy="34" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span>{value}</span>
      {label && <small>{label}</small>}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  change?: number;
  helper: string;
  icon: ReactNode;
  series?: number[];
  tone?: string;
}

export function MetricCard({ label, value, change, helper, icon, series, tone = "#0a84ff" }: MetricCardProps) {
  return (
    <article className="metric-card surface-card">
      <div className="metric-card-header">
        <span className="metric-icon" style={{ color: tone, background: `${tone}14` }}>{icon}</span>
        {change !== undefined && (
          <span className={`metric-change ${change >= 0 ? "positive" : "negative"}`}>
            {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="metric-value-row">
        <div>
          <p>{label}</p>
          <strong>{value}</strong>
          <span>{helper}</span>
        </div>
        {series && <Sparkline values={series} color={tone} height={44} />}
      </div>
    </article>
  );
}

export function SegmentedBar({ values }: { values: Array<{ value: number; color: string; label: string }> }) {
  const total = Math.max(1, values.reduce((sum, value) => sum + value.value, 0));
  return (
    <div className="segmented-bar" role="img" aria-label={values.map((item) => `${item.label}: ${item.value}`).join(", ")}>
      {values.map((item) => (
        <span key={item.label} style={{ width: `${(item.value / total) * 100}%`, background: item.color }} />
      ))}
    </div>
  );
}
