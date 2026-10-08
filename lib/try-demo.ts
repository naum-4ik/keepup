// "Try it" in the browser (components/demo/try-demo-button.tsx). Returns "failed" for DEMO_FAILED; on
// success the seed action redirects, which reaches here as a rejection that `rethrow` passes on.
export async function runTryIt(steps: {
  hasSession: () => Promise<boolean>;
  signIn: () => Promise<{ error: unknown }>;
  start: () => Promise<void>;
  signOut: () => Promise<void>;
  // next/navigation's unstable_rethrow: lets the action's redirect through.
  rethrow: (e: unknown) => void;
}): Promise<"failed" | null> {
  // A stale landing tab after signing in elsewhere: a new anonymous login would replace that session.
  // The seed action sends a real login to Today (a leftover demo login: re-seeding is a no-op).
  const fresh = !(await steps.hasSession());
  if (fresh) {
    const { error } = await steps.signIn();
    if (error) return "failed";
  }
  try {
    await steps.start();
    return null;
  } catch (e) {
    steps.rethrow(e);
    console.error("demo: seeding", e);
    // An unseeded anonymous login would land in onboarding as a guest; drop it. Never a session we found.
    if (fresh) await steps.signOut();
    return "failed";
  }
}

// The demo banner's "Sign in" (components/demo/leave-demo-button.tsx). The phone is cleared the way
// Delete account clears it (the demo login is deleted within 24 hours), then the session ends and
// leaveDemo redirects to /login; that redirect is a rejection `rethrow` passes on. Queued check-ins
// aren't sent first: demo taps are thrown away with the demo. Returns "failed" if the sign-out broke.
export async function runLeaveDemo(steps: {
  clearPhone: () => Promise<void>;
  leave: () => Promise<void>;
  rethrow: (e: unknown) => void;
}): Promise<"failed" | null> {
  try {
    await steps.clearPhone();
  } catch (e) {
    console.error("demo: clearing the phone", e);
  }
  try {
    await steps.leave();
    return null;
  } catch (e) {
    steps.rethrow(e);
    console.error("demo: leaving", e);
    return "failed";
  }
}
