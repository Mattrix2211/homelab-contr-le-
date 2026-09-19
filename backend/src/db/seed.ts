import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./client.js";
import { env } from "../config/env.js";

export function seedAdmin() {
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(env.adminEmail);
  if (existing) return;

  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(env.adminPassword, 12);
  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, display_name)
     VALUES (?, ?, ?, 'admin', 'Admin')`
  ).run(id, env.adminEmail, passwordHash);

  // eslint-disable-next-line no-console
  console.log(`[db] seeded admin user ${env.adminEmail}`);
}
