// A server action called from a click (docs/design.md "States and feedback": an error says what
// happened and what to do). Offline, nothing is sent and the answer says to check the connection. A
// request that dies on the way throws: offline by then, the same message; still online, the page
// itself may be stale (a deploy), so it says to reload. `rethrow`: next/navigation unstable_rethrow,
// so a redirect() from the action (which arrives as a thrown error) still happens. Kept free of Next
// so it is unit-tested (lib/reach.test.ts).
export type Unreached = { ok: false; message: string };

export async function reach<R>(
  call: () => Promise<R>,
  messages: { offline: string; reload: string },
  opts: { online?: () => boolean; rethrow?: (e: unknown) => void } = {},
): Promise<R | Unreached> {
  const online = opts.online ?? (() => typeof navigator === "undefined" || navigator.onLine);
  if (!online()) return { ok: false, message: messages.offline };
  try {
    return await call();
  } catch (e) {
    opts.rethrow?.(e);
    return { ok: false, message: online() ? messages.reload : messages.offline };
  }
}
