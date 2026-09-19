import type { NextFunction, Request, Response } from "express";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "not_found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  // eslint-disable-next-line no-console
  console.error("[error]", req.method, req.path, err);
  const status = err?.status ?? 500;
  res.status(status).json({ error: err?.message ?? "internal_error" });
}
