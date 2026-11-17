import { healthcheck } from "./healthcheck";
import { discoverAccountsJob } from "./discoverAccounts";
import { syncAccountJob } from "./syncAccount";
import { nightlySyncJob } from "./nightlySync";
import { runAuditJob } from "./runAudit";
import { weeklyAuditJob } from "./weeklyAudit";

/** Every background job registered with Inngest. */
export const functions = [healthcheck, discoverAccountsJob, syncAccountJob, nightlySyncJob, runAuditJob, weeklyAuditJob];
