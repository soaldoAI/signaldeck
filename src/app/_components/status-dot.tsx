import type { ConnectorStatus } from "@/server/connectors/types";

// Health indicator: green connected, yellow needs attention, red
// disconnected, neutral never-connected. Carries an accessible label.
const STYLES: Record<ConnectorStatus, { color: string; label: string }> = {
  connected: { color: "bg-emerald-500", label: "Connected" },
  needs_attention: { color: "bg-amber-500", label: "Needs attention" },
  disconnected: { color: "bg-red-500", label: "Disconnected" },
  not_connected: { color: "bg-stone-300 dark:bg-stone-600", label: "Not connected" },
};

export function StatusDot({ status }: { status: ConnectorStatus }) {
  const { color, label } = STYLES[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
