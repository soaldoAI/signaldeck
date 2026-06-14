# Intelligence (Phases 6–8)

Turns synced messages into "what matters". This is where SignalDeck stops
being an inbox mirror and becomes a chief of staff.

## Pieces

- `parse.ts` — pure, DB-free parsing of a model's classification response
  into an `Insight` (`category` / `summary` / `action`). Tolerant of local
  models: strips `<think>` blocks and markdown fences, recovers JSON from
  surrounding prose, normalises category synonyms, and never throws
  (falls back to `fyi`). Unit-tested in isolation.
- `classify.ts` — runs each not-yet-classified message through the
  configured AI provider (`getAiProvider()`) and stores a `MessageInsight`.
  Provider-agnostic: llama3.1 (local, private, default), Claude, or OpenAI
  — switching is a setting, not a code change. Worker-driven and bounded
  per tick so a backlog is chipped away rather than blocking.
- `brief.ts` — pure data shaping: groups classified messages into
  needs-reply / urgent / waiting, collects every extracted action ("what
  needs you"), counts the ignorable, and pulls upcoming events. No AI here
  — the thinking already happened in `classify.ts`. Consumed by the
  dashboard now and the briefing email (Phase 9) next.

## Categories

`needs_reply` · `urgent` · `waiting` · `fyi` · `ignore`. One per message,
plus an optional concrete `action`.

## Notes

- Coverage: the worker classifies **every** synced message (not a sample);
  sync depth is bounded in the Gmail connector (recent window), raise it to
  ingest deeper history at the cost of more local-model time.
- Privacy/capability dial: local llama3.1 keeps everything on the machine;
  Claude/OpenAI are sharper but send message content to the provider. The
  choice is the user's, via the setup wizard.
