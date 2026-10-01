// WAI-ARIA tabs keyboard pattern: the arrows move to the previous or next tab (wrapping), Home and
// End to the first and last. Null for any other key.
export function tabFromKey(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
