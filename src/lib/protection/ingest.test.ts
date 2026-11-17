import { describe, expect, it } from "vitest";
import { clientIp, parsePayload } from "./ingest";

const K = "a".repeat(24);

describe("parsePayload", () => {
  it("accepts a paid click and strips unknown signals", () => {
    const p = parsePayload(JSON.stringify({ t: "click", k: K, gclid: "Cj0KCQ", path: "/", tz: "Europe/London", dh: "abc123", s: { sw: 1920, sh: 1080, evil: "x" } }));
    expect(p).toMatchObject({ t: "click", gclid: "Cj0KCQ", s: { sw: 1920, sh: 1080 } });
    expect(p && "s" in p && "evil" in p.s).toBe(false);
  });

  it("ignores visits that aren't paid clicks, bad keys and junk", () => {
    expect(parsePayload(JSON.stringify({ t: "click", k: K, s: {} }))).toBeNull();
    expect(parsePayload(JSON.stringify({ t: "click", k: "nope", gclid: "x", s: {} }))).toBeNull();
    expect(parsePayload("not json")).toBeNull();
  });

  it("accepts leave-page updates", () => {
    const p = parsePayload(JSON.stringify({ t: "update", k: K, id: "8c1f0fc9-cb75-4591-b535-b2568582c550", dwell: 1200, interacted: false }));
    expect(p).toMatchObject({ t: "update", dwell: 1200 });
  });
});

describe("clientIp", () => {
  it("takes the visitor's address from x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-forwarded-for": "<script>" }))).toBeNull();
    expect(clientIp(new Headers())).toBeNull();
  });
});
