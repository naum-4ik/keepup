import { describe, expect, it } from "vitest";
import { inOrder, orderForKid } from "@/lib/kid-order";
import type { CheckInState } from "@/lib/schedule";

const h = (id: string, state: CheckInState) => ({ id, state });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("orderForKid: open habits first, done ones at the bottom", () => {
  it("moves done habits down and keeps each group in its original order", () => {
    const habits = [h("a", "done"), h("b", "open"), h("c", "done"), h("d", "open"), h("e", "open")];
    expect(ids(orderForKid(habits))).toEqual(["b", "d", "e", "a", "c"]);
  });
  it("counts pending and checked-today as done, like the green card", () => {
    const habits = [h("a", "pending"), h("b", "checked-today"), h("c", "open")];
    expect(ids(orderForKid(habits))).toEqual(["c", "a", "b"]);
  });
  it("leaves an all-open or all-done list as it is", () => {
    expect(ids(orderForKid([h("a", "open"), h("b", "open")]))).toEqual(["a", "b"]);
    expect(ids(orderForKid([h("a", "done"), h("b", "done")]))).toEqual(["a", "b"]);
    expect(orderForKid([])).toEqual([]);
  });
  it("doesn't change the list it's given", () => {
    const habits = [h("a", "done"), h("b", "open")];
    orderForKid(habits);
    expect(ids(habits)).toEqual(["a", "b"]);
  });
});

describe("inOrder: the list in the last settled order", () => {
  it("follows the order, appends new habits and drops gone ones", () => {
    const habits = [h("a", "open"), h("b", "done"), h("c", "open"), h("d", "open")];
    expect(ids(inOrder(["c", "x", "a", "b"], habits))).toEqual(["c", "a", "b", "d"]);
  });
});
