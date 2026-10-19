// A setting that saves on every change can have several saves in flight (a quick Tokyo, then "Use this
// device's time zone"). Only the newest one speaks for the control: an answer that a newer request has
// overtaken is ignored, and a failure goes back to the last value the server confirmed (not the value
// on screen before the tap, which may itself never have been saved). Free of React so it is
// unit-tested (lib/save-tracker.test.ts); components/profile/setting-status.tsx keeps one in a ref.
export type SaveTracker<V> = {
  // A new request: its number.
  begin(): number;
  // The answer to request n for value. current: it is still the newest (show its result); revertTo:
  // on a current failure, the value the control goes back to.
  answer(n: number, value: V, ok: boolean): { current: boolean; revertTo: V | null };
  confirmed(): V;
};

export function saveTracker<V>(saved: V): SaveTracker<V> {
  let seq = 0;
  let confirmedSeq = 0;
  let confirmed = saved;
  return {
    begin: () => ++seq,
    answer(n, value, ok) {
      // A success still counts as saved when overtaken, unless a newer one was confirmed already.
      if (ok && n > confirmedSeq) {
        confirmedSeq = n;
        confirmed = value;
      }
      const current = n === seq;
      return { current, revertTo: current && !ok ? confirmed : null };
    },
    confirmed: () => confirmed,
  };
}
