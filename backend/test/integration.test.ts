import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildApp } from "../src/app.js";
import { testPostgres } from "./pglite-store.js";
import type { Mail } from "../src/mail.js";
import type { Config } from "../src/config.js";
import { digest } from "../src/security.js";
const origin = "http://127.0.0.1:5173",
  password = "Local-test-password-2026";
const draft = {
  title: "一起看海",
  description: "我们的故事",
  category: "情侣",
};
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xkAAAAASUVORK5CYII=";
test("password recovery preserves albums, consumes tokens once and revokes old sessions", async (t) => {
  const f = await fixture(t),
    a = await f.account("reset@qq.com");
  const album = (await f.request("POST", "/albums", draft, a.cookie)).json();
  await f.request(
    "POST",
    `/albums/${album.id}/photos`,
    { photos: [{ url: png, caption: "保留照片", date: "2026-10-21" }] },
    a.cookie,
  );
  const before = (
    await f.request("GET", "/workspace", undefined, a.cookie)
  ).json();
  const unknown = await f.request("POST", "/auth/forgot-password", {
    email: "missing@qq.com",
  });
  const sent = await f.request("POST", "/auth/forgot-password", {
    email: "reset@qq.com",
  });
  assert.equal(sent.statusCode, 200);
  assert.deepEqual(sent.json(), unknown.json());
  const token = f.mails.at(-1)!.text.match(/#\/reset\/([\w-]{43})/)![1];
  assert.equal(
    (await f.db.get("SELECT token_hash FROM password_resets")).token_hash,
    digest(token),
  );
  await f.request("POST", "/auth/forgot-password", { email: "reset@qq.com" });
  assert.equal(f.mails.filter((m) => m.kind === "password-reset").length, 1);
  assert.equal(
    (
      await f.request("POST", "/auth/reset-password", {
        token,
        password: "short",
      })
    ).statusCode,
    400,
  );
  const changed = "New-test-password-2026";
  const attempts = await Promise.all(
    [1, 2].map(() =>
      f.request("POST", "/auth/reset-password", { token, password: changed }),
    ),
  );
  assert.deepEqual(attempts.map((r) => r.statusCode).sort(), [200, 410]);
  assert.equal(
    (await f.request("GET", "/workspace", undefined, a.cookie)).json().user,
    null,
  );
  assert.equal(
    (
      await f.request("POST", "/auth/login", {
        email: "reset@qq.com",
        password,
      })
    ).statusCode,
    401,
  );
  const login = await f.request("POST", "/auth/login", {
    email: "reset@qq.com",
    password: changed,
  });
  assert.equal(login.statusCode, 200);
  assert.equal(login.json().id, a.user.id);
  const after = (
    await f.request(
      "GET",
      "/workspace",
      undefined,
      String(login.headers["set-cookie"]).split(";")[0],
    )
  ).json();
  assert.deepEqual(after.albums, before.albums);
});
test("expired and failed reset mail cannot change password; unverified user can recover", async (t) => {
  const f = await fixture(t),
    a = await f.account("unverified@qq.com", false);
  await f.request("POST", "/auth/forgot-password", {
    email: "unverified@qq.com",
  });
  const token = f.mails.at(-1)!.text.match(/#\/reset\/([\w-]{43})/)![1];
  await f.db.run("UPDATE password_resets SET expires_at=0");
  assert.equal(
    (
      await f.request("POST", "/auth/reset-password", {
        token,
        password: "New-password-2026",
      })
    ).statusCode,
    410,
  );
  await f.request("POST", "/auth/forgot-password", {
    email: "unverified@qq.com",
  });
  const next = f.mails.at(-1)!.text.match(/#\/reset\/([\w-]{43})/)![1];
  assert.equal(
    (
      await f.request("POST", "/auth/reset-password", {
        token: next,
        password: "New-password-2026",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await f.db.get("SELECT email_verified FROM users WHERE id=?", a.user.id))
      .email_verified,
    1,
  );
  f.failMail();
  assert.equal(
    (
      await f.request("POST", "/auth/forgot-password", {
        email: "unverified@qq.com",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await f.db.get("SELECT COUNT(*) AS n FROM password_resets")).n,
    0,
  );
});
async function fixture(t: any) {
  const dir = mkdtempSync(join(tmpdir(), "together-api-test-"));
  const mails: Mail[] = [];
  let rejectMail = false;
  const config: Config = {
    dataDir: dir,
    origin,
    production: false,
    mailTransport: "file",
    mailFrom: "test@qq.com",
    smtpPort: 587,
    smtpSecure: false,
    rateLimit: false,
  };
  const { app, db } = await buildApp({
    config,
    database:
      process.env.TEST_DATABASE === "postgres"
        ? await testPostgres()
        : undefined,
    mailer: async (mail) => {
      if (rejectMail) throw Error("SMTP down");
      mails.push(mail);
    },
  });
  const request = async (
    method: string,
    path: string,
    body?: any,
    cookie?: string,
    extra: Record<string, string> = {},
  ) =>
    app.inject({
      method: method as any,
      url: "/api/v1" + path,
      headers: { origin, ...(cookie ? { cookie } : {}), ...extra },
      ...(body !== undefined ? { payload: body } : {}),
    });
  const mailToken = (email: string, kind: string) =>
    mails
      .filter((m) => m.to === email && m.kind === kind)
      .at(-1)!
      .text.match(/#\/(?:verify|invite)\/([\w-]{43})/)![1];
  const account = async (email: string, verify = true) => {
    const r = await request("POST", "/auth/register", {
      email,
      password,
      name: email.split("@")[0],
    });
    assert.equal(r.statusCode, 201, r.body);
    const cookie = String(r.headers["set-cookie"]).split(";")[0];
    if (verify) {
      const v = await request(
        "POST",
        "/auth/verify-email",
        { token: mailToken(email, "verification") },
        cookie,
      );
      assert.equal(v.statusCode, 200, v.body);
    }
    return { cookie, user: r.json() };
  };
  t.after(async () => {
    await app.close(); // Cleanup only the directory created by this fixture.
    assert.equal(dir.startsWith(join(tmpdir(), "together-api-test-")), true);
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    app,
    db,
    request,
    account,
    mails,
    mailToken,
    config,
    failMail: () => {
      rejectMail = true;
    },
  };
}
test("QQ-only registration, real password verification, cookie flags and logout invalidation", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (
      await f.request("POST", "/auth/register", {
        email: "someone@example.com",
        password,
        name: "甲",
      })
    ).statusCode,
    400,
  );
  const { cookie, user } = await f.account("owner@qq.com");
  const stored = (
    await f.db.get("SELECT password_hash FROM users WHERE id=?", user.id)
  ).password_hash;
  assert.ok(stored.startsWith("scrypt$"));
  assert.ok(!stored.includes(password));
  assert.equal(
    (
      await f.request("POST", "/auth/register", {
        email: "OWNER@qq.com",
        password,
        name: "甲",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await f.request("POST", "/auth/login", {
        email: "owner@qq.com",
        password: "incorrect-password",
      })
    ).statusCode,
    401,
  );
  const login = await f.request(
    "POST",
    "/auth/login",
    { email: "owner@qq.com", password },
    cookie,
  );
  assert.equal(login.statusCode, 200);
  assert.match(String(login.headers["set-cookie"]), /HttpOnly/);
  assert.match(String(login.headers["set-cookie"]), /SameSite=Lax/);
  assert.equal(
    (await f.request("GET", "/workspace", undefined, cookie)).json().user,
    null,
  );
  const fresh = String(login.headers["set-cookie"]).split(";")[0];
  assert.equal(
    (await f.request("GET", "/workspace", undefined, fresh)).json().user.id,
    user.id,
  );
  assert.equal(
    (await f.request("POST", "/auth/logout", undefined, fresh)).statusCode,
    204,
  );
  assert.equal(
    (await f.request("GET", "/workspace", undefined, fresh)).json().user,
    null,
  );
});
test("unverified email blocked; verification token is expiring and single use", async (t) => {
  const f = await fixture(t),
    a = await f.account("new@qq.com", false),
    token = f.mailToken("new@qq.com", "verification");
  assert.equal(
    (await f.request("POST", "/albums", draft, a.cookie)).statusCode,
    403,
  );
  await f.db.run("UPDATE verifications SET expires_at=0");
  assert.equal(
    (await f.request("POST", "/auth/verify-email", { token }, a.cookie))
      .statusCode,
    410,
  );
  assert.equal(
    (await f.request("POST", "/auth/resend-verification", {}, a.cookie))
      .statusCode,
    200,
  );
  const next = f.mailToken("new@qq.com", "verification");
  assert.notEqual(next, token);
  assert.equal(
    (await f.request("POST", "/auth/verify-email", { token: next }, a.cookie))
      .statusCode,
    200,
  );
  assert.equal(
    (await f.request("POST", "/auth/verify-email", { token: next }, a.cookie))
      .statusCode,
    410,
  );
  assert.equal(
    (await f.request("POST", "/albums", draft, a.cookie)).statusCode,
    201,
  );
});
test("two-account sharing: invitation acceptance, editor changes, viewer restrictions, private photos and removal", async (t) => {
  const f = await fixture(t),
    owner = await f.account("a@qq.com"),
    editor = await f.account("b@qq.com"),
    viewer = await f.account("c@qq.com"),
    outsider = await f.account("d@qq.com");
  const created = await f.request("POST", "/albums", draft, owner.cookie);
  assert.equal(created.statusCode, 201, created.body);
  const a = created.json();
  assert.deepEqual(
    (await f.request("GET", "/workspace", undefined, editor.cookie)).json()
      .albums,
    [],
  );
  const invitation = await f.request(
    "POST",
    `/albums/${a.id}/invitations`,
    { email: "b@qq.com", role: "editor" },
    owner.cookie,
  );
  assert.equal(invitation.statusCode, 201, invitation.body);
  const token = f.mailToken("b@qq.com", "invitation");
  assert.equal(
    (await f.db.get("SELECT token_hash FROM invitations")).token_hash,
    digest(token),
  );
  assert.equal(
    (
      await f.request(
        "POST",
        `/albums/${a.id}/invitations`,
        { email: "B@qq.com", role: "viewer" },
        owner.cookie,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (await f.request("POST", "/invitations/accept", { token }, outsider.cookie))
      .statusCode,
    403,
  );
  assert.equal(
    (await f.request("POST", "/invitations/accept", { token }, editor.cookie))
      .statusCode,
    200,
  );
  assert.equal(
    (await f.request("POST", "/invitations/accept", { token }, editor.cookie))
      .statusCode,
    410,
  );
  assert.equal(
    (
      await f.request(
        "POST",
        `/albums/${a.id}/invitations`,
        { email: "c@qq.com", role: "viewer" },
        editor.cookie,
      )
    ).statusCode,
    403,
  );
  await f.request(
    "POST",
    `/albums/${a.id}/invitations`,
    { email: "c@qq.com", role: "viewer" },
    owner.cookie,
  );
  assert.equal(
    (
      await f.request(
        "POST",
        "/invitations/accept",
        { token: f.mailToken("c@qq.com", "invitation") },
        viewer.cookie,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await f.request(
        "PATCH",
        `/albums/${a.id}`,
        { ...draft, title: "一起改好的相册", version: a.version },
        editor.cookie,
      )
    ).statusCode,
    204,
  );
  assert.equal(
    (
      await f.request(
        "PATCH",
        `/albums/${a.id}`,
        { ...draft, version: a.version },
        owner.cookie,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await f.request(
        "PATCH",
        `/albums/${a.id}`,
        { ...draft, version: a.version },
        viewer.cookie,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await f.request("GET", "/workspace", undefined, owner.cookie)).json()
      .albums[0].title,
    "一起改好的相册",
  );
  const photo = { url: png, caption: "海边", date: "2026-10-21" };
  assert.equal(
    (
      await f.request(
        "POST",
        `/albums/${a.id}/photos`,
        { photos: [photo] },
        editor.cookie,
      )
    ).statusCode,
    201,
  );
  const p = (
    await f.request("GET", "/workspace", undefined, owner.cookie)
  ).json().albums[0].photos[0];
  assert.equal(
    (
      await f.request(
        "GET",
        p.url.replace("/api/v1", ""),
        undefined,
        outsider.cookie,
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await f.request(
        "GET",
        p.url.replace("/api/v1", ""),
        undefined,
        viewer.cookie,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await f.request(
        "PATCH",
        `/albums/${a.id}/photos/${p.id}`,
        { caption: "不允许", version: p.version },
        viewer.cookie,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await f.request(
        "PATCH",
        `/albums/${a.id}/photos/${p.id}`,
        { caption: "共同编辑", version: p.version },
        editor.cookie,
      )
    ).statusCode,
    204,
  );
  assert.equal(
    (
      await f.request(
        "PATCH",
        `/albums/${a.id}/photos/${p.id}`,
        { caption: "旧稿", version: p.version },
        owner.cookie,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await f.request(
        "PATCH",
        `/albums/${a.id}/photos/${p.id}`,
        { favorite: true },
        viewer.cookie,
      )
    ).statusCode,
    204,
  );
  assert.equal(
    (await f.request("GET", "/workspace", undefined, owner.cookie)).json()
      .albums[0].photos[0].favorite,
    false,
  );
  assert.equal(
    (
      await f.request(
        "DELETE",
        `/albums/${a.id}/members/${owner.user.id}`,
        undefined,
        owner.cookie,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await f.request(
        "DELETE",
        `/albums/${a.id}/members/${editor.user.id}`,
        undefined,
        owner.cookie,
      )
    ).statusCode,
    204,
  );
  assert.equal(
    (
      await f.request(
        "GET",
        p.url.replace("/api/v1", ""),
        undefined,
        editor.cookie,
      )
    ).statusCode,
    404,
  );
  assert.deepEqual(
    (await f.request("GET", "/workspace", undefined, editor.cookie)).json()
      .albums,
    [],
  );
});
test("invitation expiry, revocation, failed delivery, and unverified recipient protection", async (t) => {
  const f = await fixture(t),
    a = await f.account("first@qq.com"),
    b = await f.account("second@qq.com", false);
  const album = (await f.request("POST", "/albums", draft, a.cookie)).json();
  const invite = (
    await f.request(
      "POST",
      `/albums/${album.id}/invitations`,
      { email: "second@qq.com", role: "editor" },
      a.cookie,
    )
  ).json();
  const token = f.mailToken("second@qq.com", "invitation");
  assert.equal(
    (await f.request("POST", "/invitations/accept", { token }, b.cookie))
      .statusCode,
    403,
  );
  await f.request(
    "POST",
    "/auth/verify-email",
    { token: f.mailToken("second@qq.com", "verification") },
    b.cookie,
  );
  await f.db.run("UPDATE invitations SET expires_at=0 WHERE id=?", invite.id);
  assert.equal(
    (await f.request("POST", "/invitations/accept", { token }, b.cookie))
      .statusCode,
    410,
  );
  const retry = await f.request(
    "POST",
    `/albums/${album.id}/invitations`,
    { email: "second@qq.com", role: "editor" },
    a.cookie,
  );
  assert.equal(retry.statusCode, 201, retry.body);
  const next = f.mailToken("second@qq.com", "invitation");
  await f.request(
    "DELETE",
    `/albums/${album.id}/members/${retry.json().id}`,
    undefined,
    a.cookie,
  );
  assert.equal(
    (await f.request("POST", "/invitations/accept", { token: next }, b.cookie))
      .statusCode,
    410,
  );
  f.failMail();
  assert.equal(
    (
      await f.request(
        "POST",
        `/albums/${album.id}/invitations`,
        { email: "second@qq.com", role: "editor" },
        a.cookie,
      )
    ).statusCode,
    503,
  );
  assert.equal(
    (
      await f.db.get(
        "SELECT COUNT(*) AS n FROM invitations WHERE status='pending'",
      )
    ).n,
    0,
  );
});
test("origin protection, expired sessions, persistent records, invalid uploads and calendar dates", async (t) => {
  const f = await fixture(t),
    a = await f.account("security@qq.com");
  assert.equal(
    (
      await f.request("POST", "/albums", draft, a.cookie, {
        origin: "https://attacker.example",
      })
    ).statusCode,
    403,
  );
  const album = (await f.request("POST", "/albums", draft, a.cookie)).json();
  assert.equal(
    (
      await f.request(
        "POST",
        `/albums/${album.id}/photos`,
        {
          photos: [
            {
              url: "data:image/png;base64,PHNjcmlwdD4=",
              caption: "bad",
              date: "2026-10-21",
            },
          ],
        },
        a.cookie,
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await f.request(
        "POST",
        "/anniversaries",
        { title: "bad", date: "2026-02-30", emoji: "♡" },
        a.cookie,
      )
    ).statusCode,
    400,
  );
  const second = await buildApp({
    config: f.config,
    database:
      process.env.TEST_DATABASE === "postgres"
        ? { ...f.db, close: async () => {} }
        : undefined,
    mailer: async () => {},
  });
  try {
    const r = await second.app.inject({
      method: "GET",
      url: "/api/v1/workspace",
      headers: { cookie: a.cookie },
    });
    assert.equal(r.json().albums[0].id, album.id);
  } finally {
    await second.app.close();
  }
  await f.db.run("UPDATE sessions SET expires_at=0");
  assert.equal(
    (await f.request("POST", "/albums", draft, a.cookie)).statusCode,
    401,
  );
});
test("verification delivery failure leaves a recoverable unverified account, not fake success", async (t) => {
  const f = await fixture(t);
  f.failMail();
  const r = await f.request("POST", "/auth/register", {
    email: "recover@qq.com",
    password,
    name: "可重试",
  });
  assert.equal(r.statusCode, 201);
  assert.equal(r.json().mailDelivery, "failed");
  assert.equal(r.json().emailVerified, false);
  assert.equal(
    (await f.db.get("SELECT COUNT(*) AS n FROM verifications")).n,
    0,
  );
});
