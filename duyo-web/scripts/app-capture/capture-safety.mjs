// Section 1 — a goal room, and a message the safety screen stops.
import { APP, newPage, recordMeta, settle, shot, toShot } from './browser.mjs';
import { inputRect, scrollerOf, textRect } from './dom.mjs';
import { BLOCKED_DRAFT, CLOCK, GROUP_KEY, GROUP_MESSAGES, at } from './mock-data.mjs';

/** A message both states show, to measure how far the room moved. */
const ANCHOR = GROUP_MESSAGES[GROUP_MESSAGES.length - 2].body;

/** Every scroller on the page to its end — a chat is read from the bottom. */
export async function scrollToEnd(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
      }
    }
  });
}

async function geometry(page) {
  return {
    clock: CLOCK.safety,
    band: toShot(await scrollerOf(page, ANCHOR)),
    anchor: toShot(await textRect(page, ANCHOR)),
  };
}

export async function captureSafety(context, out) {
  const page = await newPage(context, { at: at(CLOCK.safety) });
  const q = new URLSearchParams({ key: GROUP_KEY, label: 'Kitoblar' });
  await page.goto(`${APP}/group?${q}`, { waitUntil: 'load' });
  await page.getByText('Kelishdik!', { exact: false }).waitFor();
  await settle(page, 800);
  await scrollToEnd(page);
  await settle(page, 400);
  await shot(page, out('safety', 1));
  recordMeta('safety-1', await geometry(page));

  // The child tries to hand out a phone number. The server answers 422 with
  // its contact_info refusal; the app shows it to the sender alone, keeps the
  // draft, and nothing reaches the room.
  const input = page.getByLabel('Guruh xabari');
  // A phone keyboard does not draw the desktop spellchecker's red squiggles.
  await input.evaluate((el) => el.setAttribute('spellcheck', 'false'));
  await input.click();
  await input.pressSequentially(BLOCKED_DRAFT, { delay: 15 });
  await page.getByLabel('Yuborish', { exact: true }).click();
  await page.getByText('Bu xabar yuborilmadi', { exact: false }).waitFor();
  // The keyboard is down in the frame the site shows, so no caret either.
  await input.evaluate((el) => el.blur());
  await settle(page, 500);
  await scrollToEnd(page);
  await settle(page, 300);
  await shot(page, out('safety', 2));
  // The draft's line in the composer: the site types it in, glyph by glyph.
  recordMeta('safety-2', { ...(await geometry(page)), draft: toShot(await inputRect(page, 'Guruh xabari')) });
  await page.close();
}
