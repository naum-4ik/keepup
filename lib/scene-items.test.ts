import { describe, expect, it } from "vitest";
import { KID_THEMES } from "@/lib/garden";
import { MAX_ITEMS, sceneItems, tapItems } from "@/lib/scene-items";

describe("scene items: each tap adds one thing to the week's scene", () => {
  it("adds one item per star, up to 25", () => {
    expect(sceneItems(0, "garden")).toHaveLength(0);
    expect(sceneItems(1, "garden")).toHaveLength(1);
    expect(sceneItems(10, "garden")).toHaveLength(10);
    expect(sceneItems(40, "garden")).toHaveLength(MAX_ITEMS);
  });
  it("is the same for the same stars, so a reload looks the same", () => {
    expect(sceneItems(7, "space")).toEqual(sceneItems(7, "space"));
    // The first items don't move when more arrive.
    expect(sceneItems(9, "town").slice(0, 4)).toEqual(sceneItems(4, "town"));
  });
  it("cycles the theme's own items in a fixed order", () => {
    expect(sceneItems(3, "garden").map((i) => i.emoji)).toEqual(tapItems("garden").slice(0, 3));
    expect(sceneItems(8, "aquarium")[6].emoji).toBe(tapItems("aquarium")[0]);
    for (const t of KID_THEMES) expect(tapItems(t.id).length, t.id).toBeGreaterThanOrEqual(6);
  });
  it("keeps every spot inside the picture and apart; standing things on the ground, floating ones clear of the middle", () => {
    for (const t of KID_THEMES) {
      const items = sceneItems(MAX_ITEMS, t.id);
      for (const i of items) {
        expect(i.x, t.id).toBeGreaterThanOrEqual(6);
        expect(i.x, t.id).toBeLessThanOrEqual(94);
        if (i.standing) {
          expect(i.y, t.id).toBeGreaterThanOrEqual(80); // on the ground strip (the bottom fifth)
        } else {
          expect(i.y, t.id).toBeGreaterThanOrEqual(8);
          expect(i.y, t.id).toBeLessThanOrEqual(80);
          expect(i.y > 50 && i.x > 38 && i.x < 62, `${t.id} ${i.x},${i.y}`).toBe(false); // the stage picture
        }
      }
      expect(new Set(items.map((i) => `${i.x},${i.y}`)).size, t.id).toBe(MAX_ITEMS);
    }
    expect(sceneItems(1, "garden")[0].standing).toBe(true);
    expect(sceneItems(1, "space")[0].standing).toBe(false);
  });
});
