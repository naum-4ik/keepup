import { Sprout } from "lucide-react";

export default function TodayPage() {
  return (
    <section className="py-6">
      <h1 className="text-xl font-bold">Today</h1>
      <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center shadow-soft">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
          <Sprout className="size-6" aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">Nothing to do yet. Habits are coming soon.</p>
      </div>
    </section>
  );
}
