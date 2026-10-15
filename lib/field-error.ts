import type { T } from "@/supabase/functions/_shared/i18n";

// What a validator returns for a bad field: a catalog key and its values. Whoever shows it renders it.
export type FieldError = { key: string; values?: Record<string, string | number> };

export const errorText = (t: T, e: FieldError): string => t(e.key, e.values);

// A form's field errors as the text to show under each field.
export function errorTexts<K extends string>(t: T, errors: Partial<Record<K, FieldError>> | undefined): Partial<Record<K, string>> {
  return Object.fromEntries(Object.entries<FieldError | undefined>(errors ?? {}).flatMap(([k, e]) => (e ? [[k, errorText(t, e)]] : []))) as Partial<Record<K, string>>;
}
