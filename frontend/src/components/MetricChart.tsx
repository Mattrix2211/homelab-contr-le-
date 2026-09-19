interface Sample {
  t: number;
  v: number;
}

export function MetricChart({ samples, height = 220 }: { samples: Sample[]; height?: number }) {
  if (samples.length < 2) {
    return (
      <div className="empty-state" style={{ height }}>
        No data points for this range yet.
      </div>
    );
  }

  const width = 800;
  const values = samples.map((s) => s.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = samples.map((s, i) => {
    const x = (i / (samples.length - 1)) * width;
    const y = height - ((s.v - min) / range) * (height - 20) - 10;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const areaPath = `M0,${height} L${points.join(" L")} L${width},${height} Z`;
  const linePath = `M${points.join(" L")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-signal)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-signal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#chart-fill)" stroke="none" />
      <path d={linePath} fill="none" stroke="var(--color-signal)" strokeWidth={2} />
    </svg>
  );
}
