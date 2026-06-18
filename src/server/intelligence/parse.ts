// Pure parsing of a model's classification response. Kept DB-free so it
// can be unit-tested in isolation and reused by the classifier.

export const CATEGORIES = [
  "needs_reply",
  "waiting",
  "urgent",
  "fyi",
  "ignore",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Insight {
  category: Category;
  priority: Priority;
  summary: string;
  action: string;
}

/** Normalise model-supplied priority to high | medium | low. */
export function normalisePriority(raw: unknown): Priority {
  const value = String(raw ?? "").toLowerCase().trim();
  if ((PRIORITIES as readonly string[]).includes(value)) return value as Priority;
  const synonyms: Record<string, Priority> = {
    urgent: "high",
    critical: "high",
    important: "high",
    normal: "medium",
    med: "medium",
    moderate: "medium",
    minor: "low",
    none: "low",
    later: "low",
    can_wait: "low",
  };
  return synonyms[value.replace(/[\s-]+/g, "_")] ?? "medium";
}

/** Normalise model-supplied categories (synonyms, casing) to our enum. */
export function normaliseCategory(raw: unknown): Category {
  const value = String(raw ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if ((CATEGORIES as readonly string[]).includes(value)) return value as Category;
  const synonyms: Record<string, Category> = {
    important: "urgent",
    reply: "needs_reply",
    respond: "needs_reply",
    needsreply: "needs_reply",
    action_required: "needs_reply",
    waiting_on: "waiting",
    info: "fyi",
    informational: "fyi",
    none: "ignore",
    spam: "ignore",
    promotion: "ignore",
    newsletter: "ignore",
    notification: "ignore",
  };
  return synonyms[value] ?? "fyi";
}

/**
 * Parse a model response into an Insight. Tolerant of the messiness local
 * models produce: <think> blocks, markdown fences, leading/trailing prose.
 * Never throws — falls back to a safe "fyi" when no JSON can be recovered.
 */
export function parseInsight(raw: string): Insight {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "") // strip reasoning scratchpad
    .replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      return {
        category: normaliseCategory(obj.category),
        priority: normalisePriority(obj.priority),
        summary: String(obj.summary ?? "").trim().slice(0, 200),
        action: String(obj.action ?? "").trim().slice(0, 200),
      };
    } catch {
      // fall through to default
    }
  }
  return { category: "fyi", priority: "low", summary: "", action: "" };
}
