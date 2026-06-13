// Shared shape returned by form server actions to their client forms.
export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export const emptyFormState: FormState = {};
