# AI provider abstraction (Phase 3)

A single `AiProvider` interface with Anthropic, OpenAI, and Ollama
implementations. All AI usage in SignalDeck goes through this module —
no other module may import a provider SDK or call a provider's HTTP API
directly.

## Contract

```ts
interface AiProvider {
  id: "anthropic" | "openai" | "ollama";
  model: string;                                   // default if a request doesn't override
  generate(request): Promise<{ text, model }>;     // single-shot; throws on error
  testConnection(): Promise<{ ok, detail }>;       // never throws; zero token cost
}
```

- `createProvider(config)` — build from an explicit config (used by the
  wizard's *Test connection*, on unsaved input). Lives in `factory.ts`,
  which has **no** settings/DB dependency so the provider layer is
  unit-testable without a database.
- `getAiProvider()` — build from the encrypted settings store
  (`getAiConfig()`). The normal runtime entry point.

## Implementation notes

- **No SDKs.** Each provider is a thin `fetch` call against the REST API
  (Anthropic Messages, OpenAI Chat Completions, Ollama `/api/chat`). This
  keeps dependencies minimal and the worker bundle lean. All calls run
  through `providers/http.ts`, which enforces a hard timeout.
- **Model-generation-safe.** Requests omit `temperature` / `thinking`
  so they stay valid across every current Claude model (newer models
  reject those params).
- **Cheap connection test.** `testConnection()` hits each provider's
  model-list endpoint (`/v1/models`, Ollama `/api/tags`) — it validates
  the key/server without spending tokens. Model access is validated on
  first real use.

## Defaults

Chosen for SignalDeck's workload (high-volume classification, extraction,
briefing) — all overridable in the setup wizard:

| Provider  | Default model      | Why                                        |
| --------- | ------------------ | ------------------------------------------ |
| Anthropic | `claude-haiku-4-5` | Cost-effective for bulk classification.    |
| OpenAI    | `gpt-4o-mini`      | Cost-effective equivalent.                 |
| Ollama    | `llama3.1`         | Sensible local default; fully private.     |

Prompts and response parsing for specific features (classification,
action extraction, briefing) live with those features, not here.
