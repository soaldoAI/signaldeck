"use client";

import { useActionState } from "react";
import { Field, Input, SubmitButton } from "@/app/_components/ui";
import { emptyFormState } from "@/app/_lib/form-state";
import { login } from "./actions";

export function LoginForm() {
  const [state, formAction] = useActionState(login, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      <Field label="Email" name="email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" name="password">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
