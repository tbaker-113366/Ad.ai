import { healthcheck } from "./healthcheck";
import { discoverAccountsJob } from "./discoverAccounts";
import { syncAccountJob } from "./syncAccount";
import { nightlySyncJob } from "./nightlySync";
import { runAuditJob } from "./runAudit";
import { weeklyAuditJob } from "./weeklyAudit";
import { purgeDisconnectedJob } from "./purgeDisconnected";

/** Every background job registered with Inngest. */
export const functions = [healthcheck, discoverAccountsJob, syncAccountJob, nightlySyncJob, runAuditJob, weeklyAuditJob, purgeDisconnectedJob];
