import "server-only";
import { cookies } from "next/headers";
import { TOAST_COOKIE, TOAST_COOKIE_MAX_AGE, isSafeHref, serializeFlash, type Flash } from "@/lib/toast";

// In a server action, before redirect(): the next page shows a status toast (lib/toast.ts).
//   await flashToast({ text: "habits.toast.added", values: { habit: title }, action: { label: "common.open", href: `/habits/${id}` } });
//   redirect("/today");
// `text` and `action.label` are catalog keys in a client namespace (i18n/client-namespaces.ts); the
// Toaster translates them in the viewer's language. Not httpOnly: the Toaster clears it once shown.
export async function flashToast(flash: Omit<Flash, "id" | "at">): Promise<void> {
  if (flash.action && !isSafeHref(flash.action.href)) throw new Error(`flashToast: not an in-app path: ${flash.action.href}`);
  (await cookies()).set(TOAST_COOKIE, serializeFlash({ id: crypto.randomUUID(), at: Date.now(), ...flash }), {
    path: "/",
    maxAge: TOAST_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}
