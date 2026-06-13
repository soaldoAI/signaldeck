# Server modules

Server-only code. Nothing in here may be imported from client
components.

| Module        | Phase | Responsibility                                  |
| ------------- | ----- | ----------------------------------------------- |
| `db/`         | 1     | Prisma client singleton.                         |
| `ai/`         | 3     | Provider abstraction (Anthropic/OpenAI/Ollama).  |
| `connectors/` | 4–6   | Source integrations and message normalisation.   |

Modules added by later phases (classification, actions, briefing) get
their own directory here, each with a README stating its contract.
