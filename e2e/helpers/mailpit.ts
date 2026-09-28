const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const LINK = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/;

export async function latestMagicLink(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`);
    if (search.ok) {
      const { messages } = (await search.json()) as { messages?: { ID: string }[] };
      const id = messages?.[0]?.ID;
      if (id) {
        const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as {
          HTML?: string;
          Text?: string;
        };
        const match = `${message.HTML ?? ""}\n${message.Text ?? ""}`.match(LINK);
        if (match) return match[0].replaceAll("&amp;", "&");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No magic link for ${email} within ${timeoutMs}ms`);
}
