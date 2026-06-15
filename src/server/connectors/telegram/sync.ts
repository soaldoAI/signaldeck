// Telegram sync: pulls recent messages into the unified `messages` store,
// where they get classified into the brief just like email. Runs on the
// worker schedule. The session is stored encrypted in the account's
// accessToken field (Telegram sessions don't expire like OAuth tokens).

import { prisma } from "@/server/db/client";
import { decryptSecret } from "@/server/crypto/secrets";
import { markHealth, type ConnectorAccount } from "@/server/connectors/accounts";
import { createClient, fetchRecentMessages } from "./client";

export interface TelegramSyncResult {
  fetched: number;
  newMessages: number;
}

/** Sync one Telegram account. */
export async function syncTelegramAccount(
  account: ConnectorAccount,
): Promise<TelegramSyncResult> {
  const session = decryptSecret(account.accessToken);
  const client = createClient(session);
  await client.connect();

  try {
    const messages = await fetchRecentMessages(client);
    const ids = messages.map((m) => m.externalId);

    const existing = await prisma.message.findMany({
      where: { accountId: account.id, externalId: { in: ids } },
      select: { externalId: true },
    });
    const seen = new Set(existing.map((m) => m.externalId));
    const fresh = messages.filter((m) => !seen.has(m.externalId));

    for (const m of fresh) {
      await prisma.message.create({
        data: {
          accountId: account.id,
          connectorId: account.connectorId,
          externalId: m.externalId,
          threadId: m.threadId,
          fromName: m.fromName,
          fromEmail: "",
          subject: m.subject,
          snippet: m.snippet,
          receivedAt: m.receivedAt,
        },
      });
    }

    await prisma.connectorAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date(), status: "connected", detail: "" },
    });

    return { fetched: messages.length, newMessages: fresh.length };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

/** Sync every connected Telegram account; used by the worker. */
export async function syncAllTelegram(): Promise<void> {
  const accounts = await prisma.connectorAccount.findMany({
    where: { connectorId: "telegram", status: { not: "disconnected" } },
  });
  for (const account of accounts) {
    try {
      const result = await syncTelegramAccount(account);
      console.log(
        `[worker] synced telegram ${account.label}: ${result.fetched} messages`,
      );
    } catch (error) {
      await markHealth(account.id, "needs_attention", "Sync failed — re-login");
      console.error(`[worker] telegram sync error for ${account.label}`, error);
    }
  }
}
