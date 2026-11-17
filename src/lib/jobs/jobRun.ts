/**
 * Wraps a background job so every run is recorded in job_runs (spec section 5:
 * audit trail + quota tracking). The store is injected so the wrapper is
 * unit-testable without a database.
 */
export type JobRunStatus = "running" | "succeeded" | "failed";

export interface JobRunContext {
  jobRunId: string;
  /** Record Google Ads API operations used, for daily quota tracking. */
  addApiOperations(count: number): void;
  /** Attach structured metadata to the run (merged on finish). */
  setMetadata(key: string, value: unknown): void;
}

export interface JobRunStore {
  start(input: { jobName: string; businessId: string | null; adAccountId: string | null }): Promise<string>;
  finish(
    id: string,
    result: {
      status: Exclude<JobRunStatus, "running">;
      apiOperationsUsed: number;
      metadata: Record<string, unknown>;
      error: string | null;
    },
  ): Promise<void>;
}

export interface JobRunOptions {
  jobName: string;
  businessId?: string | null;
  adAccountId?: string | null;
}

/** Never write secrets into job_runs.error. */
export function sanitiseError(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return raw
    .replace(/(refresh_token|access_token|token|secret|password|authorization)(["'\s:=]+)[^\s"',}]+/gi, "$1$2[redacted]")
    .replace(/\bya29\.[\w.-]+/g, "[redacted]")
    .replace(/\b1\/\/[\w.-]+/g, "[redacted]")
    .slice(0, 2000);
}

export async function withJobRun<T>(
  store: JobRunStore,
  opts: JobRunOptions,
  fn: (ctx: JobRunContext) => Promise<T>,
): Promise<T> {
  const jobRunId = await store.start({
    jobName: opts.jobName,
    businessId: opts.businessId ?? null,
    adAccountId: opts.adAccountId ?? null,
  });

  let apiOperationsUsed = 0;
  const metadata: Record<string, unknown> = {};
  const ctx: JobRunContext = {
    jobRunId,
    addApiOperations(count) {
      if (!Number.isInteger(count) || count < 0) throw new RangeError(`Invalid operation count: ${count}`);
      apiOperationsUsed += count;
    },
    setMetadata(key, value) {
      metadata[key] = value;
    },
  };

  try {
    const result = await fn(ctx);
    await store.finish(jobRunId, { status: "succeeded", apiOperationsUsed, metadata, error: null });
    return result;
  } catch (err) {
    await store.finish(jobRunId, { status: "failed", apiOperationsUsed, metadata, error: sanitiseError(err) });
    throw err;
  }
}
