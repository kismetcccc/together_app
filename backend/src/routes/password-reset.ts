import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { type Context, COOKIE } from "../context.js";
import { digest, fail, hashPassword, newToken } from "../security.js";
import { password, qqEmail, tokenBody } from "../validation.js";
export async function passwordResetRoutes(app: FastifyInstance, c: Context) {
  const { db, config } = c;
  app.post(
    "/auth/forgot-password",
    { config: { rateLimit: { max: 3, timeWindow: "5 minutes" } } },
    async (req) => {
      const { email } = z.object({ email: qqEmail }).strict().parse(req.body);
      const result = {
        message:
          "如果该邮箱已注册，我们会发送重置邮件。请检查收件箱和垃圾邮件，稍后再重试。",
      };
      const user = await db.get("SELECT id FROM users WHERE email=?", email);
      if (!user) return result;
      const now = Date.now();
      await db.run("DELETE FROM password_resets WHERE expires_at<=?", now);
      if (
        await db.get(
          "SELECT token_hash FROM password_resets WHERE user_id=? AND created_at>?",
          user.id,
          now - 60000,
        )
      )
        return result;
      const token = newToken();
      await db.run(
        "INSERT INTO password_resets VALUES(?,?,?,?)",
        digest(token),
        user.id,
        now + 1800000,
        now,
      );
      try {
        await c.mail({
          to: email,
          kind: "password-reset",
          subject: "同频 · 重置网站密码",
          text: `请在 30 分钟内打开以下链接，自行设置新的本站密码：\n${config.origin}/#/reset/${token}\n重置成功后会确认邮箱归属并退出所有旧登录，账号和相册数据会保留。\n如果不是你申请的，请忽略此邮件，原密码不会改变。`,
        });
      } catch {
        await db.run(
          "DELETE FROM password_resets WHERE token_hash=?",
          digest(token),
        );
        console.error("Password reset mail delivery failed");
      }
      return result;
    },
  );
  app.post(
    "/auth/reset-password",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = tokenBody.extend({ password }).parse(req.body);
      const tokenHash = digest(body.token);
      if (
        !(await db.get(
          "SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at>?",
          tokenHash,
          Date.now(),
        ))
      )
        fail(410, "TOKEN_EXPIRED", "重置链接已失效，请重新申请");
      const hash = await hashPassword(body.password);
      await db.transaction(async () => {
        // Recheck after asynchronous hashing: only one concurrent request may consume the token.
        const row = await db.get(
          "SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at>?",
          tokenHash,
          Date.now(),
        );
        if (!row) fail(410, "TOKEN_EXPIRED", "重置链接已失效，请重新申请");
        await db.run(
          "UPDATE users SET password_hash=?,email_verified=1 WHERE id=?",
          hash,
          row.user_id,
        );
        await db.run("DELETE FROM sessions WHERE user_id=?", row.user_id);
        await db.run("DELETE FROM verifications WHERE user_id=?", row.user_id);
        await db.run(
          "DELETE FROM password_resets WHERE user_id=?",
          row.user_id,
        );
      });
      reply.clearCookie(COOKIE, {
        path: "/",
        secure: config.production,
        httpOnly: true,
        sameSite: "lax",
      });
      return { message: "密码已重置，邮箱已验证。请使用新密码登录。" };
    },
  );
}
