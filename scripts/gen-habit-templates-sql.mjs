// One-off generator for supabase/migrations/20261024100000_habit_template_id.sql (task 8.5, 2026-10-18).
// It wrote that migration: the English template VALUES list from
// supabase/functions/_shared/messages/en.json (adult + group as '<id>', kid as 'kid.<id>'; treats
// and kid groups skipped; fails if a shared English title can't be told apart by kind), and the
// replaced functions copied verbatim from their newest migrations with asserted, minimal edits.
// Usage (from the repo root): node scripts/gen-habit-templates-sql.mjs .
// The migration is applied history now: don't re-run it to change that file; a later change to the
// templates or those functions goes in a new migration.
import { readFileSync, writeFileSync } from "node:fs";

const repo = process.argv[2];
const mig = (f) => readFileSync(`${repo}/supabase/migrations/${f}`, "utf8");
const en = JSON.parse(readFileSync(`${repo}/supabase/functions/_shared/messages/en.json`, "utf8"));

// --- template catalog -------------------------------------------------------------------------
const rows = [];
for (const [id, title] of Object.entries(en.templates)) {
  if (typeof title === "string") rows.push({ id, title, kind: id.startsWith("g-") ? "group" : "adult" });
}
for (const [id, title] of Object.entries(en.templates.kid)) rows.push({ id: `kid.${id}`, title, kind: "kid" });
const re = /^[a-z0-9-]+(\.[a-z0-9-]+)?$/;
for (const r of rows) if (!re.test(r.id) || r.title !== r.title.trim()) throw new Error(`bad template ${r.id}`);
const byTitle = new Map();
for (const r of rows) byTitle.set(r.title, [...(byTitle.get(r.title) ?? []), r]);
const shared = [...byTitle].filter(([, v]) => v.length > 1);
for (const [title, v] of shared) {
  // Each shared title must resolve by kind: at most one candidate per kind.
  const kinds = v.map((r) => r.kind);
  if (new Set(kinds).size !== kinds.length) throw new Error(`unresolvable: ${title}`);
}
console.error("shared titles:", JSON.stringify(shared.map(([t, v]) => [t, v.map((r) => r.id)])));
const q = (s) => `'${s.replace(/'/g, "''")}'`;
const values = rows.map((r) => `    (${q(r.id)}, ${q(r.title)}, ${q(r.kind)})`).join(",\n");

// --- verbatim copies --------------------------------------------------------------------------
function extract(file, header) {
  const src = mig(file);
  const start = src.lastIndexOf(header);
  if (start < 0) throw new Error(`${header} not in ${file}`);
  const end = src.indexOf("\n$$;", start);
  return src.slice(start, end + 4);
}
function sub(text, from, to, count = 1) {
  const n = text.split(from).length - 1;
  if (n !== count) throw new Error(`expected ${count}× ${JSON.stringify(from)}, found ${n}`);
  return text.split(from).join(to);
}

let groupImpl = extract("20260930100100_group_habits.sql", "create function private.create_group_habit_impl(");
groupImpl = sub(groupImpl, "p_children uuid[], p_now timestamptz)", "p_children uuid[], p_now timestamptz, p_template_id text default null)");
groupImpl = sub(groupImpl, "requires_approval, created_by, created_at)", "requires_approval, created_by, created_at, template_id)");
groupImpl = sub(groupImpl, "coalesce(p_requires_approval, false), p_actor, p_now)", "coalesce(p_requires_approval, false), p_actor, p_now, p_template_id)");

let groupPub = extract("20260930100100_group_habits.sql", "create function public.create_group_habit(");
groupPub = sub(groupPub, "p_children uuid[] default '{}')", "p_children uuid[] default '{}', p_template_id text default null)");
groupPub = sub(groupPub, "p_period, p_starts_on, p_requires_approval, p_children, now());", "p_period, p_starts_on, p_requires_approval, p_children, now(), p_template_id);");

let childImpl = extract("20260930100200_children.sql", "create function private.create_child_habit_impl(");
childImpl = sub(childImpl, "p_period public.habit_period, p_starts_on date)", "p_period public.habit_period, p_starts_on date,\n  p_template_id text default null)");
childImpl = sub(childImpl, "starts_on, created_by)", "starts_on, created_by, template_id)");
childImpl = sub(childImpl, "p_starts_on, p_actor)", "p_starts_on, p_actor, p_template_id)");

let childPub = extract("20260930100200_children.sql", "create function public.create_child_habit(");
childPub = sub(childPub, "p_starts_on date default null)", "p_starts_on date default null,\n  p_template_id text default null)");
childPub = sub(childPub, "p_target_count, p_period, p_starts_on);", "p_target_count, p_period, p_starts_on, p_template_id);");

let demo = extract("20261021113700_demo_recaps.sql", "create or replace function private.start_demo_impl(");
demo = sub(demo,
  "starts_on)\n  values (p_user, p_user, 'Drink water', '💧', 'health', 1, 'day', v_today)",
  "starts_on, template_id)\n  values (p_user, p_user, 'Drink water', '💧', 'health', 1, 'day', v_today, 'water')");
demo = sub(demo,
  "starts_on)\n  values (p_user, p_user, 'Meditate', '🧘', 'mind', 1, 'day', v_today)",
  "starts_on, template_id)\n  values (p_user, p_user, 'Meditate', '🧘', 'mind', 1, 'day', v_today, 'meditate')");
demo = sub(demo, "'Family dinner', '🍽️', 'people', 1, 'week', v_today, false, '{}', p_now))",
  "'Family dinner', '🍽️', 'people', 1, 'week', v_today, false, '{}', p_now, 'g-family-dinner'))");
demo = sub(demo, "'Brush teeth', '🪥', 2, 'day', v_today))", "'Brush teeth', '🪥', 2, 'day', v_today, 'kid.brush-teeth'))");

const SUMMARY_COLS = "  my_role text, members jsonb)";
let subj = extract("20260930100100_group_habits.sql", "create function private.subject_summaries(");
subj = sub(subj, SUMMARY_COLS, "  my_role text, members jsonb, template_id text)");
subj = sub(subj, "             join public.profiles p on p.id = x.id)\n         end\n", "             join public.profiles p on p.id = x.id)\n         end,\n         h.template_id\n");
let habitSum = extract("20260930100100_group_habits.sql", "create function public.habit_summaries()");
habitSum = sub(habitSum, SUMMARY_COLS, "  my_role text, members jsonb, template_id text)");
let childSum = extract("20260930100200_children.sql", "create function public.child_summaries(");
childSum = sub(childSum, SUMMARY_COLS, "  my_role text, members jsonb, template_id text)");

const PENDING_COLS = "  local_date date, created_at timestamptz, review_deadline timestamptz)";
let pendImpl = extract("20261006100000_offline_check_ins.sql", "create or replace function private.pending_approvals_impl(");
pendImpl = sub(pendImpl, "create or replace function", "create function");
pendImpl = sub(pendImpl, PENDING_COLS, "  local_date date, created_at timestamptz, review_deadline timestamptz, habit_template text)");
pendImpl = sub(pendImpl, "c.local_date, c.created_at, private.check_in_deadline(h, c)\n", "c.local_date, c.created_at, private.check_in_deadline(h, c), h.template_id\n");
let pendPub = extract("20260930100300_feed_nudges_cheers.sql", "create function public.pending_approvals()");
pendPub = sub(pendPub, PENDING_COLS, "  local_date date, created_at timestamptz, review_deadline timestamptz, habit_template text)");

let push = extract("20261023100000_languages.sql", "create or replace function private.push_job_build(");
push = sub(push, "'habit', h.title, 'period', h.period,", "'habit', h.title, 'habit_template', h.template_id, 'period', h.period,");
push = sub(push, "'habit', pa.habit_title)", "'habit', pa.habit_title,\n                                                    'habit_template', pa.habit_template)");

const INBOX_COLS = "  subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb)";
let inboxImpl = extract("20261009110000_polish.sql", "create function private.inbox_feed_impl(");
inboxImpl = sub(inboxImpl, INBOX_COLS, "  subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb, habit_template text)");
inboxImpl = sub(inboxImpl, "s.display_name, s.avatar_emoji, n.payload\n", "s.display_name, s.avatar_emoji, n.payload, h.template_id\n");
let inboxPub = extract("20261009110000_polish.sql", "create function public.inbox_feed(");
inboxPub = sub(inboxPub, INBOX_COLS, "  subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb, habit_template text)");

let week = extract("20261009130000_calendar_group_habits.sql", "create or replace function private.week_overview_impl(");
week = sub(week, "select h as habit, h.id, h.title, h.period,", "select h as habit, h.id, h.title, h.template_id, h.period,", 2);
week = sub(week, "select b.title, b.period, st.current_streak", "select b.title, b.template_id, b.period, st.current_streak");
week = sub(week, "select hs.id, hs.title, hs.period, hs.created_at from hs", "select hs.id, hs.title, hs.template_id, hs.period, hs.created_at from hs");
week = sub(week, "select gs.id, gs.title, gs.period, gs.created_at from gs", "select gs.id, gs.title, gs.template_id, gs.period, gs.created_at from gs");
week = sub(week, "    'best_current_streak_title', (select b.title from best b),\n",
  "    'best_current_streak_title', (select b.title from best b),\n    'best_current_streak_template', (select b.template_id from best b),\n");

const FAM_COLS = "               best_streak int, best_period public.habit_period)";
let famImpl = extract("20260930100400_kid_rewards_celebrations.sql", "create function private.family_recaps_impl(");
famImpl = sub(famImpl, FAM_COLS, "               best_streak int, best_period public.habit_period, best_template text)");
famImpl = sub(famImpl, "         b.title, b.emoji, b.current_streak, b.period\n", "         b.title, b.emoji, b.current_streak, b.period, b.template_id\n");
famImpl = sub(famImpl, "      select h.title, h.emoji, h.period, st.current_streak\n", "      select h.title, h.emoji, h.period, st.current_streak, h.template_id\n");
let famPub = extract("20260930100400_kid_rewards_celebrations.sql", "create function public.family_recaps(");
famPub = sub(famPub, FAM_COLS, "               best_streak int, best_period public.habit_period, best_template text)");

const sql = `-- Habits remember which template they came from (plans/2026-10-15-keepup-languages.md, task 8.5):
-- a template habit shows its name in each viewer's language; a hand-typed name stays as typed. The
-- app reads it in the next PR. Ids are the catalog keys (supabase/functions/_shared/messages/en.json
-- → templates): '<id>' for adult and group templates, 'kid.<id>' for kid templates. No FK: the
-- templates live in the app catalog.
--
-- Replaced functions are copied from their latest definitions; only template_id is added:
--   private.create_group_habit_impl, public.create_group_habit   20260930100100_group_habits.sql
--   private.create_child_habit_impl, public.create_child_habit   20260930100200_children.sql
--   private.start_demo_impl                                      20261021113700_demo_recaps.sql
--   private.subject_summaries, public.habit_summaries            20260930100100_group_habits.sql
--   public.child_summaries                                       20260930100200_children.sql
--   private.pending_approvals_impl                               20261006100000_offline_check_ins.sql
--   public.pending_approvals                                     20260930100300_feed_nudges_cheers.sql
--   private.push_job_build                                       20261023100000_languages.sql
--   private.inbox_feed_impl, public.inbox_feed                   20261009110000_polish.sql
--   private.week_overview_impl                                   20261009130000_calendar_group_habits.sql
--   private.family_recaps_impl, public.family_recaps             20260930100400_kid_rewards_celebrations.sql
-- New return columns go last (drop + create; the public wrappers select * from the impls).

-- 1. The column. The app inserts habits itself (lib/habit-create.ts), so it may set it on insert.
alter table public.habits
  add column template_id text constraint habits_template_id_check check (template_id ~ '^[a-z0-9-]+(\\.[a-z0-9-]+)?$');
grant insert (template_id) on public.habits to authenticated;

-- 2. The English template titles, generated from en.json (adult, group and kid; treats are not
-- habits). kind: 'adult', 'group' (g-*) or 'kid'.
create function private.habit_templates_en()
returns table (id text, title text, kind text)
language sql
immutable
set search_path = ''
as $$
  values
${values};
$$;
revoke execute on function private.habit_templates_en() from public, anon, authenticated;

-- 3. Backfill: a habit whose title is exactly a template's English title gets that template. A kid's
-- habit (owner kind 'child') matches kid templates; anyone else's matches adult and group templates.
-- A title two templates share goes to the one of the habit's own kind (a group habit → the group
-- template; a personal one → the adult template); still two → none. Habits with an id are left alone.
create function private.backfill_habit_template_ids()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_count int;
begin
  with hk as (
    select h.id, h.title,
           case when h.group_id is not null then 'group' when p.kind = 'child' then 'kid' else 'adult' end as kind
      from public.habits h
      left join public.profiles p on p.id = h.owner_id
     where h.template_id is null
  ),
  cand as (
    select hk.id as habit_id, t.id as template_id, t.kind = hk.kind as same_kind
      from hk
      join private.habit_templates_en() t on t.title = btrim(hk.title)
     where (t.kind = 'kid') = (hk.kind = 'kid')
  ),
  pick as (
    select c.habit_id,
           case when count(*) = 1 then min(c.template_id)
                when count(*) filter (where c.same_kind) = 1 then min(c.template_id) filter (where c.same_kind)
           end as template_id
      from cand c
     group by c.habit_id
  )
  update public.habits h set template_id = pick.template_id
    from pick
   where pick.habit_id = h.id and pick.template_id is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function private.backfill_habit_template_ids() from public, anon, authenticated;

select private.backfill_habit_template_ids();

-- 4. A new name is the person's own: renaming drops the template, unless the same update sets one.
create function private.habit_template_on_rename()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.template_id := null;
  return new;
end;
$$;
revoke execute on function private.habit_template_on_rename() from public, anon, authenticated;

create trigger habits_template_on_rename
  before update of title on public.habits
  for each row
  when (new.title is distinct from old.title and new.template_id is not distinct from old.template_id)
  execute function private.habit_template_on_rename();

-- 5. Create paths take the template (optional, last; the demo calls the impls positionally).
drop function public.create_group_habit(uuid, text, text, public.habit_category, smallint, public.habit_period, date, boolean, uuid[]);
drop function private.create_group_habit_impl(uuid, uuid, text, text, public.habit_category, int, public.habit_period, date, boolean, uuid[], timestamptz);
${groupImpl}
revoke execute on function private.create_group_habit_impl(uuid, uuid, text, text, public.habit_category, int, public.habit_period, date, boolean, uuid[], timestamptz, text)
  from public, anon, authenticated;

${groupPub}
revoke execute on function public.create_group_habit(uuid, text, text, public.habit_category, smallint, public.habit_period, date, boolean, uuid[], text)
  from public, anon;
grant execute on function public.create_group_habit(uuid, text, text, public.habit_category, smallint, public.habit_period, date, boolean, uuid[], text)
  to authenticated;

drop function public.create_child_habit(uuid, text, text, smallint, public.habit_period, date);
drop function private.create_child_habit_impl(uuid, uuid, text, text, int, public.habit_period, date);
${childImpl}
revoke execute on function private.create_child_habit_impl(uuid, uuid, text, text, int, public.habit_period, date, text)
  from public, anon, authenticated;

${childPub}
revoke execute on function public.create_child_habit(uuid, text, text, smallint, public.habit_period, date, text) from public, anon;
grant execute on function public.create_child_habit(uuid, text, text, smallint, public.habit_period, date, text) to authenticated;

-- The demo's template habits (Drink water, Meditate, Family dinner, Brush teeth) carry their template.
${demo}

-- 6. Reads: Today, Progress and the kid view.
drop function public.habit_summaries();
drop function public.child_summaries(uuid);
drop function private.subject_summaries(uuid, timestamptz);
${subj}

${habitSum}

${childSum}
revoke execute on function public.habit_summaries(), public.child_summaries(uuid) from public, anon;
grant execute on function public.habit_summaries(), public.child_summaries(uuid) to authenticated;

-- 7. Reads: approvals (the Inbox list and the approval pushes).
drop function public.pending_approvals();
drop function private.pending_approvals_impl(uuid, timestamptz);
${pendImpl}

${pendPub}
revoke execute on function public.pending_approvals() from public, anon;
grant execute on function public.pending_approvals() to authenticated;

-- 8. Reads: pushes (habit_template next to habit, also in the pending list).
${push}
revoke execute on function private.push_job_build(uuid, timestamptz) from public, anon, authenticated;

-- 9. Reads: the Inbox feed.
drop function public.inbox_feed(int);
drop function private.inbox_feed_impl(uuid, int);
${inboxImpl}
${inboxPub}
revoke execute on function public.inbox_feed(int) from public, anon;
grant execute on function public.inbox_feed(int) to authenticated;

-- 10. Reads: Progress's week overview (best_current_streak_template next to its title).
${week}

-- 11. Reads: Today's weekly family card (best_template next to best_title).
drop function public.family_recaps();
drop function private.family_recaps_impl(uuid, timestamptz);
${famImpl}
${famPub}
revoke execute on function public.family_recaps() from public, anon;
grant execute on function public.family_recaps() to authenticated;
`;
writeFileSync(`${repo}/supabase/migrations/20261024100000_habit_template_id.sql`, sql);
console.error(`templates: ${rows.length}`);
