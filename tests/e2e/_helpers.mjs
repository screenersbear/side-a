// Shared helpers for the browser tests.
import cfg from '../../kit.config.mjs';

export { cfg };

export const CLICKABLE = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[onclick]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'summary',
  'label[for]',
].join(',');

/** Collect every problem a page reports while we use it. */
export function watch(page, origin) {
  const problems = [];
  const ignored = (text) => cfg.ignoreConsoleErrors.some((s) => text.includes(s));
  page.on('pageerror', (e) => problems.push(`JS crash: ${e.message}`));
  page.on('console', (m) => {
    // "Failed to load resource" is reported below with its URL, so skip the URL-less duplicate.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource') && !ignored(m.text())) {
      problems.push(`console.error: ${m.text()}`);
    }
  });
  page.on('response', (r) => {
    if (r.url().startsWith(origin) && r.status() >= 400 && !ignored(r.url())) {
      problems.push(`HTTP ${r.status()} for ${r.url()}`);
    }
  });
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(origin) && !ignored(r.url())) {
      problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`);
    }
  });
  // Never let an alert/confirm freeze the run. Dismiss = the "cancel" path.
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  return problems;
}

/**
 * Tag every visible, clickable, same-site element with data-safety-idx
 * and return a fingerprint + human label for each, in page order.
 */
export async function markClickables(page) {
  return page.evaluate(
    ({ sel, skip }) => {
      document.querySelectorAll('[data-safety-idx]').forEach((e) => e.removeAttribute('data-safety-idx'));
      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
        if (skip.some((s) => el.closest(s))) continue;
        if (el.tagName === 'A') {
          const href = el.getAttribute('href') || '';
          if (/^(mailto:|tel:|sms:|javascript:)/i.test(href)) continue;
          const u = new URL(el.href, location.href);
          if (u.origin !== location.origin || el.target === '_blank' || el.hasAttribute('download')) continue;
        }
        const label = (
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.innerText ||
          el.value ||
          el.id ||
          el.getAttribute('class') ||
          el.tagName
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 60);
        const fp = [el.tagName, el.id, el.getAttribute('class'), el.getAttribute('href'), label].join('|');
        el.setAttribute('data-safety-idx', String(out.length));
        out.push({ fp, label: `<${el.tagName.toLowerCase()}> "${label}"` });
      }
      return out;
    },
    { sel: CLICKABLE, skip: cfg.skipClickSelectors },
  );
}

/** A brand new, isolated browser tab (fresh storage) with the same device settings as the project. */
export async function freshPage(browser, testInfo, path) {
  const u = testInfo.project.use;
  const ctx = await browser.newContext({
    baseURL: u.baseURL,
    viewport: u.viewport,
    userAgent: u.userAgent,
    deviceScaleFactor: u.deviceScaleFactor,
    isMobile: u.isMobile,
    hasTouch: u.hasTouch,
  });
  const page = await ctx.newPage();
  const problems = watch(page, new URL(u.baseURL).origin);
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => {});
  return { ctx, page, problems };
}

export async function clickIdx(page, idx) {
  await page.locator(`[data-safety-idx="${idx}"]`).first().click({ timeout: 3000 });
  await page.waitForTimeout(cfg.settleMs);
}
