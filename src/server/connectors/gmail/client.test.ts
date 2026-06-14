import { afterEach, describe, expect, it, vi } from "vitest";
import { getMessage, listRecentMessageIds, parseFrom } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("parseFrom", () => {
  it("splits a name and email", () => {
    expect(parseFrom("Jane Doe <jane@example.com>")).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
    });
  });

  it("strips quotes around the name and lowercases the email", () => {
    expect(parseFrom('"Acme, Inc." <Sales@Acme.COM>')).toEqual({
      name: "Acme, Inc.",
      email: "sales@acme.com",
    });
  });

  it("handles a bare email", () => {
    expect(parseFrom("bob@example.com")).toEqual({
      name: "",
      email: "bob@example.com",
    });
  });
});

function stubGmail(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status: ok ? 200 : 401,
      json: async () => body,
    }) as Response),
  );
}

describe("listRecentMessageIds", () => {
  it("returns ids from the list response", async () => {
    stubGmail({ messages: [{ id: "a" }, { id: "b" }] });
    expect(await listRecentMessageIds("token")).toEqual(["a", "b"]);
  });

  it("returns an empty array when there are no messages", async () => {
    stubGmail({});
    expect(await listRecentMessageIds("token")).toEqual([]);
  });

  it("throws on an API error", async () => {
    stubGmail({}, false);
    await expect(listRecentMessageIds("token")).rejects.toThrow(/Gmail list/);
  });
});

describe("getMessage", () => {
  it("extracts headers, snippet, and received time", async () => {
    stubGmail({
      id: "m1",
      threadId: "t1",
      snippet: "Quick &amp; easy",
      internalDate: "1700000000000",
      payload: {
        headers: [
          { name: "From", value: "Jane <jane@x.com>" },
          { name: "Subject", value: "Hello" },
        ],
      },
    });
    const msg = await getMessage("token", "m1");
    expect(msg.externalId).toBe("m1");
    expect(msg.fromEmail).toBe("jane@x.com");
    expect(msg.subject).toBe("Hello");
    expect(msg.snippet).toBe("Quick & easy");
    expect(msg.receivedAt.getTime()).toBe(1700000000000);
  });

  it("falls back when subject is missing", async () => {
    stubGmail({ id: "m2", threadId: "t2", payload: { headers: [] } });
    const msg = await getMessage("token", "m2");
    expect(msg.subject).toBe("(no subject)");
  });
});
