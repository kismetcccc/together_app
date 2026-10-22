import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { proxyRequest } from "../src/netlify-handler.js";
import { postgresSql } from "../src/postgres.js";

test("Netlify adapter preserves cookies, origin, private image bytes and trusted IP", async () => {
  const app = Fastify();
  app.post("/api/v1/auth/login", async (req, reply) => {
    assert.equal(req.headers.origin, "https://test.netlify.app");
    assert.equal(req.ip, "203.0.113.2");
    reply.header(
      "set-cookie",
      "together_session=test; HttpOnly; Secure; SameSite=Lax; Path=/",
    );
    return { ok: true };
  });
  const r = await proxyRequest(
    app,
    new Request(
      "https://test.netlify.app/.netlify/functions/api/api/v1/auth/login",
      {
        method: "POST",
        headers: {
          origin: "https://test.netlify.app",
          "content-type": "application/json",
        },
        body: "{}",
      },
    ),
    "203.0.113.2",
  );
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie")!, /HttpOnly/);
  await app.close();
});
test("private binary responses and empty responses survive the cloud bridge", async () => {
  const app = Fastify();
  app.get("/api/v1/photo", async (_req, reply) =>
    reply.type("image/png").send(Buffer.from([137, 80, 78, 71])),
  );
  app.post("/api/v1/logout", async (_req, reply) => reply.code(204).send());
  const photo = await proxyRequest(
    app,
    new Request("https://test.netlify.app/api/v1/photo"),
    "203.0.113.2",
  );
  assert.deepEqual(
    [...new Uint8Array(await photo.arrayBuffer())],
    [137, 80, 78, 71],
  );
  assert.equal(
    (
      await proxyRequest(
        app,
        new Request("https://test.netlify.app/api/v1/logout", {
          method: "POST",
        }),
        "203.0.113.2",
      )
    ).status,
    204,
  );
  await app.close();
});
test("SQL translation binds values without altering quoted question marks", () => {
  assert.equal(
    postgresSql("SELECT '?' AS label FROM users WHERE id=? AND email=?"),
    "SELECT '?' AS label FROM users WHERE id=$1 AND email=$2",
  );
  assert.equal(
    postgresSql("INSERT OR IGNORE INTO favorites VALUES(?,?)"),
    "INSERT INTO favorites VALUES($1,$2) ON CONFLICT DO NOTHING",
  );
});
