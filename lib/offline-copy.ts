// lib/offline-copy.ts
// The offline UI's words, one place each (ideas/offline.md §3). Feed notes live in the shared copy sheet.
export const OFFLINE_BANNER = "Offline · showing your last update";
export const NEEDS_CONNECTION = "Needs a connection";
export const SAVING = "Saving… ☁️";
export const UNDO = "Undo";
export const undoLabel = (habit: string) => `Undo check-in for ${habit}`;
export const COULDNT_SAVE = "A check-in couldn't be saved. Please add it again.";

// Sign-out with check-ins still on the phone (lib/push-support.ts signOutWithQueue).
export const unsavedSignOut = (n: number) =>
  n === 1
    ? "1 check-in hasn't been saved yet. Sign out anyway? It'll be removed from this phone."
    : `${n} check-ins haven't been saved yet. Sign out anyway? They'll be removed from this phone.`;
export const SIGN_OUT_ANYWAY = "Sign out anyway";
export const STAY_SIGNED_IN = "Stay signed in";
