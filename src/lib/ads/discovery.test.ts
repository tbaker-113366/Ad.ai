import { describe, expect, it } from "vitest";
import type { AdsClient } from "./adsClient";
import { discoverAccounts } from "./discovery";
import { AdsApiError, ReconnectRequiredError } from "./errors";

const customer = (id: string, name: string, extra: object = {}) => ({
  customer: { id, descriptiveName: name, currencyCode: "GBP", timeZone: "Europe/London", status: "ENABLED", ...extra },
});
const client = (id: string, name: string, extra: object = {}) => ({
  customerClient: { id, descriptiveName: name, currencyCode: "GBP", timeZone: "Europe/London", ...extra },
});

function fakeAds(accessible: string[], responses: Record<string, unknown[] | Error>) {
  const calls: Array<{ login: string | null; customerId: string; query: string }> = [];
  const make = (login: string | null): AdsClient => ({
    listAccessibleCustomers: async () => accessible,
    searchStream: async <T,>(customerId: string, query: string) => {
      calls.push({ login, customerId, query });
      const key = `${query.includes("customer_client") ? "clients" : "info"}:${customerId}`;
      const r = responses[key];
      if (r instanceof Error) throw r;
      return (r ?? []) as T[];
    },
  });
  return { make, calls };
}

describe("discoverAccounts", () => {
  it("returns direct accounts and children of managers, preferring direct access", async () => {
    const { make, calls } = fakeAds(["1111111111", "2222222222", "9999999999"], {
      "info:1111111111": [customer("1111111111", "Bakery")],
      "info:2222222222": [customer("2222222222", "Agency MCC", { manager: true })],
      "clients:2222222222": [
        client("3333333333", "Cafe", { testAccount: true }),
        client("1111111111", "Bakery (via agency)"),
        client("4444444444", "Sub MCC", { manager: true }),
      ],
      "info:9999999999": [customer("9999999999", "Closed", { status: "CANCELED" })],
    });

    const accounts = await discoverAccounts(make);
    expect(accounts).toEqual([
      expect.objectContaining({ customerId: "1111111111", descriptiveName: "Bakery", loginCustomerId: null }),
      expect.objectContaining({
        customerId: "3333333333",
        loginCustomerId: "2222222222",
        viaManagerName: "Agency MCC",
        isTestAccount: true,
      }),
    ]);
    // Children of a manager are listed using the manager as login-customer-id.
    expect(calls.find((c) => c.query.includes("customer_client"))?.login).toBe("2222222222");
  });

  it("skips accounts that error", async () => {
    const { make } = fakeAds(["1111111111", "2222222222"], {
      "info:1111111111": new AdsApiError("not enabled", 403, "PERMISSION_DENIED"),
      "info:2222222222": [customer("2222222222", "OK")],
    });
    await expect(discoverAccounts(make)).resolves.toHaveLength(1);
  });

  it("surfaces reconnect errors when the only account fails auth", async () => {
    const { make } = fakeAds(["1111111111"], { "info:1111111111": new ReconnectRequiredError() });
    await expect(discoverAccounts(make)).rejects.toBeInstanceOf(ReconnectRequiredError);
  });
});
