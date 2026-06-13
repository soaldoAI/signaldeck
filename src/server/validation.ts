import { z } from "zod";

// Shared validation schemas. Server actions parse untrusted form input
// through these before touching the database, so every action has one
// obvious trust boundary.

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters");

export const aiProviderSchema = z.enum(["anthropic", "openai", "ollama"]);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

/**
 * Full first-run setup payload: admin account + AI provider + email
 * delivery. Conditional rules ensure the chosen AI provider has the
 * credential it needs, so onboarding can't complete half-configured.
 */
export const setupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    aiProvider: aiProviderSchema,
    aiModel: z.string().trim().optional().default(""),
    anthropicApiKey: z.string().trim().optional().default(""),
    openaiApiKey: z.string().trim().optional().default(""),
    ollamaBaseUrl: z
      .string()
      .trim()
      .optional()
      .default("http://localhost:11434"),
    smtpHost: z.string().trim().min(1, "SMTP host is required"),
    smtpPort: z.coerce.number().int().positive("Port must be a number"),
    smtpUser: z.string().trim().optional().default(""),
    smtpPassword: z.string().optional().default(""),
    smtpFrom: z.string().trim().min(1, "From address is required"),
  })
  .superRefine((data, ctx) => {
    if (data.aiProvider === "anthropic" && !data.anthropicApiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["anthropicApiKey"],
        message: "An Anthropic API key is required for Claude",
      });
    }
    if (data.aiProvider === "openai" && !data.openaiApiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["openaiApiKey"],
        message: "An OpenAI API key is required",
      });
    }
    if (data.aiProvider === "ollama" && !data.ollamaBaseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ollamaBaseUrl"],
        message: "An Ollama server URL is required",
      });
    }
  });

export type SetupInput = z.infer<typeof setupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
