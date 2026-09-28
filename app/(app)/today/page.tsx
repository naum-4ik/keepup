import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export default function TodayPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-xl font-semibold">Today</h1>
      <p className="mt-2 text-sm text-muted-foreground">Signed in.</p>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="outline">Sign out</Button>
      </form>
    </main>
  );
}
