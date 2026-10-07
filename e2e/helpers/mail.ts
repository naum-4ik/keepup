import { expect } from "@playwright/test";

// The local stack's mail catcher (Mailpit, `supabase status` → MAILPIT_URL). The stack is shared, so
// read only; never delete messages.
const MAILPIT = "http://127.0.0.1:54324";

type Summary = { ID: string; Created: string };

async function messagesTo(email: string): Promise<Summary[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  expect(res.ok).toBe(true);
  return ((await res.json()) as { messages: Summary[] }).messages;
}

export async function mailCount(email: string): Promise<number> {
  return (await messagesTo(email)).length;
}

// The first link in the newest email to this address (waits for it to arrive).
export async function latestMailLink(email: string): Promise<string> {
  let id = "";
  await expect
    .poll(async () => {
      const [newest] = (await messagesTo(email)).sort((a, b) => b.Created.localeCompare(a.Created));
      id = newest?.ID ?? "";
      return id;
    }, { message: `an email to ${email}` })
    .not.toBe("");
  const res = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  const { HTML } = (await res.json()) as { HTML: string };
  const href = HTML.match(/href="([^"]+)"/)?.[1];
  if (!href) throw new Error(`No link in the email to ${email}`);
  return href.replaceAll("&amp;", "&");
}
