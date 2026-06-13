// Connector type contract. See README.md in this directory for the full
// design. These types are framework-agnostic and safe to import from
// client components (they carry no secrets and no server-only code).

/** How a connector authenticates, in order of preference. */
export type AuthMethod = "oauth" | "browser_extension" | "local_import" | "mcp";

/** Health of a connected account, surfaced as a coloured indicator. */
export type ConnectorStatus =
  | "connected" // green: syncing normally
  | "needs_attention" // yellow: e.g. token expiring, re-auth soon
  | "disconnected" // red: auth lost, action required
  | "not_connected"; // neutral: never connected

/** Static description of a connector, shown in the setup catalogue. */
export interface ConnectorDescriptor {
  id: string;
  name: string;
  /** One-line value proposition for the catalogue card. */
  description: string;
  /** Emoji or short glyph used until real icons land. */
  icon: string;
  authMethod: AuthMethod;
  /** Community Edition vs a future Pro connector. */
  edition: "community" | "pro";
  /**
   * Whether the connect flow is implemented yet. Connectors can be
   * listed (so users see the roadmap) before they are connectable.
   */
  available: boolean;
}

/** Live state of a connector for a given instance. */
export interface ConnectorHealth {
  descriptor: ConnectorDescriptor;
  status: ConnectorStatus;
  /** Human-readable detail, e.g. "Last synced 2 minutes ago". */
  detail: string;
}
