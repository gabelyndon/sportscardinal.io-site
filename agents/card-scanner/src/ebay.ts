// eBay Browse API client (client-credentials / application token).
//
// NOTE: the Browse API returns ASKING prices from live listings. It does not
// expose sold/completed prices.

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

// Reuse a cached token until this long before it expires.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

// ---------- types ----------

export interface Listing {
  title: string;
  /** Asking price as a number (eBay sends it as a string). */
  price: number;
  currency: string;
  condition: string | null;
  buyingOptions: string[];
  itemWebUrl: string;
  /** ISO timestamp; only present on auctions / time-limited listings. */
  endsAt: string | null;
}

export interface SearchOptions {
  /** Max results, 1-200 (default 50). */
  limit?: number;
  /** Result offset for paging (default 0). */
  offset?: number;
  /** eBay marketplace, e.g. EBAY_US (default). */
  marketplaceId?: string;
  /** Raw Browse API filter, e.g. "buyingOptions:{FIXED_PRICE}". */
  filter?: string;
  /** Raw Browse API sort, e.g. "price" or "-price". */
  sort?: string;
}

export interface SearchResult {
  listings: Listing[];
  /** Total matches eBay reports (may exceed listings.length). */
  total: number;
}

export interface EbayCredentials {
  clientId: string;
  clientSecret: string;
}

// ---------- errors ----------

export class EbayError extends Error {}

/** Bad/missing credentials, or the token endpoint rejected us. */
export class EbayAuthError extends EbayError {
  status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "EbayAuthError";
    this.status = status;
  }
}

/** HTTP 429. Deliberately NOT retried; the caller decides what to do. */
export class EbayRateLimitError extends EbayError {
  retryAfterSeconds: number | null;
  constructor(retryAfterSeconds: number | null) {
    super(
      "eBay rate limit hit (HTTP 429)" +
        (retryAfterSeconds != null ? `; Retry-After ${retryAfterSeconds}s` : "") +
        ". Not retrying automatically.",
    );
    this.name = "EbayRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Any other non-2xx response from the API. */
export class EbayApiError extends EbayError {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`eBay API error (HTTP ${status}): ${body.slice(0, 500)}`);
    this.name = "EbayApiError";
    this.status = status;
    this.body = body;
  }
}

/** DNS failure, connection reset, timeout, etc. */
export class EbayNetworkError extends EbayError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "EbayNetworkError";
  }
}

// ---------- client ----------

export class EbayClient {
  #creds: EbayCredentials;
  #token: string | null = null;
  #tokenExpiresAt = 0;

  constructor(creds: EbayCredentials) {
    if (!creds.clientId || !creds.clientSecret) {
      throw new EbayAuthError(
        "Missing eBay credentials: set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (see .env.example).",
      );
    }
    this.#creds = creds;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): EbayClient {
    return new EbayClient({
      clientId: env.EBAY_CLIENT_ID ?? "",
      clientSecret: env.EBAY_CLIENT_SECRET ?? "",
    });
  }

  async searchListings(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
    const q = query.trim();
    if (!q) throw new EbayError("Search query is empty.");

    const params = new URLSearchParams({
      q,
      limit: String(clamp(opts.limit ?? 50, 1, 200)),
      offset: String(Math.max(0, opts.offset ?? 0)),
    });
    if (opts.filter) params.set("filter", opts.filter);
    if (opts.sort) params.set("sort", opts.sort);
    const url = `${SEARCH_URL}?${params}`;
    const marketplace = opts.marketplaceId ?? "EBAY_US";

    let res = await this.#get(url, marketplace);
    if (res.status === 401) {
      // Token may have been revoked/expired early: refresh once and retry once.
      this.#token = null;
      res = await this.#get(url, marketplace);
    }

    if (res.status === 401) {
      throw new EbayAuthError("eBay rejected the access token even after a refresh (HTTP 401).", 401);
    }
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      throw new EbayRateLimitError(Number.isFinite(ra) && ra > 0 ? ra : null);
    }
    if (!res.ok) {
      throw new EbayApiError(res.status, await safeText(res));
    }

    const data = (await res.json()) as RawSearchResponse;
    return {
      listings: (data.itemSummaries ?? []).flatMap(toListing),
      total: data.total ?? 0,
    };
  }

  async #get(url: string, marketplaceId: string): Promise<Response> {
    const token = await this.#getToken();
    return fetchOrThrow(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
        Accept: "application/json",
      },
    });
  }

  async #getToken(): Promise<string> {
    if (this.#token && Date.now() < this.#tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return this.#token;
    }

    const basic = Buffer.from(`${this.#creds.clientId}:${this.#creds.clientSecret}`).toString("base64");
    const res = await fetchOrThrow(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE }),
    });

    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      throw new EbayRateLimitError(Number.isFinite(ra) && ra > 0 ? ra : null);
    }
    if (!res.ok) {
      const body = await safeText(res);
      if (res.status === 400 || res.status === 401) {
        throw new EbayAuthError(
          `eBay token request failed (HTTP ${res.status}). Check EBAY_CLIENT_ID / EBAY_CLIENT_SECRET ` +
            `are PRODUCTION keys. ${body.slice(0, 300)}`,
          res.status,
        );
      }
      throw new EbayApiError(res.status, body);
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new EbayAuthError("eBay token response had no access_token.");
    this.#token = data.access_token;
    this.#tokenExpiresAt = Date.now() + (data.expires_in ?? 7200) * 1000;
    return this.#token;
  }
}

// ---------- helpers ----------

interface RawItem {
  title?: string;
  price?: { value?: string; currency?: string };
  condition?: string;
  buyingOptions?: string[];
  itemWebUrl?: string;
  itemEndDate?: string;
}

interface RawSearchResponse {
  total?: number;
  itemSummaries?: RawItem[];
}

function toListing(item: RawItem): Listing[] {
  const price = Number(item.price?.value);
  // Skip malformed entries rather than emitting NaN prices into stats.
  if (!item.title || !item.itemWebUrl || !Number.isFinite(price)) return [];
  return [
    {
      title: item.title,
      price,
      currency: item.price?.currency ?? "USD",
      condition: item.condition ?? null,
      buyingOptions: item.buyingOptions ?? [],
      itemWebUrl: item.itemWebUrl,
      endsAt: item.itemEndDate ?? null,
    },
  ];
}

async function fetchOrThrow(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new EbayNetworkError(
      timedOut ? `eBay request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.` : "Network error reaching eBay.",
      err,
    );
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}
