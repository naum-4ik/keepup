import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

// Passkeys ("Sign in with Face ID") work only on the host the Supabase RP ID was set up for:
// Vercel preview URLs and 127.0.0.1 can't use them, so every passkey UI hides there.
export function passkeysAvailable({
  hostname,
  rpId,
  hasWebAuthn,
}: {
  hostname: string;
  rpId: string | undefined;
  hasWebAuthn: boolean;
}): boolean {
  if (!hasWebAuthn || !rpId) return false;
  return hostname === rpId;
}

export function passkeysAvailableHere(): boolean {
  if (typeof window === "undefined") return false;
  return passkeysAvailable({
    hostname: window.location.hostname,
    rpId: process.env.NEXT_PUBLIC_PASSKEY_RP_ID,
    hasWebAuthn: typeof window.PublicKeyCredential === "function",
  });
}

export type PasskeyErrorKind = "cancelled" | "unsupported" | "disabled" | "exists" | "other";

type ErrorLike = { code?: unknown; name?: unknown; message?: unknown; cause?: { name?: unknown } };

// Supabase returns WebAuthnError (browser ceremony) or AuthError (server); duck-typed so we don't
// depend on @supabase/auth-js directly.
export function passkeyErrorKind(error: unknown): PasskeyErrorKind {
  const e = (error ?? {}) as ErrorLike;
  const causeName = e.cause?.name;
  if (e.code === "ERROR_CEREMONY_ABORTED" || e.name === "NotAllowedError" || e.name === "AbortError") return "cancelled";
  if (e.code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY" && (causeName === "NotAllowedError" || causeName === "AbortError")) {
    return "cancelled";
  }
  if (e.code === "passkey_disabled") return "disabled";
  if (e.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || e.code === "webauthn_credential_exists") return "exists";
  if (typeof e.message === "string" && /does not support WebAuthn/i.test(e.message)) return "unsupported";
  return "other";
}

const COPY: Record<"signIn" | "setUp", Record<Exclude<PasskeyErrorKind, "cancelled">, string>> = {
  signIn: {
    unsupported: "This browser can't use Face ID here. Use Google or email instead.",
    disabled: "Face ID sign-in isn't switched on yet. Use Google or email instead.",
    exists: "Couldn't sign in with Face ID. Use Google or email instead.",
    other: "Couldn't sign in with Face ID. Use Google or email instead.",
  },
  setUp: {
    unsupported: "This browser can't set up Face ID.",
    disabled: "Face ID sign-in isn't switched on yet.",
    exists: "Face ID is already set up on this device.",
    other: "Couldn't set up Face ID. Try again in a moment.",
  },
};

// null means "say nothing" (the user closed the Face ID sheet themselves).
export function passkeyErrorMessage(error: unknown, action: "signIn" | "setUp"): string | null {
  const kind = passkeyErrorKind(error);
  return kind === "cancelled" ? null : COPY[action][kind];
}

// A readable default name for a new passkey, e.g. "iPhone Safari" or "Mac Chrome".
export function deviceLabel(userAgent: string): string {
  const ua = userAgent;
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : /Linux/.test(ua)
                ? "Linux"
                : "";
  const browser = /EdgA?\//.test(ua)
    ? "Edge"
    : /FxiOS|Firefox\//.test(ua)
      ? "Firefox"
      : /CriOS|Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return [device, browser].filter(Boolean).join(" ") || "This device";
}

export function isGenericName(name: string | undefined): boolean {
  return !name || name.trim().toLowerCase() === "passkey";
}

export type Passkey = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

type Result<T> = { ok: true; data: T } | { ok: false; error: unknown };

// Thin wrappers over supabase.auth passkey calls: never throw, always return a result.
async function attempt<T>(run: () => Promise<{ data: T | null; error: unknown }>): Promise<Result<T>> {
  try {
    const { data, error } = await run();
    if (error) return { ok: false, error };
    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function listPasskeys(): Promise<Result<Passkey[]>> {
  const result = await attempt(() => createClient().auth.passkey.list());
  if (!result.ok) return result;
  return {
    ok: true,
    data: (result.data ?? []).map((p) => ({
      id: p.id,
      name: p.friendly_name || "Passkey",
      createdAt: p.created_at,
      lastUsedAt: p.last_used_at ?? null,
    })),
  };
}

export async function registerPasskey(): Promise<Result<null>> {
  const supabase = createClient();
  const result = await attempt(() => supabase.auth.registerPasskey());
  if (!result.ok) return result;
  // Supabase names a passkey after its authenticator (e.g. "iCloud Keychain") when it knows it,
  // else a bare "Passkey"; only the bare default gets this device's name. Cosmetic: a failed
  // rename still leaves a working passkey.
  if (result.data && isGenericName(result.data.friendly_name)) {
    await attempt(() =>
      supabase.auth.passkey.update({ passkeyId: result.data.id, friendlyName: deviceLabel(navigator.userAgent) }),
    );
  }
  return { ok: true, data: null };
}

export async function deletePasskey(passkeyId: string): Promise<Result<null>> {
  return attempt(() => createClient().auth.passkey.delete({ passkeyId }));
}

export async function signInWithPasskey(): Promise<Result<null>> {
  const result = await attempt(() => createClient().auth.signInWithPasskey());
  return result.ok ? { ok: true, data: null } : result;
}

const noSubscribe = () => () => {};

// false on the server and during hydration, so passkey UI only appears once the browser confirms it.
export function usePasskeysAvailable(): boolean {
  return useSyncExternalStore(noSubscribe, passkeysAvailableHere, () => false);
}
