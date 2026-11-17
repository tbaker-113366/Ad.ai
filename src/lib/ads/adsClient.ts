import { THRESHOLDS } from "@/config/thresholds";
import { AdsApiError, QuotaExceededError, ReconnectRequiredError } from "./errors";

/**
 * The ONLY module that talks to the Google Ads API (spec §3, §4). Bump the
 * API version here. Reads only in Phase 1; mutate helpers arrive with the
 * action pipeline in Phase 3.
 */
export const DEFAULT_API_VERSION = "v26";
const BASE_URL = "https://googleads.googleapis.com";

type Fetch = typeof fetch;

export type AdsClientOptions = {
  developerToken: string;
  /** Returns a valid OAuth access token (refreshing as needed). */
  getAccessToken: () => Promise<string>;
  /** Manager account id when the customer is reached through a manager. */
  loginCustomerId?: string | null;
  apiVersion?: string;
  /** Called with the number of API operations each request used (quota tracking). */
  onOperations?: (count: number) => void;
  fetch?: Fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export type GaqlRow = Record<string, unknown>;

export interface AdsClient {
  /** Customer ids (10 digits) this login can access directly. */
  listAccessibleCustomers(): Promise<string[]>;
  /** Runs a GAQL query with searchStream and returns all rows. */
  searchStream<T extends GaqlRow = GaqlRow>(customerId: string, query: string): Promise<T[]>;
}

export function normaliseCustomerId(id: string): string {
  const digits = id.replace(/^customers\//, "").replace(/-/g, "");
  if (!/^\d{10}$/.test(digits)) throw new Error(`Invalid Google Ads customer id: ${id}`);
  return digits;
}

const RETRYABLE_GRPC = new Set(["RESOURCE_EXHAUSTED", "UNAVAILABLE", "INTERNAL", "DEADLINE_EXCEEDED", "ABORTED"]);
// Authorisation problems the user can fix by reconnecting. Developer-token
// problems are ours, so they are deliberately NOT here.
const RECONNECT_CODES = new Set([
  "authenticationError:OAUTH_TOKEN_REVOKED",
  "authenticationError:OAUTH_TOKEN_EXPIRED",
  "authenticationError:OAUTH_TOKEN_INVALID",
  "authenticationError:OAUTH_TOKEN_DISABLED",
  "authenticationError:NOT_ADS_USER",
  "authenticationError:GOOGLE_ACCOUNT_DELETED",
  "authorizationError:USER_PERMISSION_DENIED",
  "authorizationError:CUSTOMER_NOT_ENABLED",
  "authorizationError:ACTION_NOT_PERMITTED",
]);

type ParsedError = { message: string; grpcStatus: string | null; codes: string[]; retryDelayMs: number | null };

function parseError(body: unknown): ParsedError {
  // searchStream errors arrive as an array of one object; others as an object.
  const root = (Array.isArray(body) ? body[0] : body) as { error?: Record<string, unknown> } | undefined;
  const err = root?.error ?? {};
  const details = (err.details as Array<Record<string, unknown>> | undefined) ?? [];
  const codes: string[] = [];
  let retryDelayMs: number | null = null;
  let message = String(err.message ?? "Google Ads API error");

  for (const d of details) {
    const errors = (d.errors as Array<{ errorCode?: Record<string, string>; message?: string }>) ?? [];
    for (const e of errors) {
      for (const [k, v] of Object.entries(e.errorCode ?? {})) codes.push(`${k}:${v}`);
      if (e.message) message = e.message;
    }
    if (typeof d.retryDelay === "string") {
      const secs = parseFloat(d.retryDelay);
      if (Number.isFinite(secs)) retryDelayMs = secs * 1000;
    }
  }
  return { message, grpcStatus: (err.status as string) ?? null, codes, retryDelayMs };
}

export function createAdsClient(opts: AdsClientOptions): AdsClient {
  const fetchFn = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;
  const version = opts.apiVersion ?? DEFAULT_API_VERSION;
  const { maxAttempts, baseBackoffMs, maxBackoffMs } = THRESHOLDS.api;

  async function request(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<unknown> {
    for (let attempt = 1; ; attempt++) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${await opts.getAccessToken()}`,
        "developer-token": opts.developerToken,
        "Content-Type": "application/json",
      };
      if (opts.loginCustomerId) headers["login-customer-id"] = normaliseCustomerId(opts.loginCustomerId);

      const res = await fetchFn(`${BASE_URL}/${version}/${path}`, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      // Each request counts against the daily operation limit, failed or not.
      opts.onOperations?.(1);

      const body = await res.json().catch(() => null);
      if (res.ok) return body;

      const parsed = parseError(body);
      const requestId = res.headers.get("request-id");

      if (res.status === 401 || parsed.codes.some((c) => RECONNECT_CODES.has(c))) {
        throw new ReconnectRequiredError(parsed.message);
      }

      const isQuota = parsed.codes.some((c) => c.startsWith("quotaError:"));
      const retryable = res.status === 429 || res.status >= 500 || RETRYABLE_GRPC.has(parsed.grpcStatus ?? "");
      if (retryable && attempt < maxAttempts) {
        const backoff = baseBackoffMs * 2 ** (attempt - 1) * (1 + random() * 0.25);
        const delay = Math.max(backoff, parsed.retryDelayMs ?? 0);
        if (delay <= maxBackoffMs) {
          await sleep(delay);
          continue;
        }
      }
      if (isQuota || parsed.grpcStatus === "RESOURCE_EXHAUSTED") throw new QuotaExceededError(parsed.message);
      throw new AdsApiError(parsed.message, res.status, parsed.grpcStatus, parsed.codes, requestId);
    }
  }

  return {
    async listAccessibleCustomers() {
      const body = (await request("customers:listAccessibleCustomers", { method: "GET" })) as {
        resourceNames?: string[];
      };
      return (body?.resourceNames ?? []).map(normaliseCustomerId);
    },

    async searchStream<T extends GaqlRow>(customerId: string, query: string) {
      const id = normaliseCustomerId(customerId);
      const batches = (await request(`customers/${id}/googleAds:searchStream`, {
        method: "POST",
        body: { query },
      })) as Array<{ results?: T[] }> | null;
      return (batches ?? []).flatMap((b) => b.results ?? []);
    },
  };
}
