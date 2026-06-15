// One-time Telegram login. Run: `npm run telegram:login`.
//
// Prompts for phone / code / 2FA, mints an MTProto session, and stores it
// encrypted as a Telegram connector account for the single admin user. The
// worker then syncs Telegram messages into the brief automatically.

import readline from "node:readline/promises";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { prisma } from "@/server/db/client";
import { encryptSecret } from "@/server/crypto/secrets";
import { telegramConfig } from "@/server/connectors/telegram/client";

async function main(): Promise<void> {
  const { apiId, apiHash } = telegramConfig();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error("No admin account yet — finish the setup wizard first.");
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () =>
      (await rl.question("Phone number (with country code, e.g. +61…): ")).trim(),
    phoneCode: async () =>
      (await rl.question("Login code Telegram just sent you: ")).trim(),
    password: async () =>
      (await rl.question("2FA password (press Enter if you have none): ")).trim(),
    onError: (err) => console.error("Telegram login error:", err.message ?? err),
  });

  const session = String(client.session.save());
  const me = await client.getMe();
  const label =
    "username" in me && me.username
      ? `@${me.username}`
      : "phone" in me && me.phone
        ? `+${me.phone}`
        : "Telegram";

  await prisma.connectorAccount.upsert({
    where: { userId_connectorId: { userId: user.id, connectorId: "telegram" } },
    create: {
      userId: user.id,
      connectorId: "telegram",
      externalId: String(me.id),
      label,
      accessToken: encryptSecret(session),
      refreshToken: "",
      status: "connected",
    },
    update: {
      externalId: String(me.id),
      label,
      accessToken: encryptSecret(session),
      status: "connected",
      detail: "",
    },
  });

  console.log(`\n✓ Telegram connected as ${label}. The worker will sync shortly.`);
  await client.disconnect();
  await prisma.$disconnect();
  rl.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
