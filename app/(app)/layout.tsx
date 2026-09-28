import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-shell/app-header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { getProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getProfile();
  if (!profile.onboarded_at) redirect("/onboarding");

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader displayName={profile.display_name} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
