"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Field, Input, SubmitButton } from "@/app/_components/ui";
import { emptyFormState } from "@/app/_lib/form-state";
import type { ConnectorHealth } from "@/server/connectors/types";
import type { TestResult } from "@/server/ai";
import { completeSetup } from "./actions";
import { testAiConnection } from "./ai-actions";

type Provider = "anthropic" | "openai" | "ollama";

const PROVIDERS: { id: Provider; name: string; note: string }[] = [
  { id: "ollama", name: "Ollama", note: "Fully local — nothing leaves your machine" },
  { id: "anthropic", name: "Claude", note: "Anthropic API" },
  { id: "openai", name: "OpenAI", note: "OpenAI API" },
];

interface SmtpDefaults {
  host: string;
  port: number;
  from: string;
}

export function SetupForm({
  connectors,
  smtpDefaults,
}: {
  connectors: ConnectorHealth[];
  smtpDefaults: SmtpDefaults;
}) {
  const [state, formAction] = useActionState(completeSetup, emptyFormState);
  const [provider, setProvider] = useState<Provider>("ollama");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, startTest] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors;

  function handleTestConnection() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    setTestResult(null);
    startTest(async () => {
      const result = await testAiConnection({
        provider: String(data.get("aiProvider") ?? ""),
        model: String(data.get("aiModel") ?? ""),
        anthropicApiKey: String(data.get("anthropicApiKey") ?? ""),
        openaiApiKey: String(data.get("openaiApiKey") ?? ""),
        ollamaBaseUrl: String(data.get("ollamaBaseUrl") ?? ""),
      });
      setTestResult(result);
    });
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <SectionHeading step={1} title="Create your account" />
        <Field label="Email" name="email" errors={errors}>
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field
          label="Password"
          name="password"
          hint="At least 8 characters."
          errors={errors}
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading step={2} title="Choose your AI" />
        <p className="text-sm text-muted">
          SignalDeck only ever sends your messages to the provider you pick
          here. With Ollama, they never leave this machine.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                provider === p.id
                  ? "border-accent ring-2 ring-accent/20"
                  : "border-border"
              }`}
            >
              <input
                type="radio"
                name="aiProvider"
                value={p.id}
                checked={provider === p.id}
                onChange={() => setProvider(p.id)}
                className="sr-only"
              />
              <span className="font-medium">{p.name}</span>
              <span className="mt-1 block text-xs text-muted">{p.note}</span>
            </label>
          ))}
        </div>

        {provider === "anthropic" && (
          <Field label="Anthropic API key" name="anthropicApiKey" errors={errors}>
            <Input name="anthropicApiKey" type="password" placeholder="sk-ant-…" />
          </Field>
        )}
        {provider === "openai" && (
          <Field label="OpenAI API key" name="openaiApiKey" errors={errors}>
            <Input name="openaiApiKey" type="password" placeholder="sk-…" />
          </Field>
        )}
        {provider === "ollama" && (
          <Field
            label="Ollama server URL"
            name="ollamaBaseUrl"
            errors={errors}
          >
            <Input
              name="ollamaBaseUrl"
              defaultValue="http://localhost:11434"
            />
          </Field>
        )}
        <Field
          label="Model"
          name="aiModel"
          hint="Optional — leave blank for the provider default."
          errors={errors}
        >
          <Input name="aiModel" placeholder="e.g. llama3.1 / claude-… / gpt-…" />
        </Field>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="self-start rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:border-accent disabled:opacity-60"
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
          {testResult && (
            <p
              className={`text-sm ${
                testResult.ok
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {testResult.ok ? "✓ " : "✗ "}
              {testResult.detail}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading step={3} title="Email delivery" />
        <p className="text-sm text-muted">
          How your daily briefing is sent. The defaults work out of the box
          with the bundled mail server for local use.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SMTP host" name="smtpHost" errors={errors}>
            <Input name="smtpHost" defaultValue={smtpDefaults.host} required />
          </Field>
          <Field label="SMTP port" name="smtpPort" errors={errors}>
            <Input
              name="smtpPort"
              type="number"
              defaultValue={smtpDefaults.port}
              required
            />
          </Field>
          <Field label="Username" name="smtpUser" hint="Optional" errors={errors}>
            <Input name="smtpUser" autoComplete="off" />
          </Field>
          <Field label="Password" name="smtpPassword" hint="Optional" errors={errors}>
            <Input name="smtpPassword" type="password" autoComplete="off" />
          </Field>
        </div>
        <Field label="From address" name="smtpFrom" errors={errors}>
          <Input name="smtpFrom" defaultValue={smtpDefaults.from} required />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading step={4} title="Connect your channels" />
        <p className="text-sm text-muted">
          After setup you&apos;ll connect accounts from your dashboard — one
          click each. Here&apos;s what&apos;s coming:
        </p>
        <ul className="flex flex-col gap-2">
          {connectors.map(({ descriptor, detail }) => (
            <li
              key={descriptor.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <span aria-hidden>{descriptor.icon}</span>
              <span className="font-medium">{descriptor.name}</span>
              <span className="ml-auto text-xs text-muted">{detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <SubmitButton>Finish setup</SubmitButton>
    </form>
  );
}

function SectionHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
        {step}
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}
