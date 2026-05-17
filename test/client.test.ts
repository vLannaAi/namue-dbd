import { test } from "node:test";
import assert from "node:assert/strict";
import { NamueDwClient } from "../src/dw/client.ts";
import type { DwSession } from "../src/dw/auth.ts";

function fakeSession(): DwSession {
  return { idToken: "tok", encKey: new Uint8Array(32), expiresAt: Date.now() + 600_000 };
}

function envelopeResponse(): Response {
  return new Response(JSON.stringify({ kid: 1, salt: "", iv: "", ct: "" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("searchByName POSTs to /api/v1/company-profiles/infos with uppercased keyword", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    calls.push({ url, init: init ?? {} });
    return Promise.resolve(envelopeResponse());
  };
  const client = new NamueDwClient({
    fetch: fakeFetch,
    session: fakeSession(),
    _decryptForTest: async () => ({
      meta: { currentPage: 1, totalItems: 0, totalPages: 0, itemsPerPage: 20 },
      contents: [],
    }),
  });
  const page = await client.searchByName("lanna");
  assert.equal(page.meta.totalItems, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "https://datawarehouse.dbd.go.th/api/v1/company-profiles/infos");
  assert.equal(calls[0]!.init.method, "POST");
  const headers = new Headers(calls[0]!.init.headers);
  assert.equal(headers.get("Authorization"), "Bearer tok");
  const body = JSON.parse(calls[0]!.init.body as string);
  assert.equal(body.keyword, "LANNA");
  assert.equal(body.sortBy, "jpName");
});

test("searchByName forwards options through buildSearchBody", async () => {
  const calls: { init: RequestInit }[] = [];
  const fakeFetch: typeof fetch = (_input, init) => {
    calls.push({ init: init ?? {} });
    return Promise.resolve(envelopeResponse());
  };
  const client = new NamueDwClient({
    fetch: fakeFetch,
    session: fakeSession(),
    _decryptForTest: async () => ({
      meta: { currentPage: 2, totalItems: 0, totalPages: 0, itemsPerPage: 20 }, contents: [],
    }),
  });
  await client.searchByName("x", { page: 2, pvCodeList: ["50"] });
  const body = JSON.parse(calls[0]!.init.body as string);
  assert.equal(body.currentPage, 2);
  assert.deepEqual(body.pvCodeList, ["50"]);
});

test("getCommittees GETs /api/v1/company-profiles/committees/{type}/{id}", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    calls.push({ url, init: init ?? {} });
    return Promise.resolve(envelopeResponse());
  };
  const client = new NamueDwClient({
    fetch: fakeFetch,
    session: fakeSession(),
    _decryptForTest: async () => [],
  });
  await client.getCommittees("5", "0105563012345");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "https://datawarehouse.dbd.go.th/api/v1/company-profiles/committees/5/0105563012345");
  assert.equal(calls[0]!.init.method, "GET");
  assert.equal(calls[0]!.init.body, undefined);
});

test("ServerError raised on 5xx with status preserved", async () => {
  const fakeFetch: typeof fetch = () =>
    Promise.resolve(new Response("oops", { status: 503 }));
  const client = new NamueDwClient({ fetch: fakeFetch, session: fakeSession() });
  await assert.rejects(
    () => client.searchByName("x"),
    (e: unknown) => (e as { code: string; status: number }).code === "NAMUE_SERVER" && (e as { status: number }).status === 503,
  );
});

test("Non-OK 4xx also raises ServerError", async () => {
  const fakeFetch: typeof fetch = () =>
    Promise.resolve(new Response("bad", { status: 400 }));
  const client = new NamueDwClient({ fetch: fakeFetch, session: fakeSession() });
  await assert.rejects(
    () => client.searchByName("x"),
    (e: unknown) => (e as { status: number }).status === 400,
  );
});
