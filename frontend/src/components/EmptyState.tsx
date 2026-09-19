export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="empty-state">
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-text-secondary)" }}>
        {title}
      </div>
      {description && <div style={{ fontSize: 12.5 }}>{description}</div>}
    </div>
  );
}
