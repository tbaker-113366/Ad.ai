import { describe, expect, it } from "vitest";
import { sanitiseError, withJobRun, type JobRunStore } from "./jobRun";

function memoryStore() {
  const rows: Record<string, Record<string, unknown>> = {};
  const store: JobRunStore = {
    async start(input) {
      const id = `run-${Object.keys(rows).length + 1}`;
      rows[id] = { ...input, status: "running" };
      return id;
    },
    async finish(id, result) {
      rows[id] = { ...rows[id], ...result };
    },
  };
  return { store, rows };
}

describe("withJobRun", () => {
  it("records a successful run with operations and metadata", async () => {
    const { store, rows } = memoryStore();
    const out = await withJobRun(store, { jobName: "test.job", businessId: "b1" }, async (ctx) => {
      ctx.addApiOperations(3);
      ctx.addApiOperations(2);
      ctx.setMetadata("rows", 10);
      return "done";
    });
    expect(out).toBe("done");
    expect(rows["run-1"]).toMatchObject({
      jobName: "test.job",
      businessId: "b1",
      adAccountId: null,
      status: "succeeded",
      apiOperationsUsed: 5,
      metadata: { rows: 10 },
      error: null,
    });
  });

  it("records a failed run and rethrows", async () => {
    const { store, rows } = memoryStore();
    await expect(
      withJobRun(store, { jobName: "test.fail" }, async (ctx) => {
        ctx.addApiOperations(1);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(rows["run-1"]).toMatchObject({ status: "failed", apiOperationsUsed: 1, error: "Error: boom" });
  });

  it("rejects invalid operation counts", async () => {
    const { store, rows } = memoryStore();
    await expect(withJobRun(store, { jobName: "x" }, async (ctx) => ctx.addApiOperations(-1))).rejects.toThrow(
      RangeError,
    );
    expect(rows["run-1"].status).toBe("failed");
  });
});

describe("sanitiseError", () => {
  it("redacts tokens", () => {
    const msg = sanitiseError(new Error('refresh_token="1//abc.def" access_token: ya29.xyz secret=shh'));
    expect(msg).not.toContain("1//abc.def");
    expect(msg).not.toContain("ya29.xyz");
    expect(msg).not.toContain("shh");
    expect(msg).toContain("[redacted]");
  });

  it("truncates long errors", () => {
    expect(sanitiseError("x".repeat(5000))).toHaveLength(2000);
  });
});
