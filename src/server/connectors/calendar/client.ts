// Minimal Google Calendar API client (read-only) over fetch. Fetches
// upcoming events from the primary calendar — enough to tell the user what
// their day requires.

const API_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary";

export interface CalendarEventData {
  externalId: string;
  title: string;
  location: string;
  organizer: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
}

interface EventTime {
  dateTime?: string; // RFC3339, timed events
  date?: string; // YYYY-MM-DD, all-day events
}
interface ApiEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  organizer?: { email?: string; displayName?: string };
  start?: EventTime;
  end?: EventTime;
}
interface ListResponse {
  items?: ApiEvent[];
}

/**
 * List upcoming events from now through the next `days` days, expanding
 * recurring events into individual instances, ordered by start time.
 */
export async function listUpcomingEvents(
  accessToken: string,
  options: { days?: number; max?: number } = {},
): Promise<CalendarEventData[]> {
  const now = new Date();
  const timeMax = new Date(now.getTime() + (options.days ?? 7) * 86_400_000);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(options.max ?? 50),
  });

  const response = await fetch(`${API_BASE}/events?${params.toString()}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Calendar list failed (HTTP ${response.status})`);
  }
  const body = (await response.json()) as ListResponse;
  return (body.items ?? [])
    .filter((e) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date))
    .map(normalizeEvent);
}

export function normalizeEvent(event: ApiEvent): CalendarEventData {
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startsAt = new Date(
    (event.start?.dateTime ?? event.start?.date) as string,
  );
  const endRaw = event.end?.dateTime ?? event.end?.date;
  return {
    externalId: event.id,
    title: event.summary?.trim() || "(no title)",
    location: event.location?.trim() ?? "",
    organizer:
      event.organizer?.displayName?.trim() ||
      event.organizer?.email?.trim() ||
      "",
    startsAt,
    endsAt: endRaw ? new Date(endRaw) : null,
    allDay,
  };
}
