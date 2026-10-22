import type { FastifyReply, FastifyRequest } from "fastify";
import type { Database } from "./database.js";
import type { Config } from "./config.js";
import type { Mailer } from "./mail.js";
import { digest, fail, newToken } from "./security.js";
export const COOKIE = "together_session";
export function sessionToken(req: FastifyRequest) {
  if (req.headers.authorization !== undefined) {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
      req.headers.authorization,
    );
    return match?.[1];
  }
  return req.cookies[COOKIE];
}
export const mobileClient = (req: FastifyRequest) =>
  req.headers["x-together-client"] === "native";
export const publicUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  emailVerified: !!u.email_verified,
});
export function createContext(db: Database, config: Config, mail: Mailer) {
  const current = async (req: FastifyRequest) => {
    const t = sessionToken(req);
    return t
      ? await db.get(
          "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
          digest(t),
          Date.now(),
        )
      : undefined;
  };
  const user = async (req: FastifyRequest, verified = false) => {
    const u = await current(req);
    if (!u) fail(401, "UNAUTHENTICATED", "请先登录");
    if (verified && !u.email_verified)
      fail(403, "EMAIL_UNVERIFIED", "请先验证 QQ 邮箱");
    return u;
  };
  const access = async (
    req: FastifyRequest,
    id: string,
    write = false,
    owner = false,
  ) => {
    const u = await user(req, true);
    const a = await db.get(
      "SELECT a.*,m.role FROM albums a JOIN members m ON m.album_id=a.id WHERE a.id=? AND m.user_id=?",
      id,
      u.id,
    );
    if (!a) fail(404, "NOT_FOUND", "相册不存在或无权访问");
    if ((owner && a.role !== "owner") || (write && a.role === "viewer"))
      fail(403, "FORBIDDEN", "没有此操作的权限");
    return { u, a };
  };
  const session = async (
    req: FastifyRequest,
    reply: FastifyReply,
    id: string,
  ) => {
    if (sessionToken(req))
      await db.run(
        "DELETE FROM sessions WHERE token_hash=?",
        digest(sessionToken(req)!),
      );
    const token = newToken();
    await db.run("DELETE FROM sessions WHERE expires_at<=?", Date.now());
    await db.run(
      "INSERT INTO sessions VALUES(?,?,?)",
      digest(token),
      id,
      Date.now() + 7 * 86400000,
    );
    if (!mobileClient(req))
      reply.setCookie(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.production,
        path: "/",
        maxAge: 7 * 86400,
      });
    return mobileClient(req)
      ? { accessToken: token, expiresAt: Date.now() + 7 * 86400000 }
      : {};
  };
  return { db, config, mail, current, user, access, session };
}
export type Context = ReturnType<typeof createContext>;
