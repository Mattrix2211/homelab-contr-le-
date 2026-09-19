import { Router } from "express";
import { z } from "zod";
import {
  createSnapshot,
  listDatasets,
  listDisks,
  listPools,
  listSnapshots,
  runScrub,
  runSmartTest,
  truenasAvailable,
} from "../integrations/truenas.js";
import { runAction } from "../engines/actions.js";

export const truenasRouter = Router();

truenasRouter.get("/available", (_req, res) => {
  res.json({ available: truenasAvailable() });
});

truenasRouter.get("/pools", async (_req, res) => {
  res.json({ pools: await listPools() });
});

truenasRouter.get("/datasets", async (_req, res) => {
  res.json({ datasets: await listDatasets() });
});

truenasRouter.get("/disks", async (_req, res) => {
  res.json({ disks: await listDisks() });
});

truenasRouter.get("/snapshots", async (_req, res) => {
  res.json({ snapshots: await listSnapshots() });
});

const createSnapshotSchema = z.object({
  dataset: z.string().min(1),
  name: z.string().min(1),
});

truenasRouter.post("/snapshots", async (req, res) => {
  const parsed = createSnapshotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });

  const { dataset, name } = parsed.data;
  try {
    await runAction(
      { userId: req.auth.user.id, userDisplayName: req.auth.user.display_name, userRole: req.auth.user.role },
      "truenas.snapshot-create",
      dataset,
      { name },
      () => createSnapshot(dataset, name)
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status ?? 502).json({ error: err.message ?? "action_failed" });
  }
});

const smartTestSchema = z.object({ type: z.enum(["SHORT", "LONG"]) });

truenasRouter.post("/disks/:name/smart-test", async (req, res) => {
  const parsed = smartTestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });

  const diskName = req.params.name;
  try {
    await runAction(
      { userId: req.auth.user.id, userDisplayName: req.auth.user.display_name, userRole: req.auth.user.role },
      "truenas.smart-test",
      diskName,
      { type: parsed.data.type },
      () => runSmartTest(diskName, parsed.data.type)
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status ?? 502).json({ error: err.message ?? "action_failed" });
  }
});

truenasRouter.post("/pools/:id/scrub", async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "unauthenticated" });
  const poolId = Number(req.params.id);
  if (!Number.isFinite(poolId)) return res.status(400).json({ error: "invalid_input" });

  try {
    await runAction(
      { userId: req.auth.user.id, userDisplayName: req.auth.user.display_name, userRole: req.auth.user.role },
      "truenas.scrub",
      `pool/${poolId}`,
      undefined,
      () => runScrub(poolId)
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status ?? 502).json({ error: err.message ?? "action_failed" });
  }
});
