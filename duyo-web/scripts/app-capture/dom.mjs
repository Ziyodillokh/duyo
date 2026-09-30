// In-page lookups for the geometry the site needs, all in CSS px; browser.mjs
// toShot() turns them into capture px. Everything is found by the text the
// app shows, not by class names, which react-native-web generates.

/** The rect of the visible element that shows `text` (exact, trimmed), innermost first. */
export async function textRect(page, text, { bubble = false, exact = true } = {}) {
  return page.evaluate(({ text, bubble, exact }) => {
    const visible = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const match = (el) => {
      const t = (el.textContent ?? '').trim();
      return exact ? t === text : t.includes(text);
    };
    const all = [...document.querySelectorAll('div, span, input, textarea')].filter(match).filter(visible);
    // Innermost: no other match inside it.
    const inner = all.filter((el) => !all.some((o) => o !== el && el.contains(o)));
    let el = inner[inner.length - 1];
    if (!el) return null;
    if (bubble) {
      for (let e = el.parentElement; e; e = e.parentElement) {
        const bg = getComputedStyle(e).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          el = e;
          break;
        }
      }
    }
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, { text, bubble, exact });
}

/** The nearest scrolling ancestor of the element showing `text`: its rect and scroll state. */
export async function scrollerOf(page, text) {
  return page.evaluate((text) => {
    const el = [...document.querySelectorAll('div, span')].find((e) => (e.textContent ?? '').trim() === text);
    for (let e = el?.parentElement; e; e = e.parentElement) {
      const oy = getComputedStyle(e).overflowY;
      // A list shorter than its viewport is still its viewport.
      if (oy === 'auto' || oy === 'scroll') {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, scrollTop: e.scrollTop, max: e.scrollHeight - e.clientHeight };
      }
    }
    return null;
  }, text);
}

/** Scroll that same ancestor by `dy` CSS px of its own scrollTop. */
export async function scrollBy(page, text, dy) {
  await page.evaluate(({ text, dy }) => {
    const el = [...document.querySelectorAll('div, span')].find((e) => (e.textContent ?? '').trim() === text);
    for (let e = el?.parentElement; e; e = e.parentElement) {
      const oy = getComputedStyle(e).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight) {
        e.scrollTop += dy;
        return;
      }
    }
  }, { text, dy });
}

/** The rect of an <input>/<textarea> by its accessibility label. */
export async function inputRect(page, label) {
  return page.getByLabel(label, { exact: true }).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pl = parseFloat(cs.paddingLeft);
    const pr = parseFloat(cs.paddingRight);
    const pt = parseFloat(cs.paddingTop);
    const pb = parseFloat(cs.paddingBottom);
    // The content box: where the text is drawn.
    return { x: r.x + pl, y: r.y + pt, width: r.width - pl - pr, height: r.height - pt - pb };
  });
}
