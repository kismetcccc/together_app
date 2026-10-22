import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../src/app.js";
import { withAppLink, type Mail } from "../src/mail.js";
import { digest } from "../src/security.js";
import { testPostgres } from "./pglite-store.js";

test("native sessions: QQ verification, protected photo, invitation, editor/viewer, logout and reset revocation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "together-native-"));
  const mails: Mail[] = [];
  const { app, db } = await buildApp({
    database:
      process.env.TEST_DATABASE === "postgres"
        ? await testPostgres()
        : undefined,
    config: {
      dataDir: dir,
      origin: "http://localhost:8081",
      production: false,
      mailTransport: "file",
      mailFrom: "test@qq.com",
      smtpPort: 465,
      smtpSecure: true,
      rateLimit: false,
    },
    mailer: async (m) => {
      mails.push(withAppLink(m));
    },
  });
  const request = (
    method: any,
    path: string,
    body?: unknown,
    token?: string,
    extra: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: "/api/v1" + path,
      headers: {
        "x-together-client": "native",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { payload: body }),
    });
  const password = "Native-test-password-2026";
  try {
    const account = async (email: string) => {
      const r = await request("POST", "/auth/register", {
        name: email.split("@")[0],
        email,
        password,
      });
      assert.equal(r.statusCode, 201);
      const u = r.json();
      assert.equal(r.headers["set-cookie"], undefined);
      assert.match(u.accessToken, /^[\w-]{43}$/);
      assert.equal(
        (await db.get("SELECT token_hash FROM sessions WHERE user_id=?", u.id))
          .token_hash,
        digest(u.accessToken),
      );
      assert.equal(
        (
          await request(
            "POST",
            "/albums",
            { title: "before verification", description: "", category: "好友" },
            u.accessToken,
          )
        ).statusCode,
        403,
      );
      const token = mails
        .at(-1)!
        .text.match(/together:\/\/verify\/([\w-]{43})/)![1];
      assert.equal(
        (await request("POST", "/auth/verify-email", { token })).statusCode,
        200,
      );
      return u;
    };
    const a = await account("native.owner@qq.com"),
      b = await account("native.friend@qq.com"),
      v = await account("native.viewer@qq.com");
    const album = (
      await request(
        "POST",
        "/albums",
        { title: "原生共享", description: "", category: "好友" },
        a.accessToken,
      )
    ).json();
    const invite = (
      await request(
        "POST",
        `/albums/${album.id}/invitations`,
        { email: b.email, role: "editor" },
        a.accessToken,
      )
    ).json();
    const token = invite.inviteUrl.split("/").pop();
    assert.equal(
      (await request("POST", "/invitations/accept", { token }, v.accessToken))
        .statusCode,
      403,
    );
    assert.equal(
      (await request("POST", "/invitations/accept", { token }, b.accessToken))
        .statusCode,
      200,
    );
    assert.equal(
      (await request("POST", "/invitations/accept", { token }, b.accessToken))
        .statusCode,
      410,
    );
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xkAAAAASUVORK5CYII=";
    assert.equal(
      (
        await request(
          "POST",
          `/albums/${album.id}/photos`,
          { photos: [{ url: png, caption: "native", date: "2026-10-22" }] },
          b.accessToken,
        )
      ).statusCode,
      201,
    );
    const photo = (
      await request("GET", `/albums/${album.id}`, undefined, b.accessToken)
    ).json().photos[0];
    assert.equal(
      (
        await request(
          "GET",
          photo.url.replace("/api/v1", ""),
          undefined,
          a.accessToken,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await request(
          "GET",
          photo.url.replace("/api/v1", ""),
          undefined,
          v.accessToken,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await request(
          "PATCH",
          `/albums/${album.id}/photos/${photo.id}`,
          { caption: "edited", version: photo.version },
          b.accessToken,
        )
      ).statusCode,
      204,
    );
    assert.equal(
      (
        await request(
          "PATCH",
          `/albums/${album.id}/photos/${photo.id}`,
          { caption: "stale", version: photo.version },
          b.accessToken,
        )
      ).statusCode,
      409,
    );
    const iv = (
      await request(
        "POST",
        `/albums/${album.id}/invitations`,
        { email: v.email, role: "viewer" },
        a.accessToken,
      )
    ).json();
    await request(
      "POST",
      "/invitations/accept",
      { token: iv.inviteUrl.split("/").pop() },
      v.accessToken,
    );
    assert.equal(
      (
        await request(
          "POST",
          `/albums/${album.id}/photos`,
          { photos: [] },
          v.accessToken,
        )
      ).statusCode,
      403,
    );
    await request("POST", "/auth/logout", undefined, b.accessToken);
    assert.equal(
      (await request("GET", "/workspace", undefined, b.accessToken)).json()
        .user,
      null,
    );
    await request("POST", "/auth/forgot-password", { email: a.email });
    const reset = mails
      .at(-1)!
      .text.match(/together:\/\/reset\/([\w-]{43})/)![1];
    await request("POST", "/auth/reset-password", {
      token: reset,
      password: "Changed-native-password-2026",
    });
    assert.equal(
      (await request("GET", "/workspace", undefined, a.accessToken)).json()
        .user,
      null,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/auth/login",
          { email: a.email, password: "Changed-native-password-2026" },
          {} as any,
          { origin: "https://evil.example" },
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/auth/login",
          { email: a.email, password: "Changed-native-password-2026" },
          undefined,
          { cookie: "together_session=fake" },
        )
      ).statusCode,
      403,
    );
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
