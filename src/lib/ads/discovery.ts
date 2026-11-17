import { CUSTOMER_CLIENTS_QUERY, CUSTOMER_INFO_QUERY } from "./gaql";
import { ReconnectRequiredError } from "./errors";
import type { AdsClient } from "./adsClient";

/** An account the user can pick in the account picker. */
export type DiscoveredAccount = {
  customerId: string;
  descriptiveName: string | null;
  currency: string;
  timeZone: string;
  isTestAccount: boolean;
  /** Manager id to send as login-customer-id, or null for direct access. */
  loginCustomerId: string | null;
  /** Name of the manager it was found through, for display. */
  viaManagerName: string | null;
  /** Spend in the last 30 days (micros), or null if it couldn't be read. */
  spend30Micros?: number | null;
};

const SPEND_30_QUERY = "SELECT metrics.cost_micros FROM customer WHERE segments.date DURING LAST_30_DAYS";
/** At most this many accounts get a spend lookup (each costs an API operation). */
const MAX_SPEND_LOOKUPS = 25;

type CustomerRow = {
  customer: {
    id: string;
    descriptiveName?: string;
    currencyCode: string;
    timeZone: string;
    manager?: boolean;
    testAccount?: boolean;
    status?: string;
  };
};
type ClientRow = {
  customerClient: {
    id: string;
    descriptiveName?: string;
    currencyCode: string;
    timeZone: string;
    manager?: boolean;
    testAccount?: boolean;
  };
};

/**
 * Lists every non-manager account the login can use: accounts it accesses
 * directly, plus direct children of manager accounts it can access. Direct
 * access wins when an account is reachable both ways. Per-account failures
 * (e.g. cancelled accounts) are skipped, except reconnect errors.
 */
export async function discoverAccounts(
  makeClient: (loginCustomerId: string | null) => AdsClient,
): Promise<DiscoveredAccount[]> {
  const direct = makeClient(null);
  const ids = await direct.listAccessibleCustomers();
  const found = new Map<string, DiscoveredAccount>();
  const viaManager: DiscoveredAccount[] = [];

  for (const id of ids) {
    let info: CustomerRow["customer"] | undefined;
    try {
      info = (await direct.searchStream<CustomerRow>(id, CUSTOMER_INFO_QUERY))[0]?.customer;
    } catch (err) {
      if (err instanceof ReconnectRequiredError && ids.length === 1) throw err;
      continue;
    }
    if (!info || (info.status && info.status !== "ENABLED")) continue;

    if (!info.manager) {
      found.set(id, {
        customerId: id,
        descriptiveName: info.descriptiveName ?? null,
        currency: info.currencyCode,
        timeZone: info.timeZone,
        isTestAccount: Boolean(info.testAccount),
        loginCustomerId: null,
        viaManagerName: null,
      });
      continue;
    }

    try {
      const rows = await makeClient(id).searchStream<ClientRow>(id, CUSTOMER_CLIENTS_QUERY);
      for (const { customerClient: c } of rows) {
        if (c.manager) continue;
        viaManager.push({
          customerId: String(c.id),
          descriptiveName: c.descriptiveName ?? null,
          currency: c.currencyCode,
          timeZone: c.timeZone,
          isTestAccount: Boolean(c.testAccount),
          loginCustomerId: id,
          viaManagerName: info.descriptiveName ?? null,
        });
      }
    } catch {
      // Manager we can't list children of: skip it.
    }
  }

  for (const acct of viaManager) if (!found.has(acct.customerId)) found.set(acct.customerId, acct);
  const accounts = [...found.values()];

  for (const acct of accounts.slice(0, MAX_SPEND_LOOKUPS)) {
    try {
      const rows = await makeClient(acct.loginCustomerId).searchStream<{ metrics?: { costMicros?: string } }>(acct.customerId, SPEND_30_QUERY);
      acct.spend30Micros = rows.reduce((a, r) => a + Number(r.metrics?.costMicros ?? 0), 0);
    } catch {
      acct.spend30Micros = null;
    }
  }
  // Busiest accounts first: they're the ones people want audited.
  return accounts.sort((a, b) => (b.spend30Micros ?? -1) - (a.spend30Micros ?? -1) || (a.descriptiveName ?? "").localeCompare(b.descriptiveName ?? ""));
}
