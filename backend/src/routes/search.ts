import { Router } from "express";
import { getSnapshot } from "../engines/monitoring.js";

export const searchRouter = Router();

const PAGES = [
  { id: "cockpit", label: "Cockpit", path: "/" },
  { id: "infrastructure", label: "Infrastructure", path: "/infrastructure" },
  { id: "services", label: "Services", path: "/services" },
  { id: "storage", label: "Stockage", path: "/storage" },
  { id: "network", label: "Réseau", path: "/network" },
  { id: "homeassistant", label: "Home Assistant", path: "/home-assistant" },
  { id: "monitoring", label: "Supervision", path: "/monitoring" },
  { id: "events", label: "Événements", path: "/events" },
  { id: "administration", label: "Administration", path: "/administration" },
  { id: "settings", label: "Paramètres", path: "/parametres" },
];

searchRouter.get("/", (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (!q) return res.json({ hosts: [], services: [], containers: [], pages: [] });

  const snapshot = getSnapshot();
  const hosts = snapshot.hosts.filter(
    (h) => h.name.toLowerCase().includes(q) || h.ip.toLowerCase().includes(q)
  );
  const services = snapshot.services.filter((s) => s.name.toLowerCase().includes(q));
  const containers = snapshot.containers.filter(
    (c) => c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q) || c.ports.some((p) => p.includes(q))
  );
  const pages = PAGES.filter((p) => p.label.toLowerCase().includes(q));

  res.json({ hosts, services, containers, pages });
});
