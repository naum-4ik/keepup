// The demo note in the app header, hidden until the browser closes (components/demo/demo-note.tsx):
// a session cookie, so the app layout can leave it out on the server and it never flashes back.
export const DEMO_NOTE_COOKIE = "keepup-demo-note";

// Shows the note again (leaving the demo: the next demo in this browser starts with it). Browser only.
export function forgetDemoNote(): void {
  document.cookie = `${DEMO_NOTE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
