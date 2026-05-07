'use client';

export default function DonutChart({ data, size = 200, centerLabel = 'verified' }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - 14;
  const inner  = radius * 0.62;
  const cx = size / 2, cy = size / 2;
  const ringR = (radius + inner) / 2;
  const stroke = radius - inner;
  const C = 2 * Math.PI * ringR;

  let cumulative = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="#f4f4f5" strokeWidth={stroke} />

      {total > 0 && data.map((d, i) => {
        if (d.value === 0) return null;
        const dashLen = (d.value / total) * C;
        const offset  = -(cumulative / total) * C;
        cumulative += d.value;
        return (
          <circle key={i}
            cx={cx} cy={cy} r={ringR}
            fill="none"
            stroke={d.color}
            strokeWidth={stroke}
            strokeDasharray={`${dashLen} ${C - dashLen}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 600ms ease, stroke-dashoffset 600ms ease' }}
          />
        );
      })}

      <text x={cx} y={cy - 2} textAnchor="middle"
            fill="#0a0a0a" fontSize={size / 7} fontWeight={600}
            style={{ fontFeatureSettings: '"tnum"' }}>
        {total.toLocaleString()}
      </text>
      <text x={cx} y={cy + size / 11} textAnchor="middle"
            fill="#71717a" fontSize={size / 18} letterSpacing="0.05em"
            style={{ textTransform: 'uppercase' }}>
        {centerLabel}
      </text>
    </svg>
  );
}
