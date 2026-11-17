import { describe, expect, it } from "vitest";
import { formatCustomerId } from "./format";

describe("formatCustomerId", () => {
  it("adds dashes like the Google Ads UI", () => {
    expect(formatCustomerId("1234567890")).toBe("123-456-7890");
    expect(formatCustomerId("abc")).toBe("abc");
  });
});
