import { afterEach, describe, expect, it, vi } from "vitest";
import { listUpcomingEvents, normalizeEvent } from "./client";
import { scopesForConnector } from "../google/oauth";

afterEach(() => vi.unstubAllGlobals());

describe("normalizeEvent", () => {
  it("normalises a timed event", () => {
    const e = normalizeEvent({
      id: "e1",
      summary: "Standup",
      location: "Zoom",
      organizer: { displayName: "Jane", email: "jane@x.com" },
      start: { dateTime: "2026-06-15T09:00:00Z" },
      end: { dateTime: "2026-06-15T09:30:00Z" },
    });
    expect(e.title).toBe("Standup");
    expect(e.organizer).toBe("Jane");
    expect(e.allDay).toBe(false);
    expect(e.startsAt.toISOString()).toBe("2026-06-15T09:00:00.000Z");
    expect(e.endsAt?.toISOString()).toBe("2026-06-15T09:30:00.000Z");
  });

  it("flags an all-day event", () => {
    const e = normalizeEvent({ id: "e2", start: { date: "2026-06-20" } });
    expect(e.allDay).toBe(true);
    expect(e.title).toBe("(no title)");
  });

  it("falls back to organizer email when no display name", () => {
    const e = normalizeEvent({
      id: "e3",
      organizer: { email: "bob@x.com" },
      start: { dateTime: "2026-06-15T10:00:00Z" },
    });
    expect(e.organizer).toBe("bob@x.com");
  });
});

describe("listUpcomingEvents", () => {
  it("filters cancelled and start-less events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: "ok", summary: "Real", start: { dateTime: "2026-06-15T09:00:00Z" } },
            { id: "x", status: "cancelled", start: { dateTime: "2026-06-15T09:00:00Z" } },
            { id: "y", summary: "No time" },
          ],
        }),
      }) as Response),
    );
    const events = await listUpcomingEvents("token");
    expect(events.map((e) => e.externalId)).toEqual(["ok"]);
  });

  it("throws on an API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }) as Response),
    );
    await expect(listUpcomingEvents("token")).rejects.toThrow(/Calendar list/);
  });
});

describe("scopesForConnector", () => {
  it("requests gmail.readonly for gmail", () => {
    expect(scopesForConnector("gmail").join(" ")).toContain("gmail.readonly");
  });
  it("requests calendar.readonly for google_calendar", () => {
    expect(scopesForConnector("google_calendar").join(" ")).toContain(
      "calendar.readonly",
    );
  });
});
