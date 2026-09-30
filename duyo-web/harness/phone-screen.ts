/**
 * Look at every phone screen: each held state of each screen, each change
 * half-way, every fade between sections, and a live scrub through the film.
 * Every view is its own createPhoneScreen instance, drawn at a fixed state.
 * The states are read off the scripts themselves (their spans), so this page
 * never goes stale when a capture or a timing changes.
 *
 *   /harness/phone-screen.html                         every held state (the middle of each gap)
 *   /harness/phone-screen.html?mode=fade               every change, half-way through
 *   /harness/phone-screen.html?mode=mix                every section change at mix 0.25 / 0.5 / 0.75
 *   /harness/phone-screen.html?mode=scrub              one screen and a slider over the whole film
 *   /harness/phone-screen.html?screen=chat&p=1         one screen at full size
 *   (add &to=safety&pTo=0&mix=0.5 to see a section change)
 *   /harness/phone-screen.html?screen=chat&from=0.5&to=0.7&n=12   n steps of one screen, p from → to
 *   /harness/phone-screen.html?mode=bench              repaints and cost per scrub
 *
 * body[data-ready] is set once no instance has repainted for a while, i.e.
 * every capture has decoded — screenshot scripts wait on it.
 */
import { createPhoneScreen } from '../src/scene/phoneScreen';
import { SCRIPTS } from '../src/scene/phoneScreenScripts';
import type { PhoneScreen, ScreenId, ScreenState } from '../src/scene/contract';

const IDS = Object.keys(SCRIPTS) as ScreenId[];
const MIXES = [0.25, 0.5, 0.75];
const QUIET_MS = 1200;
const isScreen = (s: string | null): s is ScreenId => IDS.includes(s as ScreenId);
const still = (id: ScreenId, p: number): ScreenState => ({ from: id, to: id, mix: 0, pFrom: p, pTo: p, t: 0 });

/** The middle of every stretch of p over which a screen holds still. */
function holds(id: ScreenId): number[] {
  const out: number[] = [];
  let gapStart = 0;
  for (const [a, b] of SCRIPTS[id].spans) {
    if (a > gapStart) out.push((gapStart + a) / 2);
    gapStart = b;
  }
  if (gapStart < 1 || out.length === 0) out.push((gapStart + 1) / 2);
  return out;
}

/** The middle of every change. */
const changes = (id: ScreenId) => SCRIPTS[id].spans.map(([a, b]) => (a + b) / 2);

const mounted: PhoneScreen[] = [];

function mount(host: HTMLElement, state: ScreenState, caption: string): PhoneScreen {
  const screen = createPhoneScreen();
  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  fig.append(screen.canvas, cap);
  host.append(fig);
  screen.draw(state); // paints the stand-in now; the module repaints itself as captures decode
  mounted.push(screen);
  return screen;
}

/** Resolves once no mounted screen has asked for an upload in QUIET_MS. */
function settled(): Promise<void> {
  return new Promise((done) => {
    let seen = mounted.map((s) => s.texture.version);
    let quietSince = performance.now();
    const tick = () => {
      const now = mounted.map((s) => s.texture.version);
      if (now.some((v, i) => v !== seen[i])) quietSince = performance.now();
      seen = now;
      if (performance.now() - quietSince >= QUIET_MS) done();
      else setTimeout(tick, 100);
    };
    setTimeout(tick, 100);
  });
}

/** Scrubs each screen and each section change, forcing the raster with a 1 px readback after every repaint. */
async function bench(host: HTMLElement) {
  host.className = 'bench';
  const screen = mount(host, still('chat', 0), '');
  const ctx = screen.canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('harness: no 2D context');
  const rows: string[] = [];
  const run = async (label: string, state: (k: number) => ScreenState) => {
    screen.draw(state(0));
    screen.draw(state(1));
    screen.draw(state(0)); // every capture this run needs is wanted, and in by the settle
    await settled();
    let uploads = 0;
    let ms = 0;
    for (let rep = 0; rep < 3; rep++) {
      for (let i = 0; i <= 600; i++) {
        const before = screen.texture.version;
        const t0 = performance.now();
        screen.draw(state(i / 600));
        if (screen.texture.version !== before) {
          ctx.getImageData(0, 0, 1, 1);
          uploads++;
        }
        ms += performance.now() - t0;
      }
    }
    rows.push(`${label.padEnd(18)} repaints ${String(uploads / 3).padStart(4)} / 601 draws   ` +
      `avg ${(ms / Math.max(1, uploads)).toFixed(2)} ms per repaint`);
  };
  for (const id of IDS) await run(id, (k) => still(id, k));
  for (let i = 0; i < IDS.length - 1; i++) {
    const from = IDS[i];
    const to = IDS[i + 1];
    await run(`${from}→${to}`, (k) => ({ from, to, mix: k, pFrom: 1, pTo: 0, t: 0 }));
  }
  const pre = document.createElement('pre');
  pre.textContent = rows.join('\n');
  host.append(pre);
  screen.dispose();
  const after = screen.texture.version;
  screen.draw(still('chat', 0.5));
  pre.textContent += `\n\ndraw after dispose re-uploads: ${screen.texture.version !== after}` +
    `   canvas after dispose: ${screen.canvas.width}×${screen.canvas.height}`;
  document.body.dataset.ready = '1';
}

/**
 * One screen and a slider standing in for the page scroll: 0..4, one unit
 * per section, timed roughly as the director times it — a screen plays over
 * the first 60% of its unit, the next fades in over the last stretch.
 */
function scrub(host: HTMLElement) {
  host.className = 'scrub';
  const input = Object.assign(document.createElement('input'), { type: 'range', min: '0', max: '4', step: '0.001', value: '0' });
  const label = document.createElement('output');
  const screen = mount(host, still('chat', 0), '');
  host.prepend(input, label);
  const at = (v: number): ScreenState => {
    const a = Math.min(IDS.length - 1, Math.floor(v));
    const k = v - a;
    const b = Math.min(IDS.length - 1, a + 1);
    const mix = b === a ? 0 : Math.min(1, Math.max(0, (k - 0.7) / 0.25));
    return { from: IDS[a], to: IDS[b], mix, pFrom: Math.min(1, k / 0.6), pTo: 0, t: 0 };
  };
  const update = () => {
    const s = at(Number(input.value));
    label.textContent = `${s.from} p ${s.pFrom.toFixed(3)} → ${s.to} mix ${s.mix.toFixed(2)}`;
    screen.draw(s);
  };
  input.addEventListener('input', update);
  update();
}

const host = document.getElementById('grid');
if (!host) throw new Error('harness: #grid missing');
const qs = new URLSearchParams(location.search);
const one = qs.get('screen');
const mode = qs.get('mode');
const num = (k: string, d: number) => {
  const v = Number(qs.get(k));
  return qs.has(k) && Number.isFinite(v) ? v : d;
};

if (mode === 'bench') {
  void bench(host);
} else {
  if (mode === 'scrub') {
    scrub(host);
  } else if (mode === 'mix') {
    for (let i = 0; i < IDS.length - 1; i++) {
      const from = IDS[i];
      const to = IDS[i + 1];
      for (const mix of MIXES) mount(host, { from, to, mix, pFrom: 1, pTo: 0, t: 0 }, `${from} → ${to} · mix ${mix}`);
    }
  } else if (mode === 'fade') {
    for (const id of IDS) for (const p of changes(id)) mount(host, still(id, p), `${id} · change at p ${p.toFixed(3)}`);
  } else if (isScreen(one) && qs.has('n')) {
    const n = Math.max(2, num('n', 6));
    for (let i = 0; i < n; i++) {
      const p = num('from', 0) + ((num('to', 1) - num('from', 0)) * i) / (n - 1);
      mount(host, still(one, p), `${one} · p ${p.toFixed(3)}`);
    }
  } else if (isScreen(one)) {
    host.className = 'single';
    const to = qs.get('to');
    const p = num('p', 1);
    mount(host, { from: one, to: isScreen(to) ? to : one, mix: num('mix', 0), pFrom: p, pTo: num('pTo', p), t: 0 }, '');
  } else {
    for (const id of IDS) for (const p of holds(id)) mount(host, still(id, p), `${id} · p ${p.toFixed(3)}`);
  }
  void settled().then(() => {
    document.body.dataset.ready = '1';
  });
}
