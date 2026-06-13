// Shared server service (app + worker): no `server-only` guard. See the
// note in src/server/settings/index.ts.
import nodemailer from "nodemailer";
import { getSmtpConfig, type SmtpConfig } from "@/server/settings";

// Thin SMTP wrapper. The daily briefing (Phase 9) is the only sender for
// now; this also powers the "send test email" check in setup so users
// confirm delivery works before they rely on it.

function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // Implicit TLS on 465; STARTTLS/none otherwise. Local Mailpit (1025)
    // needs no auth, so only pass credentials when a user is set.
    secure: config.port === 465,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  });
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/** Send an email using the stored SMTP configuration. */
export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendResult> {
  const config = await getSmtpConfig();
  try {
    const transport = createTransport(config);
    await transport.sendMail({ from: config.from, ...message });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Verify SMTP settings without sending — used by the setup wizard. */
export async function verifySmtp(config: SmtpConfig): Promise<SendResult> {
  try {
    await createTransport(config).verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
