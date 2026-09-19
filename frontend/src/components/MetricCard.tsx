export function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "crit";
}) {
  return (
    <div className="metric-card">
      <span className="metric-card__label">{label}</span>
      <span className={`metric-card__value ${tone ?? ""}`}>{value}</span>
    </div>
  );
}
