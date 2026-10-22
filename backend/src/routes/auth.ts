import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { type Context, COOKIE, publicUser, sessionToken } from "../context.js";
import {
  digest,
  fail,
  hashPassword,
  newToken,
  verifyPassword,
} from "../security.js";
import { password, qqEmail, tokenBody } from "../validation.js";
export async function authRoutes(app: FastifyInstance, c: Context) {
  const { db, config } = c;
  const dummy = await hashPassword(newToken());
  const limited = { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } };
  async function verification(u: any) {
    const token = newToken();
    // Re-send does not invalidate the previous valid mail if delivery fails.
    await db.run(
      "INSERT INTO verifications VALUES(?,?,?)",
      digest(token),
      u.id,
      Date.now() + 86400000,
    );
    try {
      await c.mail({
        to: u.email,
        kind: "verification",
        subject: "同频 · 验证你的 QQ 邮箱",
        text: `请打开以下链接并确认验证（24 小时内有效）：\n${config.origin}/#/verify/${token}\n如果不是你注册，请忽略此邮件。`,
      });
    } catch {
      await db.run(
        "DELETE FROM verifications WHERE token_hash=?",
        digest(token),
      );
      fail(503, "MAIL_UNAVAILABLE", "验证邮件暂时无法投递，请登录后重新发送");
    }
  }
  app.post("/auth/register", limited, async (req, reply) => {
    const body = z
      .object({
        email: qqEmail,
        password,
        name: z.string().trim().min(1).max(24),
      })
      .strict()
      .parse(req.body);
    if (await db.get("SELECT id FROM users WHERE email=?", body.email))
      fail(409, "EMAIL_EXISTS", "该 QQ 邮箱已注册，请直接登录");
    const hash = await hashPassword(body.password),
      id = randomUUID();
    try {
      await db.run(
        "INSERT INTO users VALUES(?,?,?,?,0,?)",
        id,
        body.email,
        body.name,
        hash,
        new Date().toISOString(),
      );
    } catch (e) {
      if (await db.get("SELECT id FROM users WHERE email=?", body.email))
        fail(409, "EMAIL_EXISTS", "该 QQ 邮箱已注册");
      throw e;
    }
    const u = await db.get("SELECT * FROM users WHERE id=?", id);
    const credentials = await c.session(req, reply, id);
    try {
      await verification(u);
    } catch {
      reply.code(201);
      return { ...publicUser(u), ...credentials, mailDelivery: "failed" };
    }
    reply.code(201);
    return {
      ...publicUser(u),
      ...credentials,
      mailDelivery: config.mailTransport,
    };
  });
  app.post("/auth/login", limited, async (req, reply) => {
    const body = z
      .object({ email: qqEmail, password })
      .strict()
      .parse(req.body);
    const u = await db.get("SELECT * FROM users WHERE email=?", body.email);
    const valid = await verifyPassword(
      body.password,
      u?.password_hash || dummy,
    );
    if (!u || !valid) fail(401, "INVALID_CREDENTIALS", "邮箱或密码不正确");
    const credentials = await c.session(req, reply, u.id);
    return { ...publicUser(u), ...credentials };
  });
  app.post("/auth/logout", async (req, reply) => {
    const t = sessionToken(req);
    if (t) await db.run("DELETE FROM sessions WHERE token_hash=?", digest(t));
    reply
      .clearCookie(COOKIE, {
        path: "/",
        secure: config.production,
        httpOnly: true,
        sameSite: "lax",
      })
      .code(204)
      .send();
  });
  app.post("/auth/verify-email", limited, async (req) => {
    const { token } = tokenBody.parse(req.body);
    const hash = digest(token);
    await db.transaction(async () => {
      const row = await db.get(
        "SELECT * FROM verifications WHERE token_hash=? AND expires_at>?",
        hash,
        Date.now(),
      );
      if (!row)
        fail(410, "TOKEN_EXPIRED", "验证链接已失效，请重新发送验证邮件");
      await db.run("UPDATE users SET email_verified=1 WHERE id=?", row.user_id);
      await db.run("DELETE FROM verifications WHERE user_id=?", row.user_id);
    });
    return { verified: true };
  });
  app.post(
    "/auth/resend-verification",
    { config: { rateLimit: { max: 3, timeWindow: "5 minutes" } } },
    async (req) => {
      const u = await c.user(req);
      if (!u.email_verified) await verification(u);
      return { delivery: config.mailTransport };
    },
  );
}
