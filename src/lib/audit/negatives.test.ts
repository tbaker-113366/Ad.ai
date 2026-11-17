import { describe, expect, it } from "vitest";
import { negativeKeywordList } from "./negatives";

describe("negativeKeywordList", () => {
  it("formats exact and phrase negatives, de-duplicated, ignoring other actions", () => {
    expect(
      negativeKeywordList([
        { type: "negative_keyword.add", payload: { level: "campaign", campaignId: "1", text: "plumber jobs", matchType: "EXACT" } },
        { type: "negative_keyword.add", payload: { level: "shared_list", text: "free", matchType: "PHRASE" } },
        { type: "negative_keyword.add", payload: { level: "campaign", campaignId: "2", text: "plumber jobs", matchType: "EXACT" } },
        { type: "manual", payload: { description: "x" } },
      ]),
    ).toEqual(["[plumber jobs]", '"free"']);
  });
});
