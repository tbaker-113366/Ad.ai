import { describe, expect, it, vi } from "vitest";
import { createAdsClient, normaliseCustomerId } from "./adsClient";
import { AdsApiError, QuotaExceededError, ReconnectRequiredError } from "./errors";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const adsError = (status: string, errorCode: Record<string, string>, extra: object[] = []) => [
  {
    error: {
      code: 400,
      status,
      message: "Request contains an invalid argument.",
      details: [
        {
          "@type": "type.googleapis.com/google.ads.googleads.v26.errors.GoogleAdsFailure",
          errors: [{ errorCode, message: `failed: ${Object.values(errorCode)[0]}` }],
        },
        ...extra,
      ],
    },
  },
];

function setup(responses: Response[], extra: Partial<Parameters<typeof createAdsClient>[0]> = {}) {
  const fetchFn = vi.fn();
  responses.forEach((r) => fetchFn.mockResolvedValueOnce(r));
  const sleep = vi.fn().mockResolvedValue(undefined);
  const ops: number[] = [];
  const client = createAdsClient({
    developerToken: "dev-token",
    getAccessToken: async () => "ya29.token",
    fetch: fetchFn,
    sleep,
    random: () => 0,
    onOperations: (n) => ops.push(n),
    ...extra,
  });
  return { client, fetchFn, sleep, ops };
}

describe("normaliseCustomerId", () => {
  it("accepts dashed, plain and resource-name forms", () => {
    expect(normaliseCustomerId("123-456-7890")).toBe("1234567890");
    expect(normaliseCustomerId("customers/1234567890")).toBe("1234567890");
    expect(() => normaliseCustomerId("12345")).toThrow();
    expect(() => normaliseCustomerId("../1234567890")).toThrow();
  });
});

describe("adsClient.searchStream", () => {
  it("sends the right request and flattens batches", async () => {
    const { client, fetchFn, ops } = setup(
      [json(200, [{ results: [{ campaign: { id: "1" } }] }, { results: [{ campaign: { id: "2" } }] }, {}])],
      { loginCustomerId: "111-222-3333" },
    );
    const rows = await client.searchStream("123-456-7890", "SELECT campaign.id FROM campaign");
    expect(rows).toEqual([{ campaign: { id: "1" } }, { campaign: { id: "2" } }]);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://googleads.googleapis.com/v26/customers/1234567890/googleAds:searchStream");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer ya29.token",
      "developer-token": "dev-token",
      "login-customer-id": "1112223333",
    });
    expect(JSON.parse(init.body)).toEqual({ query: "SELECT campaign.id FROM campaign" });
    expect(ops).toEqual([1]);
  });

  it("omits login-customer-id for direct access", async () => {
    const { client, fetchFn } = setup([json(200, [])]);
    await client.searchStream("1234567890", "SELECT customer.id FROM customer");
    expect(fetchFn.mock.calls[0][1].headers).not.toHaveProperty("login-customer-id");
  });

  it("retries transient errors with exponential backoff and counts every attempt", async () => {
    const { client, sleep, ops } = setup([
      json(503, [{ error: { status: "UNAVAILABLE", message: "try again" } }]),
      json(429, adsError("RESOURCE_EXHAUSTED", { quotaError: "RESOURCE_TEMPORARILY_EXHAUSTED" })),
      json(200, [{ results: [{ ok: true }] }]),
    ]);
    await expect(client.searchStream("1234567890", "q")).resolves.toEqual([{ ok: true }]);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
    expect(ops).toEqual([1, 1, 1]);
  });

  it("honours the server's retry delay when longer than backoff", async () => {
    const { client, sleep } = setup([
      json(429, adsError("RESOURCE_EXHAUSTED", { quotaError: "RESOURCE_TEMPORARILY_EXHAUSTED" }, [{ retryDelay: "7s" }])),
      json(200, []),
    ]);
    await client.searchStream("1234567890", "q");
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  it("does not wait out a long quota lockout: throws QuotaExceededError", async () => {
    const { client, sleep } = setup([
      json(429, adsError("RESOURCE_EXHAUSTED", { quotaError: "RESOURCE_EXHAUSTED" }, [{ retryDelay: "3600s" }])),
    ]);
    await expect(client.searchStream("1234567890", "q")).rejects.toBeInstanceOf(QuotaExceededError);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("gives up after max attempts", async () => {
    const fail = () => json(500, [{ error: { status: "INTERNAL", message: "boom" } }]);
    const { client, fetchFn } = setup([fail(), fail(), fail(), fail(), fail()]);
    await expect(client.searchStream("1234567890", "q")).rejects.toBeInstanceOf(AdsApiError);
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  it("maps revoked or lost access to ReconnectRequiredError without retrying", async () => {
    for (const r of [
      json(401, [{ error: { status: "UNAUTHENTICATED", message: "bad token" } }]),
      json(403, adsError("PERMISSION_DENIED", { authorizationError: "USER_PERMISSION_DENIED" })),
      json(401, adsError("UNAUTHENTICATED", { authenticationError: "OAUTH_TOKEN_REVOKED" })),
    ]) {
      const { client, fetchFn } = setup([r]);
      await expect(client.searchStream("1234567890", "q")).rejects.toBeInstanceOf(ReconnectRequiredError);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
  });

  it("does not ask the user to reconnect for developer-token problems", async () => {
    const { client } = setup([
      json(403, adsError("PERMISSION_DENIED", { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" })),
    ]);
    const err = await client.searchStream("1234567890", "q").catch((e) => e);
    expect(err).toBeInstanceOf(AdsApiError);
    expect(err.errorCodes).toEqual(["authorizationError:DEVELOPER_TOKEN_NOT_APPROVED"]);
    expect(err.message).toBe("failed: DEVELOPER_TOKEN_NOT_APPROVED");
  });
});

describe("adsClient.listAccessibleCustomers", () => {
  it("returns plain customer ids", async () => {
    const { client, fetchFn } = setup([json(200, { resourceNames: ["customers/1234567890", "customers/9876543210"] })]);
    await expect(client.listAccessibleCustomers()).resolves.toEqual(["1234567890", "9876543210"]);
    expect(fetchFn.mock.calls[0][0]).toBe("https://googleads.googleapis.com/v26/customers:listAccessibleCustomers");
    expect(fetchFn.mock.calls[0][1].method).toBe("GET");
  });
});
