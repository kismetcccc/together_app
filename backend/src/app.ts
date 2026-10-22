import Fastify from "fastify";
import { cloudLimits } from "./cloud-limits.js";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { join } from "node:path";
import { LocalDatabase, type Database } from "./database.js";
import { PostgresDatabase } from "./postgres.js";
import { loadConfig, type Config } from "./config.js";
import { createMailer, type Mailer } from "./mail.js";
import { createContext } from "./context.js";
import { ApiError, fail } from "./security.js";
import { passwordResetRoutes } from "./routes/password-reset.js";
import { authRoutes } from "./routes/auth.js";
import { albumRoutes } from "./routes/albums.js";
import { invitationRoutes } from "./routes/invitations.js";
export async function buildApp(
  options: { config?: Config; mailer?: Mailer; database?: Database } = {},
) {
  const config = options.config || loadConfig(),
    db =
      options.database ||
      (process.env.DATABASE_URL
        ? new PostgresDatabase(process.env.DATABASE_URL)
        : new LocalDatabase(join(config.dataDir, "together.sqlite")));
  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024,
    trustProxy: false,
  });
  await app.register(cookie);
  await app.register(cors, {
    origin: config.origin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, {
    global: config.rateLimit,
    max: 120,
    timeWindow: "1 minute",
  });
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer");
    const nativeRequest =
      req.headers["x-together-client"] === "native" &&
      !req.headers.origin &&
      !req.headers.cookie;
    if (
      ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
      !nativeRequest &&
      req.headers.origin !== config.origin
    )
      fail(403, "BAD_ORIGIN", "请求来源不被允许");
  });
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError)
      return reply.code(400).send({
        code: "VALIDATION",
        message: err.issues[0]?.message || "输入无效",
      });
    if (err instanceof ApiError)
      return reply
        .code(err.statusCode)
        .send({ code: err.code, message: err.message });
    const e = err as { statusCode?: number };
    if (e.statusCode === 429)
      return reply
        .code(429)
        .send({ code: "RATE_LIMIT", message: "操作过于频繁，请稍后重试" });
    if (e.statusCode === 413)
      return reply
        .code(413)
        .send({ code: "PAYLOAD_TOO_LARGE", message: "上传内容超过限制" });
    if (e.statusCode && e.statusCode < 500)
      return reply
        .code(e.statusCode)
        .send({ code: "BAD_REQUEST", message: "请求格式不正确" });
    console.error(
      "API failure",
      req.method,
      req.routeOptions.url,
      err instanceof Error ? err.name : "Error",
    );
    return reply
      .code(500)
      .send({ code: "INTERNAL_ERROR", message: "服务暂时不可用，请稍后重试" });
  });
  if (process.env.DATABASE_URL) cloudLimits(app, db);
  const c = createContext(db, config, options.mailer || createMailer(config));
  app.get("/health", async () => ({ status: "ok" }));
  await app.register(
    async (routes) => {
      await authRoutes(routes, c);
      await passwordResetRoutes(routes, c);
      await albumRoutes(routes, c);
      await invitationRoutes(routes, c);
    },
    { prefix: "/api/v1" },
  );
  app.addHook("onClose", async () => {
    await db.close();
  });
  return { app, db };
}
