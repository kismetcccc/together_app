import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type Context, publicUser } from "../context.js";
import { fail } from "../security.js";
import { date, draft, version } from "../validation.js";
const params = (req: any) =>
  z
    .object({ id: z.string().uuid(), pid: z.string().uuid().optional() })
    .parse(req.params);
export async function albumView(c: Context, id: string, userId: string) {
  const { db } = c,
    a = await db.get(
      "SELECT a.*,m.role FROM albums a JOIN members m ON a.id=m.album_id WHERE a.id=? AND m.user_id=?",
      id,
      userId,
    );
  if (!a) fail(404, "NOT_FOUND", "相册不存在或无权访问");
  const photos = (
    await db.all(
      "SELECT p.id,p.caption,p.date,p.version,u.name AS author,EXISTS(SELECT 1 FROM favorites f WHERE f.photo_id=p.id AND f.user_id=?) AS favorite FROM photos p JOIN users u ON u.id=p.author_id WHERE p.album_id=? ORDER BY p.created_at DESC,p.id",
      userId,
      id,
    )
  ).map((p) => ({
    ...p,
    favorite: !!p.favorite,
    url: `/api/v1/albums/${id}/photos/${p.id}/content`,
  }));
  const members = await db.all(
    "SELECT u.id,u.name,u.email,m.role FROM members m JOIN users u ON m.user_id=u.id WHERE m.album_id=? ORDER BY m.role='owner' DESC",
    id,
  );
  if (a.role === "owner")
    for (const i of await db.all(
      "SELECT * FROM invitations WHERE album_id=? AND status='pending' AND expires_at>?",
      id,
      Date.now(),
    ))
      members.push({
        id: i.id,
        name: i.email.split("@")[0],
        email: i.email,
        role: i.role,
        pending: true,
      });
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    category: a.category,
    version: a.version,
    updatedAt: a.updated_at,
    role: a.role,
    cover: photos[0]?.url || "",
    photos,
    members,
  };
}
export async function albumRoutes(app: FastifyInstance, c: Context) {
  const { db } = c;
  const touch = async (id: string) =>
    await db.run(
      "UPDATE albums SET updated_at=?,version=version+1 WHERE id=?",
      new Date().toISOString(),
      id,
    );
  app.get("/workspace", async (req) => {
    const u = await c.current(req);
    if (!u)
      return {
        user: null,
        albums: [],
        anniversaries: [],
        mailDelivery: c.config.mailTransport,
      };
    return {
      user: publicUser(u),
      mailDelivery: c.config.mailTransport,
      albums: await Promise.all(
        (
          await db.all("SELECT album_id FROM members WHERE user_id=?", u.id)
        ).map(async (m) => await albumView(c, m.album_id, u.id)),
      ),
      anniversaries: await db.all(
        "SELECT id,title,date,emoji FROM anniversaries WHERE user_id=?",
        u.id,
      ),
    };
  });
  app.post("/albums", async (req, reply) => {
    const u = await c.user(req, true),
      body = draft.strict().parse(req.body),
      id = randomUUID();
    await db.transaction(async () => {
      await db.run(
        "INSERT INTO albums VALUES(?,?,?,?,?,?,1)",
        id,
        body.title,
        body.description,
        body.category,
        u.id,
        new Date().toISOString(),
      );
      await db.run("INSERT INTO members VALUES(?,?,?)", id, u.id, "owner");
    });
    reply.code(201);
    return await albumView(c, id, u.id);
  });
  app.get("/albums/:id", async (req) => {
    const { id } = params(req);
    const { u } = await c.access(req, id);
    return await albumView(c, id, u.id);
  });
  app.patch("/albums/:id", async (req, reply) => {
    const { id } = params(req);
    await c.access(req, id, true);
    const body = draft.extend({ version }).strict().parse(req.body);
    const result = await db.run(
      "UPDATE albums SET title=?,description=?,category=?,updated_at=?,version=version+1 WHERE id=? AND version=?",
      body.title,
      body.description,
      body.category,
      new Date().toISOString(),
      id,
      body.version,
    );
    if (!result.changes)
      fail(
        409,
        "EDIT_CONFLICT",
        "相册已被其他成员更新。请保留你的输入，刷新后重新编辑。",
      );
    reply.code(204).send();
  });
  app.post(
    "/albums/:id/photos",
    { bodyLimit: 20 * 1024 * 1024 },
    async (req, reply) => {
      const { id } = params(req);
      const { u, a } = await c.access(req, id, true);
      const body = z
        .object({
          photos: z
            .array(
              z
                .object({
                  url: z.string().max(4 * 1024 * 1024),
                  caption: z.string().max(200),
                  date,
                })
                .strip(),
            )
            .min(1)
            .max(8),
        })
        .strict()
        .parse(req.body);
      const prepared = body.photos.map((p) => {
        const match =
          /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
            p.url,
          );
        if (!match) fail(400, "INVALID_IMAGE", "仅支持 JPG、PNG、WebP 图片");
        const bytes = Buffer.from(match![2], "base64"),
          kind = match![1];
        const valid =
          kind === "jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : kind === "png"
              ? bytes
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              : bytes.subarray(0, 4).toString() === "RIFF" &&
                bytes.subarray(8, 12).toString() === "WEBP";
        if (!valid || bytes.length > 3 * 1024 * 1024 || bytes.length < 12)
          fail(400, "INVALID_IMAGE", "图片格式错误或压缩后超过 3 MB");
        return { ...p, bytes, mime: `image/${kind}` };
      });
      await db.transaction(async () => {
        if (
          (
            await db.get(
              "SELECT COUNT(*) AS n FROM photos WHERE album_id=?",
              id,
            )
          ).n +
            prepared.length >
          100
        )
          fail(413, "QUOTA", "每个相册最多 100 张照片");
        if (
          process.env.DATABASE_URL &&
          (
            await db.get(
              "SELECT COALESCE(SUM(length(bytes)),0) AS size FROM photos",
            )
          ).size +
            prepared.reduce((n, p) => n + p.bytes.length, 0) >
            200 * 1024 * 1024
        )
          fail(413, "QUOTA", "好友测试版总照片容量已满（200 MB）");
        const used = (
          await db.get(
            "SELECT COALESCE(SUM(length(p.bytes)),0) AS size FROM photos p JOIN albums a ON a.id=p.album_id WHERE a.owner_id=?",
            a.owner_id,
          )
        ).size;
        if (
          used + prepared.reduce((n, p) => n + p.bytes.length, 0) >
          100 * 1024 * 1024
        )
          fail(413, "QUOTA", "相册所有者的存储配额已满（100 MB）");
        for (const p of prepared)
          await db.run(
            "INSERT INTO photos VALUES(?,?,?,?,?,?,?,1,?)",
            randomUUID(),
            id,
            u.id,
            p.caption,
            p.date,
            p.mime,
            p.bytes,
            new Date().toISOString(),
          );
        await touch(id);
      });
      reply.code(201).send({ created: prepared.length });
    },
  );
  app.get("/albums/:id/photos/:pid/content", async (req, reply) => {
    const { id, pid } = params(req);
    await c.access(req, id);
    const p = await db.get(
      "SELECT mime,bytes FROM photos WHERE id=? AND album_id=?",
      pid!,
      id,
    );
    if (!p) fail(404, "NOT_FOUND", "照片不存在");
    reply
      .header("Cache-Control", "private, no-store")
      .header("Content-Disposition", "inline")
      .type(p.mime)
      .send(Buffer.from(p.bytes));
  });
  app.patch("/albums/:id/photos/:pid", async (req, reply) => {
    const { id, pid } = params(req);
    const body = z
      .object({
        caption: z.string().max(200).optional(),
        favorite: z.boolean().optional(),
        version: version.optional(),
      })
      .strict()
      .refine((b) => b.caption !== undefined || b.favorite !== undefined)
      .parse(req.body);
    const { u } = await c.access(req, id, body.caption !== undefined);
    await db.transaction(async () => {
      const p = await db.get(
        "SELECT id,version FROM photos WHERE id=? AND album_id=?",
        pid!,
        id,
      );
      if (!p) fail(404, "NOT_FOUND", "照片不存在");
      if (body.caption !== undefined) {
        if (body.version !== p.version)
          fail(409, "EDIT_CONFLICT", "照片描述已更新，请刷新后重试");
        await db.run(
          "UPDATE photos SET caption=?,version=version+1 WHERE id=?",
          body.caption,
          pid!,
        );
        await touch(id);
      }
      if (body.favorite !== undefined) {
        if (body.favorite)
          await db.run(
            "INSERT OR IGNORE INTO favorites VALUES(?,?)",
            pid!,
            u.id,
          );
        else
          await db.run(
            "DELETE FROM favorites WHERE photo_id=? AND user_id=?",
            pid!,
            u.id,
          );
      }
    });
    reply.code(204).send();
  });
  app.delete("/albums/:id/photos/:pid", async (req, reply) => {
    const { id, pid } = params(req);
    await c.access(req, id, true);
    const body = z.object({ version }).strict().parse(req.body);
    await db.transaction(async () => {
      const p = await db.get(
        "SELECT version FROM photos WHERE id=? AND album_id=?",
        pid!,
        id,
      );
      if (!p) fail(404, "NOT_FOUND", "照片不存在");
      if (p.version !== body.version)
        fail(409, "EDIT_CONFLICT", "照片已更新，请刷新后重试");
      await db.run("DELETE FROM photos WHERE id=?", pid!);
      await touch(id);
    });
    reply.code(204).send();
  });
  app.post("/anniversaries", async (req, reply) => {
    const u = await c.user(req, true);
    const b = z
      .object({
        title: z.string().trim().min(1).max(40),
        date,
        emoji: z.enum(["♡", "✦", "↗"]),
      })
      .strict()
      .parse(req.body);
    await db.run(
      "INSERT INTO anniversaries VALUES(?,?,?,?,?)",
      randomUUID(),
      u.id,
      b.title,
      b.date,
      b.emoji,
    );
    reply.code(201).send({ created: true });
  });
  app.delete("/anniversaries/:id", async (req, reply) => {
    const u = await c.user(req, true),
      { id } = params(req);
    if (
      !(
        await db.run(
          "DELETE FROM anniversaries WHERE id=? AND user_id=?",
          id,
          u.id,
        )
      ).changes
    )
      fail(404, "NOT_FOUND", "纪念日不存在");
    reply.code(204).send();
  });
}
