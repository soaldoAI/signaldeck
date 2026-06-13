import type { ConnectorDescriptor, ConnectorHealth } from "./types";

// The connector catalogue. Adding a source is adding an entry here (and,
// once connectable, its implementation module) — no other architecture
// changes. The setup wizard and dashboard render straight from this.

export const CONNECTORS: readonly ConnectorDescriptor[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Understand what needs a reply across your inbox.",
    icon: "✉️",
    authMethod: "oauth",
    edition: "community",
    available: false, // Phase 4
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "See what your day actually requires.",
    icon: "📅",
    authMethod: "oauth",
    edition: "community",
    available: false, // Phase 5
  },
  {
    id: "slack",
    name: "Slack",
    description: "Catch the threads that need you. (Pro)",
    icon: "💬",
    authMethod: "oauth",
    edition: "pro",
    available: false,
  },
];

export function getConnector(id: string): ConnectorDescriptor | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

/**
 * Current health of every connector for this instance. Until connector
 * sync lands (Phase 4), nothing is connected, so all report
 * `not_connected`. The shape is already what the dashboard will consume.
 */
export function getConnectorCatalogue(): ConnectorHealth[] {
  return CONNECTORS.map((descriptor) => ({
    descriptor,
    status: "not_connected" as const,
    detail: descriptor.available ? "Ready to connect" : "Coming soon",
  }));
}
