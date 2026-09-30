// Section 2 — DUYO MIYA, the full-screen map of what the child has learnt.
import { APP, newPage, recordMeta, setState, settle, shot } from './browser.mjs';
import { CLOCK, at } from './mock-data.mjs';

/** Open Miya and expand the sky card into the full map. */
export async function openMap(context, clock) {
  const page = await newPage(context, { at: at(clock) });
  await page.goto(`${APP}/brain`, { waitUntil: 'load' });
  await page.getByText('Bilimlaringiz olami').waitFor();
  await settle(page, 800);
  await page.getByLabel('Xaritani to‘liq ochish').click();
  await page.getByText('DUYO MIYA').waitFor();
  // The layout settles its planets with a short simulation; let it finish
  // and the backdrop image decode before the shutter.
  await settle(page, 4500);
  return page;
}

export async function captureMap(context, out) {
  for (const level of [1, 2]) {
    await setState({ brain: level });
    const page = await openMap(context, CLOCK.map);
    await shot(page, out('map', level));
    recordMeta(`map-${level}`, { clock: CLOCK.map });
    await page.close();
  }
  await setState({ brain: 1 });
}
