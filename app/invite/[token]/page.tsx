import Image from "next/image";
import Link from "next/link";
import { GoogleIcon } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import { GROUP_KIND_EMOJI, isGroupKind } from "@/lib/group-schema";
import { createClient } from "@/lib/supabase/server";
import { signInWithGoogle } from "@/app/login/actions";
import { acceptInvite } from "./actions";
import { JoinButton } from "./join-button";

// Outside (app) so it works signed out: the anonymous client may call invite_preview only.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: claims }, { data: rows, error }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.rpc("invite_preview", { p_token: token }),
  ]);
  if (error) console.error("invite_preview failed", error.message);
  const preview = rows?.[0];

  if (!preview) {
    return (
      <InviteCard>
        <h1 className="text-2xl font-bold">This invite link doesn&apos;t work anymore</h1>
        <p className="text-sm text-muted-foreground">Ask the person who sent it for a new one.</p>
        <Button asChild variant="outline" className="h-12 w-full rounded-xl text-base">
          <Link href="/">Go to Keepup</Link>
        </Button>
      </InviteCard>
    );
  }

  const group = preview.group_name;
  const emoji = isGroupKind(preview.group_kind) ? GROUP_KIND_EMOJI[preview.group_kind] : GROUP_KIND_EMOJI.other;
  const n = preview.member_count;
  const next = `/invite/${token}`;
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const memberOf = claims?.claims ? await currentGroupOf(supabase, token) : null;

  return (
    <InviteCard>
      <h1 className="text-2xl font-bold">
        {preview.inviter_name} invited you to {group} <span aria-hidden>{emoji}</span>
      </h1>
      <p className="text-sm text-muted-foreground">
        {n === 1 ? `1 person is already in ${group}.` : `${n} people are already in ${group}.`}
      </p>
      {memberOf ? (
        <Button asChild className="h-12 w-full rounded-xl text-base">
          <Link href={`/groups/${memberOf}`}>Open {group}</Link>
        </Button>
      ) : claims?.claims ? (
        <JoinButton action={acceptInvite.bind(null, token)} groupName={group} />
      ) : (
        <div className="flex flex-col gap-2">
          {googleEnabled ? (
            <>
              <form action={signInWithGoogle}>
                <input type="hidden" name="next" value={next} />
                <Button type="submit" className="h-12 w-full gap-3 rounded-xl text-base">
                  <span className="flex size-6 items-center justify-center rounded-full bg-card">
                    <GoogleIcon className="size-4" />
                  </span>
                  Join with Google
                </Button>
              </form>
              <Button asChild variant="ghost" className="h-11 text-base text-primary">
                <Link href={`/login?next=${encodeURIComponent(next)}`}>Use email instead</Link>
              </Button>
            </>
          ) : (
            // Google is off (local stacks): email is the only way in, so it's the main button.
            <Button asChild className="h-12 w-full rounded-xl text-base">
              <Link href={`/login?next=${encodeURIComponent(next)}`}>Continue with email</Link>
            </Button>
          )}
        </div>
      )}
    </InviteCard>
  );
}

// Already in the group: the group's id, so the page offers Open instead of Join. invite_preview
// doesn't return the group, and invite rows are readable by the group's admins only (RLS), so this
// finds admins (e.g. opening their own link); a plain member still sees Join, which changes nothing
// for a current member (accept_invite). Confirmed against my_groups.
async function currentGroupOf(supabase: Awaited<ReturnType<typeof createClient>>, token: string): Promise<string | null> {
  const [{ data: invite }, { data: mine }] = await Promise.all([
    supabase.from("group_invites").select("group_id").eq("token", token).maybeSingle(),
    supabase.rpc("my_groups"),
  ]);
  return invite && (mine ?? []).some((g) => g.group_id === invite.group_id) ? invite.group_id : null;
}

function InviteCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="flex flex-col gap-5 rounded-2xl bg-card p-6 text-center shadow-soft">
        <Image src="/icons/icon-192.png" alt="" width={56} height={56} className="mx-auto rounded-2xl" priority />
        {children}
      </div>
    </main>
  );
}
