import { test } from "node:test";
import assert from "node:assert/strict";
import { TogetherApi, ApiError, type TokenStore } from "../src/lib/api";
import { parseMailLink, daysUntil } from "../src/lib/links";
const token = "a".repeat(43);
function storage(): TokenStore & { value: string | null } {
  return {
    value: null,
    async get() {
      return this.value;
    },
    async set(v) {
      this.value = v;
    },
    async remove() {
      this.value = null;
    },
  };
}
test("mobile login securely stores token, uses bearer, omits cookies and revokes session on logout", async () => {
  const store = storage(),
    calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return url.endsWith("/login")
      ? new Response(
          JSON.stringify({ id: "u", email: "u@qq.com", accessToken: token }),
        )
      : new Response(null, { status: 204 });
  }) as typeof fetch;
  const api = new TogetherApi("https://example.com/api/v1", store, fetcher);
  await api.signIn("U@qq.com", "password");
  assert.equal(store.value, token);
  await api.editPhoto("album", { id: "p", version: 7 } as any, {
    caption: "story",
  });
  assert.equal((calls[1].init.headers as any).Authorization, `Bearer ${token}`);
  assert.equal(calls[1].init.credentials, "omit");
  assert.equal(JSON.parse(calls[1].init.body as string).version, 7);
  await api.signOut();
  assert.equal(store.value, null);
  assert.equal(calls[2].init.body, undefined);
});
test("expired native token clears secure storage; permission and conflict errors remain actionable", async () => {
  for (const status of [401, 403, 409]) {
    const store = storage();
    store.value = token;
    const api = new TogetherApi(
      "https://example.com/api/v1",
      store,
      (async () =>
        new Response(JSON.stringify({ message: "failure", code: "TEST" }), {
          status,
        })) as typeof fetch,
    );
    await api.restore();
    await assert.rejects(
      api.album("id"),
      (e: unknown) => e instanceof ApiError && e.status === status,
    );
    assert.equal(store.value, status === 401 ? null : token);
  }
});
test("legacy backend cannot silently pretend native sign-in succeeded", async () => {
  const store = storage();
  const api = new TogetherApi(
    "https://example.com/api/v1",
    store,
    (async () => new Response(JSON.stringify({ id: "u" }))) as typeof fetch,
  );
  await assert.rejects(api.signIn("u@qq.com", "password"), /App 登录协议/);
  assert.equal(store.value, null);
});
test("deep links only accept exact routes and 43-character opaque tokens", () => {
  for (const kind of ["verify", "invite", "reset"] as const) {
    assert.deepEqual(parseMailLink(`together://${kind}/${token}`), {
      kind,
      token,
    });
    assert.deepEqual(parseMailLink(`https://example.com/#/${kind}/${token}`), {
      kind,
      token,
    });
    assert.deepEqual(
      parseMailLink(`exp://192.168.1.1:8081/--/${kind}/${token}`),
      { kind, token },
    );
  }
  for (const value of [
    `javascript:alert(1)`,
    `together://invite/short`,
    `https://example.com/#/unknown/${token}`,
    `together://invite/${token}/extra`,
  ])
    assert.equal(parseMailLink(value), null);
  assert.equal(daysUntil("2026-10-23", new Date("2026-10-22T12:00:00")), 1);
});
test("private image credentials cannot be sent to a different host", () => {
  const api = new TogetherApi("https://api.example.com/api/v1", storage());
  assert.equal(
    api.photoUrl("/api/v1/albums/a/photos/p/content"),
    "https://api.example.com/api/v1/albums/a/photos/p/content",
  );
  assert.throws(() => api.photoUrl("https://evil.example/api/v1/albums/a"));
  assert.throws(() => api.photoUrl("/auth/login"));
});

// Browser fetch requires its global receiver; never call it as api.fetcher().
test("default fetch adapter preserves the global calling context", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = function (this: unknown) {
    assert.equal(this, undefined);
    return Promise.resolve(
      new Response(
        JSON.stringify({ user: null, albums: [], anniversaries: [] }),
      ),
    );
  } as typeof fetch;
  try {
    const api = new TogetherApi("https://example.com/api/v1", storage());
    assert.equal((await api.snapshot()).user, null);
  } finally {
    globalThis.fetch = original;
  }
});
