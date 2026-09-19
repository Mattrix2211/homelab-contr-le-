import { useLinks } from "../api/hooks";

export function OpenLinkButton({ linkKey, label }: { linkKey: string; label: string }) {
  const { data } = useLinks();
  const url = data?.links?.[linkKey];
  if (!url) return null;
  return (
    <a className="btn btn--sm btn--ghost" href={url} target="_blank" rel="noreferrer">
      {label} ↗
    </a>
  );
}
