import { describe, expect, it } from "vitest";
import { newState, statesMatch } from "./state";

describe("oauth state", () => {
  it("is random and long", () => {
    expect(newState()).not.toBe(newState());
    expect(newState().length).toBeGreaterThanOrEqual(43);
  });

  it("matches only identical values", () => {
    const s = newState();
    expect(statesMatch(s, s)).toBe(true);
    expect(statesMatch(s, newState())).toBe(false);
    expect(statesMatch(undefined, s)).toBe(false);
    expect(statesMatch(s, null)).toBe(false);
    expect(statesMatch(s, s.slice(1))).toBe(false);
  });
});
