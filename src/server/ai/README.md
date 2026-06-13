# AI provider abstraction (Phase 3)

A single `AiProvider` interface with Anthropic, OpenAI, and Ollama
implementations. All AI usage in SignalDeck goes through this module —
no other module may import a provider SDK directly.

Design constraints:

- Provider is chosen by configuration (`AI_PROVIDER`), not code.
- Prompts and response parsing live with the feature that owns them
  (classification, action extraction, briefing), not here.
- Ollama support is first-class: SignalDeck must work fully offline.
