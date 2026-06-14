// Minimal Gmail API client (read-only) over fetch. Fetches recent message
// metadata — enough to drive classification and the briefing without
// downloading full message bodies.

const API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailMessage {
  externalId: string;
  threadId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  receivedAt: Date;
}

interface ListResponse {
  messages?: Array<{ id: string }>;
  nextPageToken?: string;
}

interface GetResponse {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string; // epoch ms as string
  payload?: { headers?: Array<{ name: string; value: string }> };
}

async function gmailGet(
  accessToken: string,
  path: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

/**
 * List ids of recent messages, newest first. `afterEpochSec` limits to
 * messages received after a point (incremental sync); `max` caps the count
 * so the first sync is fast enough to power an immediate briefing.
 */
export async function listRecentMessageIds(
  accessToken: string,
  options: { afterEpochSec?: number; max?: number } = {},
): Promise<string[]> {
  const max = options.max ?? 50;
  const q = options.afterEpochSec
    ? `after:${options.afterEpochSec}`
    : "newer_than:7d";
  const params = new URLSearchParams({ maxResults: String(max), q });
  const { ok, status, body } = await gmailGet(
    accessToken,
    `/messages?${params.toString()}`,
  );
  if (!ok) throw new Error(`Gmail list failed (HTTP ${status})`);
  return ((body as ListResponse).messages ?? []).map((m) => m.id);
}

/** Fetch metadata (headers + snippet) for one message. */
export async function getMessage(
  accessToken: string,
  id: string,
): Promise<GmailMessage> {
  const params = new URLSearchParams({ format: "metadata" });
  for (const h of ["From", "Subject", "Date"]) params.append("metadataHeaders", h);
  const { ok, status, body } = await gmailGet(
    accessToken,
    `/messages/${id}?${params.toString()}`,
  );
  if (!ok) throw new Error(`Gmail get failed (HTTP ${status})`);

  const msg = body as GetResponse;
  const headers = new Map(
    (msg.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]),
  );
  const from = parseFrom(headers.get("from") ?? "");
  const receivedAt = msg.internalDate
    ? new Date(Number(msg.internalDate))
    : new Date();

  return {
    externalId: msg.id,
    threadId: msg.threadId,
    fromName: from.name,
    fromEmail: from.email,
    subject: headers.get("subject") ?? "(no subject)",
    snippet: decodeEntities(msg.snippet ?? ""),
    receivedAt,
  };
}

/** Parse a `From` header like `"Jane Doe <jane@x.com>"` into name + email. */
export function parseFrom(value: string): { name: string; email: string } {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  }
  const email = value.trim().toLowerCase();
  return { name: "", email };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
