import { describe, expect, it } from "vitest";
import { friendlyAuthError, safeNext, signInSchema, signUpSchema } from "./forms";

describe("auth forms", () => {
  it("validates sign-up", () => {
    expect(signUpSchema.safeParse({ email: " Owner@Example.co.uk ", password: "longenough" }).data).toEqual({
      email: "owner@example.co.uk",
      password: "longenough",
    });
    expect(signUpSchema.safeParse({ email: "nope", password: "longenough" }).error?.issues[0].message).toBe("Enter a valid email address");
    expect(signUpSchema.safeParse({ email: "a@b.co", password: "short" }).error?.issues[0].message).toMatch(/at least 8/);
  });

  it("needs a password to sign in", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("only allows same-site next paths", () => {
    expect(safeNext("/onboarding/business?website=a.com")).toBe("/onboarding/business?website=a.com");
    expect(safeNext("//evil.com")).toBe("/start");
    expect(safeNext("https://evil.com")).toBe("/start");
    expect(safeNext(null, "/dashboard")).toBe("/dashboard");
  });

  it("explains common errors plainly", () => {
    expect(friendlyAuthError("Invalid login credentials")).toMatch(/don't match/);
    expect(friendlyAuthError("User already registered")).toMatch(/already an account/);
    expect(friendlyAuthError("Email not confirmed")).toMatch(/confirm your email/);
    expect(friendlyAuthError("Password should be at least 8 characters.")).toMatch(/stronger password/);
    expect(friendlyAuthError("email rate limit exceeded")).toMatch(/Too many attempts/);
    expect(friendlyAuthError("Error sending confirmation email")).toMatch(/couldn't send you an email/);
    expect(friendlyAuthError("something odd")).toBe("Something went wrong. Please try again.");
  });
});
