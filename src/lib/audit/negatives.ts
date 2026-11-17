import type { RecommendedAction } from "./types";

/** Negative keywords in Google Ads match-type syntax: [exact] and "phrase". */
export function negativeKeywordList(actions: RecommendedAction[]): string[] {
  const out = new Set<string>();
  for (const a of actions) {
    if (a.type !== "negative_keyword.add") continue;
    out.add(a.payload.matchType === "EXACT" ? `[${a.payload.text}]` : `"${a.payload.text}"`);
  }
  return [...out];
}
