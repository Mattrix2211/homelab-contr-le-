import { useMemo, useState } from "react";
import { useEvents, useNotificationsLastSeen, useMarkNotificationsSeen } from "../api/hooks";
import { formatRelativeTime } from "../lib/format";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { data: eventsData } = useEvents(30);
  const { data: lastSeenData } = useNotificationsLastSeen();
  const markSeen = useMarkNotificationsSeen();

  const events = eventsData?.events ?? [];
  const lastSeenAt = lastSeenData?.lastSeenAt;

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) return events.length;
    const cutoff = new Date(lastSeenAt.endsWith("Z") ? lastSeenAt : `${lastSeenAt}Z`).getTime();
    return events.filter((e) => new Date(e.created_at.endsWith("Z") ? e.created_at : `${e.created_at}Z`).getTime() > cutoff).length;
  }, [events, lastSeenAt]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next && unreadCount > 0) markSeen.mutate();
      return next;
    });
  }

  return (
    <div style={{ position: "relative" }}>
      <button className="btn btn--ghost btn--sm" onClick={toggle} aria-label="Notifications">
        🔔{unreadCount > 0 && <span style={{ marginLeft: 4, color: "var(--color-amber)" }}>{unreadCount}</span>}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <div
            className="card"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: 340,
              maxHeight: 400,
              overflowY: "auto",
              zIndex: 91,
              padding: 8,
            }}
          >
            {events.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>Nothing yet</div>
            ) : (
              <div className="row-list">
                {events.slice(0, 20).map((e) => (
                  <div className="row" key={e.id}>
                    <span className="row__primary">
                      {e.message}
                      <div className="row__secondary">{formatRelativeTime(e.created_at)}</div>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
