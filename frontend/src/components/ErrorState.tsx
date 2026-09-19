export function ErrorState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="error-state">
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{title}</div>
      {description && <div style={{ fontSize: 12.5 }}>{description}</div>}
    </div>
  );
}
