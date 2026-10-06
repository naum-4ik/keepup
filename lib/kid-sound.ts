// ideas/kid-view-next.md §4: soft sounds in the kid view only (adult screens stay silent), on by
// default with a mute button for the parent, remembered on this device. Made with Web Audio, so there
// are no sound files. Browsers allow audio only after a tap, and every sound here follows one.
export type KidSound = "pop" | "boop" | "wiggle" | "chime" | "melody" | "reveal";

const KEY = "keepup:kid-sound";
let ctx: AudioContext | null = null;
const recent: number[] = [];

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "off";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(KEY, muted ? "off" : "on");
  } catch {
    // Storage can be blocked (private mode); sound just stays as it is for this visit.
  }
}

// At most `limit` sounds in any second; `times` holds the recent ones and is trimmed in place.
export function allowSound(times: number[], now: number, limit: number): boolean {
  while (times.length > 0 && now - times[0] >= 1000) times.shift();
  if (times.length >= limit) return false;
  times.push(now);
  return true;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// One soft note: a quick fade in and out so it never clicks; `to` slides the pitch.
function note(a: AudioContext, freq: number, at: number, length: number, { to, type = "sine", gain = 0.12 }: { to?: number; type?: OscillatorType; gain?: number } = {}) {
  const osc = a.createOscillator();
  const vol = a.createGain();
  const t = a.currentTime + at;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + length);
  vol.gain.setValueAtTime(0, t);
  vol.gain.linearRampToValueAtTime(gain, t + 0.01);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(vol).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

const SOUNDS: Record<KidSound, (a: AudioContext) => void> = {
  // A check-in: a bubbly pop up.
  pop: (a) => note(a, 420, 0, 0.18, { to: 880 }),
  // A tap on a card that's already done: a friendly low boop, nothing new happens.
  boop: (a) => note(a, 330, 0, 0.16, { to: 260, type: "triangle" }),
  // A tap on something in the scene.
  wiggle: (a) => {
    note(a, 660, 0, 0.08, { type: "triangle", gain: 0.08 });
    note(a, 780, 0.07, 0.08, { type: "triangle", gain: 0.08 });
  },
  // A new picture (3, 7, 12, 18 stars): a bright three-note chime.
  chime: (a) => [784, 988, 1175].forEach((f, i) => note(a, f, i * 0.09, 0.35, { gain: 0.1 })),
  // The big reveal (every tap that earns a star): a bouncy run up and a sparkle on top, from 0.1 s, as
  // the new thing springs in big (lib/kid-reveal.ts SHOW_AT), so it follows the tap's pop.
  reveal: (a) => {
    [659, 831, 988, 1319].forEach((f, i) => note(a, f, 0.1 + i * 0.06, 0.2, { type: "triangle", gain: 0.1 }));
    note(a, 1760, 0.34, 0.4, { to: 2637, gain: 0.05 });
  },
  // Everything done today: a short tune.
  melody: (a) => [523, 659, 784, 659, 1047].forEach((f, i) => note(a, f, i * 0.14, 0.24, { type: "triangle", gain: 0.1 })),
};

export function playKidSound(sound: KidSound): void {
  if (isMuted()) return;
  if (sound === "wiggle" && !allowSound(recent, Date.now(), 4)) return;
  try {
    const a = audio();
    if (a) SOUNDS[sound](a);
  } catch {
    // No audio on this device: the animation still plays.
  }
}
