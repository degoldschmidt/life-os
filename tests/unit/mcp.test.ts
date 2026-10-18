import { describe, expect, it } from "vitest";
import { bearerMatches } from "@/lib/mcp/auth";
import { matchHabit } from "@/lib/mcp/tools";
import { likePattern } from "@/lib/services/notes";

describe("bearerMatches", () => {
  const secret = "a-long-enough-secret-token-123";
  it("accepts only the exact token", () => {
    expect(bearerMatches(`Bearer ${secret}`, secret)).toBe(true);
    expect(bearerMatches(`bearer ${secret}`, secret)).toBe(true);
    expect(bearerMatches(`Bearer ${secret}x`, secret)).toBe(false);
    expect(bearerMatches(`Bearer ${secret.slice(0, -1)}`, secret)).toBe(false);
    expect(bearerMatches(secret, secret)).toBe(false);
    expect(bearerMatches(null, secret)).toBe(false);
  });
  it("refuses when no secret, or a weak one, is configured", () => {
    expect(bearerMatches("Bearer abc", undefined)).toBe(false);
    expect(bearerMatches("Bearer short", "short")).toBe(false);
  });
});

describe("matchHabit", () => {
  const habits = [{ id: "1", name: "Stretch" }, { id: "2", name: "Read 20 min" }, { id: "3", name: "Read a paper" }];
  it("matches by id, exact name, or a unique fragment", () => {
    expect(matchHabit(habits, "1")).toMatchObject({ name: "Stretch" });
    expect(matchHabit(habits, "stretch")).toMatchObject({ id: "1" });
    expect(matchHabit(habits, "20 min")).toMatchObject({ id: "2" });
  });
  it("reports ambiguous and missing matches", () => {
    expect(matchHabit(habits, "read")).toBe("ambiguous");
    expect(matchHabit(habits, "swim")).toBeNull();
  });
});

describe("likePattern", () => {
  it("escapes wildcards", () => {
    expect(likePattern("100%_done")).toBe("%100\\%\\_done%");
  });
});
