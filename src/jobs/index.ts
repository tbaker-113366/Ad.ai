import { healthcheck } from "./healthcheck";
import { discoverAccountsJob } from "./discoverAccounts";
import { syncAccountJob } from "./syncAccount";
import { nightlySyncJob } from "./nightlySync";

/** Every background job registered with Inngest. */
export const functions = [healthcheck, discoverAccountsJob, syncAccountJob, nightlySyncJob];
