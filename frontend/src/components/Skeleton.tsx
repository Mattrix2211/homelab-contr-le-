export function Skeleton({ height = 16, width = "100%" }: { height?: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} />;
}

export function SkeletonGrid({ count = 3, height = 140 }: { count?: number; height?: number }) {
  return (
    <div className="grid grid--hosts">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
}
