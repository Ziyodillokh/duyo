// Section 3 — the goal DUYO split into steps, and a step logged in Maqsadlarim.
// Section 4 — the home dashboard with DUYO standing in its halo.
import { APP, newPage, recordMeta, setState, settle, shot, toShot } from './browser.mjs';
import { inputRect, textRect } from './dom.mjs';
import { openMap } from './capture-map.mjs';
import { CLOCK, GOAL_TOTAL, GOAL_UNIT, at } from './mock-data.mjs';

/** The chapter the child has reached before, and after, logging progress. */
const FROM = 10;
const TO = 11;
const pct = (n) => Math.round((Math.round((n / GOAL_TOTAL) * 1000) / 10));

/** The goal card's moving parts: its progress line, bar, entry field and save button. */
async function cardGeometry(page, current) {
  const bar = await page.evaluate((label) => {
    const el = [...document.querySelectorAll('div')].find((e) => (e.textContent ?? '').trim() === label && e.children.length === 0);
    const track = el.parentElement.children[0];
    const fill = track.children[0];
    const box = (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return { track: box(track), fill: box(fill), pct: box(el) };
  }, `${pct(current)}%`);
  const save = await page.getByLabel('Progressni saqlash').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  return {
    clock: CLOCK.goals,
    progress: toShot(await textRect(page, `${current} / ${GOAL_TOTAL} ${GOAL_UNIT}`)),
    track: toShot(bar.track),
    fill: toShot(bar.fill),
    pct: toShot(bar.pct),
    entry: toShot(await inputRect(page, 'Yangi progress')),
    save: toShot(save),
  };
}

async function openGoals(context, current) {
  await setState({ goalAt: current });
  const page = await newPage(context, { at: at(CLOCK.goals) });
  await page.goto(`${APP}/my-goals`, { waitUntil: 'load' });
  await page.getByText(`${current} / ${GOAL_TOTAL} ${GOAL_UNIT}`).waitFor();
  await page.getByText('Lochin-58').waitFor();
  await settle(page, 900);
  return page;
}

export async function captureGoals(context, out) {
  // 1. The plan DUYO wrote when the goal was set: its #maqsad notes, the goal
  //    and 1-qadam … 4-qadam, filtered from the map by the tag's chip.
  await setState({ brain: 2 });
  const map = await openMap(context, CLOCK.goals);
  await map.getByLabel(/^#maqsad to'plami/).click();
  await settle(map, 800);
  await map.getByLabel("Qaydlar ro'yxati").click();
  await map.getByText('#maqsad (5)', { exact: false }).waitFor();
  await settle(map, 900);
  await shot(map, out('goals', 1));
  recordMeta('goals-1', { clock: CLOCK.goals });
  await map.close();
  await setState({ brain: 1 });

  // 2. Maqsadlarim, at chapter 10 of 15.
  const page = await openGoals(context, FROM);
  await shot(page, out('goals', 2));
  recordMeta('goals-2', await cardGeometry(page, FROM));

  // 3. The child types the chapter they reached; Saqlash lights up.
  const entry = page.getByLabel('Yangi progress');
  await entry.click();
  await entry.pressSequentially(String(TO), { delay: 40 });
  await entry.evaluate((el) => el.blur());
  await settle(page, 400);
  await shot(page, out('goals', 3));
  recordMeta('goals-3', await cardGeometry(page, FROM));
  await page.close();

  // 4. Saved: 11 / 15 bob. Reloaded from the mock, as the app refetches.
  const saved = await openGoals(context, TO);
  await shot(saved, out('goals', 4));
  recordMeta('goals-4', await cardGeometry(saved, TO));
  await saved.close();
  await setState({ goalAt: FROM });
}

export async function captureHome(context, out) {
  const page = await newPage(context, { at: at(CLOCK.home) });
  await page.goto(`${APP}/`, { waitUntil: 'load' });
  // The splash holds for 1.5s, then hands over to the dashboard.
  await page.getByText('boshlash uchun bosing').waitFor({ timeout: 20000 });
  await page.getByText('1 250').waitFor();
  await settle(page, 1500);
  await shot(page, out('home', 1));
  recordMeta('home-1', { clock: CLOCK.home });
  await page.close();
}
