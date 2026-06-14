// Shared fetch helper for provider calls. Adds a hard timeout so a wrong
// URL or an unreachable Ollama server can't hang a request or the worker.

const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON response (e.g. an HTML error page); keep the raw text.
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/** Turn an unknown thrown value into a readable one-line message. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "AbortError" ? "Request timed out" : error.message;
  }
  return String(error);
}
