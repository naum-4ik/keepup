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
