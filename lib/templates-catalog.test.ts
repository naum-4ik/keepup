import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER, categoryLabel } from "@/lib/categories";
import { GROUP_TEMPLATES } from "@/lib/group-templates";
import { HABIT_TEMPLATES, templateTitle } from "@/lib/habit-templates";
import { tEn } from "@/lib/i18n/test-t";
import { KID_TEMPLATE_GROUPS, KID_TEMPLATES, kidGroupLabel, kidTemplateTitle } from "@/lib/kid-templates";
import { TREAT_IDEAS, treatTitle } from "@/lib/treat-ideas";

// The English the templates, treat ideas and categories had before they moved into the catalog. The
// catalog must keep saying exactly this: these are the titles people's habits are created with.
const HABIT_TITLES: Record<string, string> = {
  water: "Drink water",
  sleep: "Sleep by 23:00",
  vitamins: "Take vitamins or meds",
  veggies: "Eat fruit or vegetables",
  "brush-teeth": "Brush teeth",
  "wake-up": "Wake up before 07:00",
  steps: "Walk 10,000 steps",
  workout: "Work out",
  stretch: "Stretch",
  run: "Run",
  yoga: "Yoga",
  "swim-cycle": "Swim or cycle",
  meditate: "Meditate",
  journal: "Journal",
  gratitude: "Gratitude: write 3 things",
  "no-phone-bed": "No phone in bed",
  outside: "Time outside",
  pray: "Pray",
  read: "Read 20 min",
  language: "Learn a language",
  instrument: "Practice an instrument",
  podcast: "Podcast or course",
  study: "Study",
  write: "Write",
  call: "Call family or a friend",
  message: "Message someone you miss",
  "kids-time": "Phone-free time with the kids",
  "date-night": "Date night",
  kind: "Do something kind",
  "screen-free-dinner": "Screen-free dinner",
  tidy: "Tidy up",
  bed: "Make the bed",
  cook: "Cook at home",
  plants: "Water the plants",
  laundry: "Laundry",
  kitchen: "Clean the kitchen",
  "plan-tomorrow": "Plan tomorrow",
  "deep-work": "Deep-work block",
  "no-work-email": "No work email after 19:00",
  "no-spend": "No-spend day",
  "log-expenses": "Log expenses",
  "budget-check": "Weekly budget check",
  "no-sugar": "No sugar",
  "no-alcohol": "No alcohol",
  "no-social-morning": "No social media before noon",
  "no-smoking": "No smoking",
  "no-snacking": "No snacking after dinner",
  "no-caffeine": "No caffeine after 14:00",
};

const KID_TITLES: Record<string, string> = {
  "brush-teeth": "Brush teeth",
  "read-together": "Read a book together",
  "tidy-toys": "Tidy my toys",
  bath: "Bath time",
  veggies: "Eat vegetables",
  bedtime: "Go to bed on time",
  dressed: "Get dressed by myself",
  "wash-hands": "Wash hands before eating",
  water: "Drink water",
  outside: "Play outside",
  "please-thanks": "Say please and thank you",
  chore: "Help with a chore",
  "make-bed": "Make my bed",
  fruit: "Eat a fruit",
  "clear-plate": "Clear my plate",
  "laundry-basket": "Clothes in the basket",
  "feed-pet": "Feed the pet",
  plants: "Water the plants",
  homework: "Do my homework",
  "school-bag": "Pack my school bag",
  music: "Practice music",
  sports: "Sports practice",
  draw: "Draw or color",
  "screen-free": "A screen-free hour",
};

const GROUP_TITLES: Record<string, string> = {
  "g-family-dinner": "Family dinner",
  "g-date-night": "Date night",
  "g-family-walk": "Family walk",
  "g-game-night": "Game night",
  "g-cook-together": "Cook together",
  "g-tidy-together": "Tidy up together",
};

const TREAT_TITLES: Record<string, string> = {
  "ice-cream": "Ice cream at the park",
  playground: "Trip to the playground",
  "movie-night": "Family movie night",
  "pizza-night": "Pizza night",
  cupcakes: "Bake cupcakes together",
  pancakes: "Pancake breakfast",
  zoo: "Trip to the zoo",
  swimming: "Swimming at the pool",
  "bike-ride": "Bike ride together",
  picnic: "Picnic in the park",
  "new-book": "A new book",
  "art-supplies": "New art supplies",
  "small-toy": "A small new toy",
  "game-time": "Extra game time",
  fair: "A day at the fair",
  "late-friday": "Stay up late on Friday",
};

const KID_GROUP_LABELS: Record<string, string> = {
  "morning-evening": "Morning & evening",
  healthy: "Healthy",
  helping: "Helping at home",
  "learning-play": "Learning & play",
  "kind-calm": "Kind & calm",
};

const CATEGORY_LABELS: Record<string, string> = {
  health: "Health", fitness: "Fitness", mind: "Mind", learning: "Learning", people: "People", home: "Home", work_money: "Work & money", break_habit: "Break a habit",
};

describe("templates in the catalog", () => {
  it("every habit template says today's English title", () => {
    expect(HABIT_TEMPLATES.map((t) => t.id).sort()).toEqual(Object.keys(HABIT_TITLES).sort());
    for (const t of HABIT_TEMPLATES) expect(templateTitle(tEn, t.id), t.id).toBe(HABIT_TITLES[t.id]);
  });
  it("every group template says today's English title", () => {
    expect(GROUP_TEMPLATES.map((t) => t.id).sort()).toEqual(Object.keys(GROUP_TITLES).sort());
    for (const t of GROUP_TEMPLATES) expect(templateTitle(tEn, t.id), t.id).toBe(GROUP_TITLES[t.id]);
  });
  it("every kid template says today's English title (templates.kid.<id>: some ids repeat a habit template's)", () => {
    expect(KID_TEMPLATES.map((t) => t.id).sort()).toEqual(Object.keys(KID_TITLES).sort());
    for (const t of KID_TEMPLATES) expect(kidTemplateTitle(tEn, t.id), t.id).toBe(KID_TITLES[t.id]);
  });
  it("every kid template group is named as before", () => {
    expect([...KID_TEMPLATE_GROUPS].sort()).toEqual(Object.keys(KID_GROUP_LABELS).sort());
    for (const g of KID_TEMPLATE_GROUPS) expect(kidGroupLabel(tEn, g), g).toBe(KID_GROUP_LABELS[g]);
  });
  it("every treat idea says today's English title", () => {
    expect(TREAT_IDEAS.map((i) => i.id).sort()).toEqual(Object.keys(TREAT_TITLES).sort());
    for (const i of TREAT_IDEAS) expect(treatTitle(tEn, i.id), i.id).toBe(TREAT_TITLES[i.id]);
  });
  it("every category is named as before", () => {
    expect([...CATEGORY_ORDER].sort()).toEqual(Object.keys(CATEGORY_LABELS).sort());
    for (const c of CATEGORY_ORDER) expect(categoryLabel(tEn, c), c).toBe(CATEGORY_LABELS[c]);
  });
});
