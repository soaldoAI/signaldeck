// Google Calendar sync: pulls upcoming events into the `calendar_events`
// store. Runs inline on connect and on the worker schedule. Upcoming events
// are refreshed each run (re-fetched and upserted), since times and details
// change and past events fall out of the window.

import { prisma } from "@/server/db/client";
import {
  getValidAccessToken,
  markHealth,
  ReauthRequiredError,
  type ConnectorAccount,
} from "@/server/connectors/accounts";
import { listUpcomingEvents } from "./client";

export interface CalendarSyncResult {
  events: number;
}

/** Sync one calendar account: replace the upcoming-events window. */
export async function syncCalendarAccount(
  account: ConnectorAccount,
): Promise<CalendarSyncResult> {
  const accessToken = await getValidAccessToken(account);
  const events = await listUpcomingEvents(accessToken, { days: 7 });

  for (const event of events) {
    await prisma.calendarEvent.upsert({
      where: {
        accountId_externalId: {
          accountId: account.id,
          externalId: event.externalId,
        },
      },
      create: {
        accountId: account.id,
        connectorId: account.connectorId,
        externalId: event.externalId,
        title: event.title,
        location: event.location,
        organizer: event.organizer,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
      },
      update: {
        title: event.title,
        location: event.location,
        organizer: event.organizer,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
      },
    });
  }

  // Drop events that have fallen out of the upcoming window (past or
  // cancelled), so the dashboard only shows what's still ahead.
  await prisma.calendarEvent.deleteMany({
    where: { accountId: account.id, startsAt: { lt: new Date() } },
  });

  await prisma.connectorAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date(), status: "connected", detail: "" },
  });

  return { events: events.length };
}

/** Sync every connected calendar account; used by the worker. */
export async function syncAllCalendars(): Promise<void> {
  const accounts = await prisma.connectorAccount.findMany({
    where: { connectorId: "google_calendar", status: { not: "disconnected" } },
  });
  for (const account of accounts) {
    try {
      const result = await syncCalendarAccount(account);
      console.log(
        `[worker] synced calendar ${account.label}: ${result.events} events`,
      );
    } catch (error) {
      if (error instanceof ReauthRequiredError) {
        console.log(`[worker] calendar ${account.label} needs reconnect`);
      } else {
        await markHealth(account.id, "needs_attention", "Sync failed");
        console.error(`[worker] calendar sync error for ${account.label}`, error);
      }
    }
  }
}
