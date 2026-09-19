import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { WebSocketServer, type WebSocket } from "ws";
import { env } from "../config/env.js";
import { sessionsRepo } from "../db/repo.js";
import type { Snapshot } from "../engines/monitoring.js";

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const match = header.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

export function createSnapshotBroadcaster(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<WebSocket>();

  // A ws 'error' event with no listener is rethrown as an uncaught
  // exception by Node's EventEmitter, which crashes the whole process - a
  // single flaky client connection (network drop, sleeping laptop, a proxy
  // sending ECONNRESET) must never be able to take down every connected
  // user. Both the server-level and per-client listeners below exist only
  // to swallow that event; cleanup still happens via 'close'.
  wss.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[ws] server error", err);
  });

  wss.on("connection", (ws, req) => {
    ws.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[ws] client error", err);
    });

    const token = parseCookie(req.headers.cookie, "hcc_session");
    let authenticated = false;
    if (token) {
      try {
        const claims = jwt.verify(token, env.jwtSecret) as { sid: string };
        const session = sessionsRepo.findById(claims.sid);
        authenticated = !!session && new Date(session.expires_at).getTime() > Date.now();
      } catch {
        authenticated = false;
      }
    }

    if (!authenticated) {
      ws.close(4001, "unauthenticated");
      return;
    }

    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  return {
    broadcast(snapshot: Snapshot) {
      const payload = JSON.stringify({ type: "snapshot", data: snapshot });
      for (const client of clients) {
        if (client.readyState !== client.OPEN) continue;
        client.send(payload, (err) => {
          if (err) {
            // eslint-disable-next-line no-console
            console.error("[ws] send failed", err);
          }
        });
      }
    },
  };
}
