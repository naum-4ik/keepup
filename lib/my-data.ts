// Settings → Your data: Export my data and Delete account (M6). Copy lives here, next to its helpers.
export const DELETE_WORD = "delete";
export const DELETE_TITLE = "Delete your account?";
export const DELETE_BODY =
  "Your account, habits, check-ins, XP, badges and Inbox are deleted right away. This can't be undone.";
export const EXPORT_HINT = "A file with everything Keepup keeps about you.";
export const EXPORT_FIRST = "Export your data first if you want a copy.";
// A failed delete after the phone was cleared: a reload brings back the check-in queue and push.
export const DELETE_FAILED = "Couldn't delete your account. Reload Keepup and try again.";
// The landing page, right after a delete (app/page.tsx, ?deleted=1).
export const DELETED_NOTE = "Your account and data are deleted.";

export type DeletePreview = {
  groups_deleted: { name: string; children: string[] }[];
  admin_handover: { group: string; new_admin: string }[];
};

export function isDeleteWord(typed: string): boolean {
  return typed.trim().toLowerCase() === DELETE_WORD;
}

export function myDataFileName(today: Date): string {
  return `keepup-my-data-${today.toISOString().slice(0, 10)}.json`;
}

function names(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function deletePreviewLines(p: DeletePreview): string[] {
  return [
    ...p.groups_deleted.map((g) =>
      g.children.length === 0
        ? `${g.name} will be deleted.`
        : `${g.name} will be deleted, with ${names(g.children.map((c) => `${c}'s`))} profile${g.children.length > 1 ? "s" : ""}.`,
    ),
    ...p.admin_handover.map((h) => `${h.new_admin} becomes the admin of ${h.group}.`),
  ];
}

// The confirm button's steps (components/profile/my-data.tsx). Online, waiting check-ins are sent
// first (as at sign-out), so only taps that couldn't be sent anyway are lost. Then the phone is
// cleared, before the delete, because a successful delete redirects and nothing runs after it.
// remove resolves only on failure. Returns the error to show, if any.
export async function runDelete(steps: {
  flush: () => Promise<void>;
  clearPhone: () => Promise<void>;
  remove: () => Promise<{ ok: false; message: string } | undefined>;
}): Promise<string | null> {
  try {
    await steps.flush();
  } catch (e) {
    console.error("delete account: sending waiting check-ins", e);
  }
  await steps.clearPhone();
  const r = await steps.remove();
  return r && !r.ok ? DELETE_FAILED : null;
}
