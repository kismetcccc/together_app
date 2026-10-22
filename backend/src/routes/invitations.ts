import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Context } from "../context.js";
import { digest, fail, newToken } from "../security.js";
import { qqEmail, tokenBody } from "../validation.js";
export async function invitationRoutes(app: FastifyInstance, c: Context) {
  const { db } = c;
  app.post(
    "/albums/:id/invitations",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const { a } = await c.access(req, id, false, true);
      const b = z
        .object({ email: qqEmail, role: z.enum(["editor", "viewer"]) })
        .strict()
        .parse(req.body);
      const token = newToken(),
        iid = randomUUID(),
        expires = Date.now() + 7 * 86400000;
      await db.transaction(async () => {
        await db.run(
          "UPDATE invitations SET status='expired' WHERE status='pending' AND expires_at<=?",
          Date.now(),
        );
        if (
          (await db.get(
            "SELECT 1 FROM members m JOIN users u ON u.id=m.user_id WHERE m.album_id=? AND u.email=?",
            id,
            b.email,
          )) ||
          (await db.get(
            "SELECT 1 FROM invitations WHERE album_id=? AND email=? AND status='pending'",
            id,
            b.email,
          ))
        )
          fail(409, "ALREADY_INVITED", "该好友已是成员或有待接受邀请");
        await db.run(
          "INSERT INTO invitations VALUES(?,?,?,?,?,?,?,?)",
          iid,
          id,
          b.email,
          b.role,
          digest(token),
          "pending",
          expires,
          new Date().toISOString(),
        );
      });
      const inviteUrl = `${c.config.origin}/#/invite/${token}`;
      try {
        await c.mail({
          kind: "invitation",
          to: b.email,
          subject: "同频 · 你收到了一份相册邀请",
          text: `邀请你加入「${a.title}」，权限：${b.role === "editor" ? "共同编辑" : "仅查看"}。\n请使用 ${b.email} 注册并验证邮箱后接受邀请（7 天内有效）：\n${inviteUrl}`,
        });
      } catch {
        await db.run("UPDATE invitations SET status='revoked' WHERE id=?", iid);
        fail(
          503,
          "MAIL_UNAVAILABLE",
          "邀请邮件投递失败，未开通权限，请稍后重试",
        );
      }
      reply.code(201);
      return {
        id: iid,
        inviteUrl,
        delivery: c.config.mailTransport,
        expiresAt: new Date(expires).toISOString(),
      };
    },
  );
  app.post("/invitations/accept", async (req) => {
    const { token } = tokenBody.parse(req.body),
      u = await c.user(req, true);
    return await db.transaction(async () => {
      const i = await db.get(
        "SELECT * FROM invitations WHERE token_hash=?",
        digest(token),
      );
      if (!i || i.status !== "pending" || i.expires_at <= Date.now())
        fail(410, "INVITATION_EXPIRED", "邀请已使用、撤销或过期");
      if (i.email !== u.email)
        fail(403, "WRONG_RECIPIENT", "请使用收到邀请的 QQ 邮箱登录");
      await db.run(
        "INSERT INTO members VALUES(?,?,?) ON CONFLICT(album_id,user_id) DO NOTHING",
        i.album_id,
        u.id,
        i.role,
      );
      await db.run(
        "UPDATE invitations SET status='accepted' WHERE id=? AND status='pending'",
        i.id,
      );
      return { albumId: i.album_id };
    });
  });
  app.delete("/albums/:id/members/:mid", async (req, reply) => {
    const { id, mid } = z
      .object({ id: z.string().uuid(), mid: z.string().uuid() })
      .parse(req.params);
    await c.access(req, id, false, true);
    await db.transaction(async () => {
      const member = await db.get(
        "SELECT role FROM members WHERE album_id=? AND user_id=?",
        id,
        mid,
      );
      if (member?.role === "owner")
        fail(403, "OWNER_REQUIRED", "不能移除相册所有者");
      if (member) {
        await db.run(
          "DELETE FROM members WHERE album_id=? AND user_id=?",
          id,
          mid,
        );
        await db.run(
          "DELETE FROM favorites WHERE user_id=? AND photo_id IN (SELECT id FROM photos WHERE album_id=?)",
          mid,
          id,
        );
      } else if (
        !(
          await db.run(
            "UPDATE invitations SET status='revoked' WHERE album_id=? AND id=? AND status='pending'",
            id,
            mid,
          )
        ).changes
      )
        fail(404, "NOT_FOUND", "成员或邀请不存在");
    });
    reply.code(204).send();
  });
}
