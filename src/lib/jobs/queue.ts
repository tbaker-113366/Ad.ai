import "server-only";
import { after } from "next/server";
import { sendEvents } from "@/inngest/client";

/**
 * Queue a background job with Inngest; if that fails (outage, wrong key),
 * run the same work right after this response instead, so users are never
 * stuck. Scheduled jobs (nightly sync, weekly audit) still need Inngest.
 */
export async function queueOrRun(
  events: Parameters<typeof sendEvents>[0],
  fallback: () => Promise<unknown>,
): Promise<"queued" | "inline"> {
  if (await sendEvents(events)) return "queued";
  const run = async () => {
    try {
      await fallback();
    } catch (err) {
      console.error("inline job failed", { message: err instanceof Error ? err.message : String(err) });
    }
  };
  try {
    after(run);
  } catch {
    // Not inside a request (e.g. called from a job): run it now.
    await run();
  }
  return "inline";
}
