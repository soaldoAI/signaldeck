import { describe, expect, it } from "vitest";
import { normaliseCategory, parseInsight } from "./parse";

describe("parseInsight", () => {
  it("parses clean JSON", () => {
    const r = parseInsight(
      '{"category":"needs_reply","priority":"high","summary":"Client asks for access","action":"Reply to Sam"}',
    );
    expect(r).toEqual({
      category: "needs_reply",
      priority: "high",
      summary: "Client asks for access",
      action: "Reply to Sam",
    });
  });

  it("recovers JSON from markdown fences", () => {
    const r = parseInsight('```json\n{"category":"urgent","summary":"x","action":""}\n```');
    expect(r.category).toBe("urgent");
  });

  it("strips a reasoning model's <think> block", () => {
    const r = parseInsight(
      '<think>let me consider this carefully</think>\n{"category":"ignore","summary":"newsletter","action":""}',
    );
    expect(r.category).toBe("ignore");
    expect(r.summary).toBe("newsletter");
  });

  it("recovers JSON surrounded by prose", () => {
    const r = parseInsight(
      'Here is my analysis: {"category":"fyi","summary":"FYI note","action":""} Hope that helps!',
    );
    expect(r.category).toBe("fyi");
  });

  it("falls back to fyi on unparseable output", () => {
    expect(parseInsight("I cannot classify this.")).toEqual({
      category: "fyi",
      priority: "low",
      summary: "",
      action: "",
    });
  });

  it("normalises priority synonyms", () => {
    expect(parseInsight('{"category":"urgent","priority":"critical"}').priority).toBe(
      "high",
    );
    expect(parseInsight('{"category":"fyi","priority":"whatever"}').priority).toBe(
      "medium",
    );
  });

  it("clamps overly long fields", () => {
    const long = "x".repeat(500);
    const r = parseInsight(`{"category":"fyi","summary":"${long}","action":""}`);
    expect(r.summary.length).toBe(200);
  });
});

describe("normaliseCategory", () => {
  it("maps synonyms to the enum", () => {
    expect(normaliseCategory("Important")).toBe("urgent");
    expect(normaliseCategory("reply")).toBe("needs_reply");
    expect(normaliseCategory("newsletter")).toBe("ignore");
    expect(normaliseCategory("needs-reply")).toBe("needs_reply");
  });

  it("defaults unknown categories to fyi", () => {
    expect(normaliseCategory("banana")).toBe("fyi");
    expect(normaliseCategory(undefined)).toBe("fyi");
  });
});
