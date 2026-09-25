interface ScoreGaugeProps {
  value: number; // 0-100
  label: string;
  size?: number;
}

export function ScoreGauge({ value, label, size = 108 }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - 12) / 2;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
        <path
          d={`M 6 ${size / 2 + 6} A ${radius} ${radius} 0 0 1 ${size - 6} ${size / 2 + 6}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M 6 ${size / 2 + 6} A ${radius} ${radius} 0 0 1 ${size - 6} ${size / 2 + 6}`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
        <text
          x="50%"
          y={size / 2 - 2}
          textAnchor="middle"
          className="fill-ink font-display font-semibold"
          style={{ fontSize: size * 0.24 }}
        >
          {Math.round(clamped)}
        </text>
      </svg>
      <span className="text-xs font-medium text-ink-muted text-center">{label}</span>
    </div>
  );
}
