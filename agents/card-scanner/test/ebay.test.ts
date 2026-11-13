import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  EbayClient,
  EbayAuthError,
  EbayRateLimitError,
  EbayNetworkError,
  EbayApiError,
} from "../src/ebay.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Handler = (url: string, init: RequestInit, calls: string[]) => Response | Promise<Response>;

/** Replace global fetch; returns the ordered list of calls ("token" / "search:<Authorization>"). */
function stubFetch(searchHandler: Handler, tokenHandler?: Handler): string[] {
  const calls: string[] = [];
  let tokenN = 0;
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    if (url.includes("oauth2/token")) {
      calls.push("token");
      if (tokenHandler) return tokenHandler(url, init, calls);
      return Response.json({ access_token: `tok${++tokenN}`, expires_in: 7200 });
    }
    calls.push(`search:${(init.headers as Record<string, string>).Authorization}`);
    return searchHandler(url, init, calls);
  }) as typeof fetch;
  return calls;
}

const okBody = {
  total: 3,
  itemSummaries: [
    { title: "A", price: { value: "10.50", currency: "USD" }, condition: "Used", buyingOptions: ["FIXED_PRICE"], itemWebUrl: "http://x/a" },
    { title: "B", price: { value: "20", currency: "USD" }, buyingOptions: ["AUCTION"], itemWebUrl: "http://x/b", itemEndDate: "2026-12-01T00:00:00.000Z" },
    { title: "bad", price: { value: "nope" }, itemWebUrl: "http://x/c" },
  ],
};

const client = () => new EbayClient({ clientId: "id", clientSecret: "sec" });

test("constructor rejects missing credentials", () => {
  assert.throws(() => new EbayClient({ clientId: "", clientSecret: "x" }), EbayAuthError);
  assert.throws(() => new EbayClient({ clientId: "x", clientSecret: "" }), EbayAuthError);
});

test("token request: client-credentials form, scope, Basic auth", async () => {
  let seen: { body: string; auth: string; contentType: string } | undefined;
  stubFetch(
    () => Response.json(okBody),
    (_url, init) => {
      const h = init.headers as Record<string, string>;
      seen = { body: String(init.body), auth: h.Authorization!, contentType: h["Content-Type"]! };
      return Response.json({ access_token: "t", expires_in: 7200 });
    },
  );
  await client().searchListings("q");
  assert.ok(seen);
  assert.match(seen.body, /grant_type=client_credentials/);
  assert.match(seen.body, /scope=https%3A%2F%2Fapi\.ebay\.com%2Foauth%2Fapi_scope/);
  assert.equal(seen.auth, `Basic ${Buffer.from("id:sec").toString("base64")}`);
  assert.equal(seen.contentType, "application/x-www-form-urlencoded");
});

test("parses listings, skips malformed items, maps optional fields", async () => {
  stubFetch(() => Response.json(okBody));
  const r = await client().searchListings("q");
  assert.equal(r.total, 3);
  assert.equal(r.listings.length, 2, "item with a non-numeric price is skipped");
  assert.equal(r.listings[0]!.price, 10.5);
  assert.equal(r.listings[0]!.condition, "Used");
  assert.equal(r.listings[0]!.endsAt, null);
  assert.equal(r.listings[1]!.condition, null);
  assert.equal(r.listings[1]!.endsAt, "2026-12-01T00:00:00.000Z");
  assert.deepEqual(r.listings[1]!.buyingOptions, ["AUCTION"]);
});

test("token is cached and reused across searches", async () => {
  const calls = stubFetch(() => Response.json(okBody));
  const c = client();
  await c.searchListings("q");
  await c.searchListings("q");
  assert.equal(calls.filter((x) => x === "token").length, 1);
  assert.deepEqual(calls.filter((x) => x.startsWith("search")), ["search:Bearer tok1", "search:Bearer tok1"]);
});

test("token is refreshed once it is within 5 minutes of expiry", async () => {
  const calls = stubFetch(
    () => Response.json(okBody),
    () => Response.json({ access_token: `t${Date.now()}`, expires_in: 200 }), // < 300s margin: already stale
  );
  const c = client();
  await c.searchListings("q");
  await c.searchListings("q");
  assert.equal(calls.filter((x) => x === "token").length, 2);
});

test("401 refreshes the token once and retries once", async () => {
  const calls = stubFetch((_u, init) =>
    (init.headers as Record<string, string>).Authorization === "Bearer tok1"
      ? new Response("{}", { status: 401 })
      : Response.json(okBody),
  );
  const r = await client().searchListings("q");
  assert.equal(r.listings.length, 2);
  assert.deepEqual(calls, ["token", "search:Bearer tok1", "token", "search:Bearer tok2"]);
});

test("a persistent 401 raises EbayAuthError after exactly one retry", async () => {
  const calls = stubFetch(() => new Response("{}", { status: 401 }));
  await assert.rejects(client().searchListings("q"), EbayAuthError);
  assert.equal(calls.filter((x) => x.startsWith("search")).length, 2);
});

test("429 is surfaced with Retry-After and is NOT retried", async () => {
  const calls = stubFetch(() => new Response("{}", { status: 429, headers: { "retry-after": "30" } }));
  await assert.rejects(client().searchListings("q"), (e: unknown) => {
    assert.ok(e instanceof EbayRateLimitError);
    assert.equal(e.retryAfterSeconds, 30);
    return true;
  });
  assert.equal(calls.filter((x) => x.startsWith("search")).length, 1);
  assert.equal(calls.filter((x) => x === "token").length, 1);
});

test("429 without a Retry-After header gives retryAfterSeconds null", async () => {
  stubFetch(() => new Response("{}", { status: 429 }));
  await assert.rejects(client().searchListings("q"), (e: unknown) => e instanceof EbayRateLimitError && e.retryAfterSeconds === null);
});

test("network failure on search raises EbayNetworkError", async () => {
  stubFetch(() => {
    throw new TypeError("fetch failed");
  });
  await assert.rejects(client().searchListings("q"), EbayNetworkError);
});

test("network failure on the token request raises EbayNetworkError", async () => {
  stubFetch(
    () => Response.json(okBody),
    () => {
      throw new TypeError("fetch failed");
    },
  );
  await assert.rejects(client().searchListings("q"), EbayNetworkError);
});

test("bad credentials at the token endpoint raise EbayAuthError", async () => {
  stubFetch(() => Response.json(okBody), () => new Response('{"error":"invalid_client"}', { status: 401 }));
  await assert.rejects(client().searchListings("q"), EbayAuthError);
});

test("other HTTP errors raise EbayApiError with the status", async () => {
  stubFetch(() => new Response("boom", { status: 500 }));
  await assert.rejects(client().searchListings("q"), (e: unknown) => e instanceof EbayApiError && e.status === 500);
});

test("empty query is rejected before any network call", async () => {
  const calls = stubFetch(() => Response.json(okBody));
  await assert.rejects(client().searchListings("   "), /empty/i);
  assert.equal(calls.length, 0);
});
