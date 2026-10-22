import type { FastifyInstance } from "fastify";
import type { Database } from "./database.js";
import { digest, fail } from "./security.js";

export function cloudLimits(app: FastifyInstance, db: Database) {
  app.addHook("onRequest", async (req) => {
    const path = req.url.split("?")[0];
    const strict =
      path.includes("/auth/forgot-password") ||
      path.includes("/auth/resend-verification");
    const auth = path.includes("/auth/");
    const max = strict ? 3 : auth ? 8 : 120,
      windowMs = strict ? 300000 : 60000,
      now = Date.now();
    const key = digest(
      `${req.ip}:${strict ? path : auth ? "auth" : "general"}`,
    );
    const allowed = db.consumeRateLimit
      ? await db.consumeRateLimit(key, now, windowMs, max)
      : await db.transaction(async () => {
          await db.run("DELETE FROM rate_limits WHERE expires_at<=?", now);
          const row = await db.get(
            "SELECT count FROM rate_limits WHERE key=?",
            key,
          );
          if (row && row.count >= max) return false;
          if (row)
            await db.run(
              "UPDATE rate_limits SET count=count+1 WHERE key=?",
              key,
            );
          else
            await db.run(
              "INSERT INTO rate_limits VALUES(?,?,?)",
              key,
              1,
              now + windowMs,
            );
          return true;
        });
    if (!allowed) fail(429, "RATE_LIMIT", "操作过于频繁，请稍后重试");
  });
}
